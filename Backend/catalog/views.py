"""
NICARA Catalogue — Views  (mounted at /api/catalog/, module 'catalog')

    rooms/                          room types
    zones/                          room zones (walls, areas)
    basic-components/               estimate row types + their quantity rules
    furniture/                      finished products (?room=<id> scopes to a room)
    furniture/{id}/components/      the basic components a furniture is estimated from
    furniture/components/{id}/      one component link
    furniture/{id}/calculate/       preview rows for a size (nothing saved)
    meta/                           units, cabinet types, rules, item types, counts
    tree/                           rooms, zones and furniture in one call
"""
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import HasModulePermission

from . import rules
from .models import BasicComponent, CabinetType, Furniture, FurnitureComponent, ItemType, Room, Zone
from .pricing import breakdown, size_inches
from .serializers import (
    BasicComponentSerializer, FurnitureComponentSerializer, FurnitureListSerializer,
    FurnitureSerializer, RoomSerializer, ZoneSerializer,
)

MODULE = 'catalog'


class CatalogView:
    """Mixin — every catalogue endpoint is gated on the `catalog` module."""
    permission_classes = [HasModulePermission]
    module = MODULE


class SoftDeleteMixin:
    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])


# ── Rooms & zones ───────────────────────────────────────────

class RoomListCreateView(CatalogView, generics.ListCreateAPIView):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    filterset_fields = ['is_active']
    search_fields = ['name', 'code']


class RoomDetailView(CatalogView, SoftDeleteMixin, generics.RetrieveUpdateDestroyAPIView):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer


class ZoneListCreateView(CatalogView, generics.ListCreateAPIView):
    queryset = Zone.objects.all()
    serializer_class = ZoneSerializer
    filterset_fields = ['is_active']
    search_fields = ['name', 'code']


class ZoneDetailView(CatalogView, SoftDeleteMixin, generics.RetrieveUpdateDestroyAPIView):
    queryset = Zone.objects.all()
    serializer_class = ZoneSerializer


# ── Basic components ────────────────────────────────────────

class BasicComponentListCreateView(CatalogView, generics.ListCreateAPIView):
    queryset = BasicComponent.objects.select_related('library_category')
    serializer_class = BasicComponentSerializer
    filterset_fields = ['is_active', 'item_type', 'quantity_rule', 'library_category']
    search_fields = ['name', 'code']


class BasicComponentDetailView(CatalogView, SoftDeleteMixin, generics.RetrieveUpdateDestroyAPIView):
    queryset = BasicComponent.objects.select_related('library_category')
    serializer_class = BasicComponentSerializer


# ── Furniture ───────────────────────────────────────────────

def _furniture_qs():
    return (Furniture.objects
            .annotate(component_count=Count('components', filter=Q(components__is_active=True)))
            .prefetch_related('rooms'))


class FurnitureListCreateView(CatalogView, generics.ListCreateAPIView):
    filterset_fields = ['is_active', 'rooms', 'cabinet_type']
    search_fields = ['name', 'code', 'description']

    def get_queryset(self):
        qs = _furniture_qs()
        # ?room=<id> → furniture linked to that room, plus universal furniture.
        room = self.request.query_params.get('room')
        if room:
            qs = qs.filter(Q(rooms__id=room) | Q(rooms__isnull=True)).distinct()
        return qs

    def get_serializer_class(self):
        return FurnitureSerializer if self.request.method == 'POST' else FurnitureListSerializer


