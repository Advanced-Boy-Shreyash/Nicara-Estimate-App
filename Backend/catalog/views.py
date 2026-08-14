"""
NICARA Catalogue — Views  (mounted at /api/catalog/, module 'catalog')

    rooms/                 room types
    zones/                 room zones (walls, areas)
    materials/             material types  (?with_options=1 nests the options)
    materials/{id}/options/    priced options for a material
    furniture/             furniture products  (?room=<id> scopes to a room)
    furniture/{id}/parts/      build elements
    furniture/parts/{id}/materials/   BOM lines for a part
    meta/                  units + counts for the forms
    tree/                  the whole hierarchy for a drill-down UI
"""
from django.db.models import Count, Q
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import HasModulePermission

from .models import (
    Furniture, FurniturePart, Material, MaterialOption, PartMaterial, Room, Zone,
)
from .serializers import (
    FurnitureListSerializer, FurniturePartSerializer, FurnitureSerializer,
    MaterialListSerializer, MaterialOptionSerializer, MaterialSerializer,
    PartMaterialSerializer, RoomSerializer, ZoneSerializer,
)

MODULE = 'catalog'


class CatalogView:
    """Mixin — every catalogue endpoint is gated on the `catalog` module."""
    permission_classes = [HasModulePermission]
    module = MODULE


# ── Rooms ───────────────────────────────────────────────────

class RoomListCreateView(CatalogView, generics.ListCreateAPIView):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    filterset_fields = ['is_active']
    search_fields = ['name', 'code']


class RoomDetailView(CatalogView, generics.RetrieveUpdateDestroyAPIView):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])


# ── Zones ───────────────────────────────────────────────────

class ZoneListCreateView(CatalogView, generics.ListCreateAPIView):
    queryset = Zone.objects.all()
    serializer_class = ZoneSerializer
    filterset_fields = ['is_active']
    search_fields = ['name', 'code']


class ZoneDetailView(CatalogView, generics.RetrieveUpdateDestroyAPIView):
    queryset = Zone.objects.all()
    serializer_class = ZoneSerializer

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])


# ── Materials & options ─────────────────────────────────────

class MaterialListCreateView(CatalogView, generics.ListCreateAPIView):
    filterset_fields = ['is_active']
    search_fields = ['name', 'code']

    def get_queryset(self):
        qs = Material.objects.annotate(
            option_count=Count('options', filter=Q(options__is_active=True))
        )
        if self.request.query_params.get('with_options'):
            qs = qs.prefetch_related('options')
        return qs

    def get_serializer_class(self):
        # Nest options on request; otherwise return the light row.
        if self.request.method == 'POST' or self.request.query_params.get('with_options'):
            return MaterialSerializer
        return MaterialListSerializer


class MaterialDetailView(CatalogView, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MaterialSerializer

    def get_queryset(self):
        return Material.objects.annotate(
            option_count=Count('options', filter=Q(options__is_active=True))
        ).prefetch_related('options')

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])


class MaterialOptionListCreateView(CatalogView, generics.ListCreateAPIView):
    serializer_class = MaterialOptionSerializer

    def get_queryset(self):
        return MaterialOption.objects.filter(material_id=self.kwargs['material_id'])

    def perform_create(self, serializer):
        serializer.save(material_id=self.kwargs['material_id'])


class MaterialOptionDetailView(CatalogView, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MaterialOptionSerializer

    def get_queryset(self):
        return MaterialOption.objects.filter(material_id=self.kwargs['material_id'])


# ── Furniture → parts → materials ───────────────────────────

class FurnitureListCreateView(CatalogView, generics.ListCreateAPIView):
    filterset_fields = ['is_active', 'rooms']
    search_fields = ['name', 'code', 'description']

    def get_queryset(self):
        qs = (Furniture.objects
              .annotate(part_count=Count('parts', filter=Q(parts__is_active=True)))
              .prefetch_related('rooms'))
        # ?room=<id> → furniture linked to that room, plus universal furniture
        # (no rooms set), matching "kitchen furniture only shows for kitchen".
        room = self.request.query_params.get('room')
        if room:
            qs = qs.filter(Q(rooms__id=room) | Q(rooms__isnull=True)).distinct()
        return qs

    def get_serializer_class(self):
        return FurnitureSerializer if self.request.method == 'POST' else FurnitureListSerializer


class FurnitureDetailView(CatalogView, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FurnitureSerializer

    def get_queryset(self):
        return (Furniture.objects
                .annotate(part_count=Count('parts', filter=Q(parts__is_active=True)))
                .prefetch_related('rooms', 'parts__materials__material'))

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])


class FurniturePartListCreateView(CatalogView, generics.ListCreateAPIView):
    serializer_class = FurniturePartSerializer

    def get_queryset(self):
        return FurniturePart.objects.filter(
            furniture_id=self.kwargs['furniture_id']
        ).prefetch_related('materials__material')

    def perform_create(self, serializer):
        serializer.save(furniture_id=self.kwargs['furniture_id'])


class FurniturePartDetailView(CatalogView, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FurniturePartSerializer
    queryset = FurniturePart.objects.all()


class PartMaterialListCreateView(CatalogView, generics.ListCreateAPIView):
    serializer_class = PartMaterialSerializer

    def get_queryset(self):
        return PartMaterial.objects.filter(
            part_id=self.kwargs['part_id']
        ).select_related('material', 'default_option')

    def perform_create(self, serializer):
        serializer.save(part_id=self.kwargs['part_id'])


class PartMaterialDetailView(CatalogView, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PartMaterialSerializer
    queryset = PartMaterial.objects.all()


# ── Meta & tree ─────────────────────────────────────────────

UNIT_CHOICES = ['nos', 'set', 'sft', 'rft', 'sqm', 'sheets', 'kg', 'litre', 'lot', 'lumpsum']


class CatalogMetaView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({
            'units': [{'value': u, 'label': u} for u in UNIT_CHOICES],
            'counts': {
                'rooms': Room.objects.filter(is_active=True).count(),
                'zones': Zone.objects.filter(is_active=True).count(),
                'furniture': Furniture.objects.filter(is_active=True).count(),
                'materials': Material.objects.filter(is_active=True).count(),
                'options': MaterialOption.objects.filter(is_active=True).count(),
            },
        })


class CatalogTreeView(CatalogView, APIView):
    """
    GET /api/catalog/tree/?room=<id>
    The whole hierarchy in one call, for a drill-down UI: rooms, zones, and the
    furniture (with parts → materials) available in the chosen room.
    """
    def get(self, request):
        room_id = request.query_params.get('room')

        furniture_qs = Furniture.objects.filter(is_active=True).prefetch_related(
            'rooms', 'parts__materials__material', 'parts__materials__default_option'
        )
        if room_id:
            furniture_qs = furniture_qs.filter(
                Q(rooms__id=room_id) | Q(rooms__isnull=True)
            ).distinct()

        return Response({
            'rooms': RoomSerializer(Room.objects.filter(is_active=True), many=True).data,
            'zones': ZoneSerializer(Zone.objects.filter(is_active=True), many=True).data,
            'furniture': FurnitureSerializer(furniture_qs, many=True).data,
        })