class FurnitureDetailView(CatalogView, SoftDeleteMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FurnitureSerializer

    def get_queryset(self):
        return _furniture_qs().prefetch_related(
            'components__basic_component__library_category', 'components__default_material__brand')


class FurnitureComponentListCreateView(CatalogView, generics.ListCreateAPIView):
    serializer_class = FurnitureComponentSerializer

    def get_queryset(self):
        return (FurnitureComponent.objects.filter(furniture_id=self.kwargs['furniture_id'])
                .select_related('basic_component', 'default_material__brand'))

    def perform_create(self, serializer):
        furniture = get_object_or_404(Furniture, pk=self.kwargs['furniture_id'])
        last = furniture.components.order_by('-sort_order').first()
        serializer.save(furniture=furniture, sort_order=(last.sort_order + 1) if last else 1)


class FurnitureComponentDetailView(CatalogView, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FurnitureComponentSerializer
    queryset = FurnitureComponent.objects.select_related('basic_component', 'default_material__brand')


def serialize_rows(rows):
    return [{
        'component_id': r['component'].id,
        'basic_component': r['basic_component'].id,
        'item_type': r['item_type'], 'specification': r['specification'],
        'brand': r['brand'], 'model': r['model'],
        'raw_material': r['raw_material'].id if r['raw_material'] else None,
        'qty': float(r['qty']), 'unit': r['unit'], 'rate': float(r['rate']),
        'price_unit': r['price_unit'], 'amount': float(r['qty'] * r['rate']),
        'gst_pct': float(r['gst_pct']), 'quantity_rule': r['quantity_rule'],
        'basis': r['basis'], 'needs_input': r['needs_input'], 'application': r['application'],
    } for r in rows]


class FurnitureCalculateView(APIView):
    """
    POST /api/catalog/furniture/{id}/calculate/
    Body: { "width": "7'0\"", "height": "9'6\"", "depth": "2'0\"",
            "options": {"shelf_type": "ply", "overrides": {"drawers": 5}} }
    Blank sizes fall back to the furniture's defaults. Nothing is saved.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        furniture = get_object_or_404(Furniture, pk=pk)
        data = request.data
        width, height, depth = size_inches(
            data.get('width') or furniture.default_length,
            data.get('height') or furniture.default_height,
            data.get('depth') or furniture.default_breadth,
        )
        rows, calc = breakdown(furniture, width, height, depth, data.get('options') or {})
        payload = serialize_rows(rows)
        return Response({
            'furniture': furniture.id, 'calculation': calc.summary(), 'rows': payload,
            'total_cost': round(sum(r['amount'] for r in payload), 2),
        }, status=status.HTTP_200_OK)


# ── Meta & tree ─────────────────────────────────────────────

UNIT_CHOICES = ['nos', 'sets', 'sft', 'rft', 'Mtr', 'kg', 'slab', 'lengths', 'lot', 'lumpsum']


def _choices(items):
    return [{'value': v, 'label': label} for v, label in items]


class CatalogMetaView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({
            'units': [{'value': u, 'label': u} for u in UNIT_CHOICES],
            'cabinet_types': _choices(CabinetType.choices),
            'item_types': _choices(ItemType.choices),
            'rules': _choices(rules.RULE_CHOICES),
            'spec_rules': list(rules.SPEC_RULES),
            'counts': {
                'rooms': Room.objects.filter(is_active=True).count(),
                'zones': Zone.objects.filter(is_active=True).count(),
                'furniture': Furniture.objects.filter(is_active=True).count(),
                'basic_components': BasicComponent.objects.filter(is_active=True).count(),
            },
        })


class CatalogTreeView(CatalogView, APIView):
    """GET /api/catalog/tree/?room=<id> — rooms, zones and the furniture available in a room."""

    def get(self, request):
        room_id = request.query_params.get('room')
        furniture_qs = _furniture_qs().filter(is_active=True)
        if room_id:
            furniture_qs = furniture_qs.filter(Q(rooms__id=room_id) | Q(rooms__isnull=True)).distinct()
        return Response({
            'rooms': RoomSerializer(Room.objects.filter(is_active=True), many=True).data,
            'zones': ZoneSerializer(Zone.objects.filter(is_active=True), many=True).data,
            'furniture': FurnitureListSerializer(furniture_qs, many=True).data,
        })
