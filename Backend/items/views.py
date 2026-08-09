"""
NICARA Items — Views

    /api/items/categories/           list / create categories
    /api/items/categories/{id}/      retrieve / update / delete
    /api/items/                      catalogue (?category=&search=&room=)
    /api/items/{id}/                 retrieve / update / deactivate
    /api/items/{id}/components/      bill of materials
    /api/items/meta/                 choice lists for the item form
"""
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import HasModulePermission

from .models import Item, ItemCategory, ItemComponent
from .serializers import (
    ItemCategorySerializer, ItemComponentSerializer,
    ItemListSerializer, ItemSerializer,
)


def _items_module(cls):
    """Gate a view behind the `items` module in the IAM matrix."""
    cls.permission_classes = [HasModulePermission]
    cls.module = 'items'
    return cls


@_items_module
class ItemCategoryListCreateView(generics.ListCreateAPIView):
    queryset = ItemCategory.objects.all()
    serializer_class = ItemCategorySerializer
    filterset_fields = ['is_active']
    search_fields = ['name', 'code']


@_items_module
class ItemCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ItemCategory.objects.all()
    serializer_class = ItemCategorySerializer


@_items_module
class ItemListCreateView(generics.ListCreateAPIView):
    """GET /api/items/ — catalogue, POST — add an item."""
    queryset = Item.objects.select_related('category').all()
    filterset_fields = ['category', 'unit', 'calc_method', 'is_active', 'default_room']
    search_fields = ['name', 'code', 'description', 'default_room', 'category__name']
    ordering_fields = ['name', 'default_rate', 'created_at', 'sort_order']

    def get_serializer_class(self):
        return ItemSerializer if self.request.method == 'POST' else ItemListSerializer


@_items_module
class ItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Item.objects.select_related('category').prefetch_related(
        'components__material_item', 'components__service_item'
    )
    serializer_class = ItemSerializer

    def perform_destroy(self, instance):
        # Historical estimate lines point here — retire rather than delete.
        instance.is_active = False
        instance.save(update_fields=['is_active'])


@_items_module
class ItemComponentListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/items/{item_id}/components/"""
    serializer_class = ItemComponentSerializer

    def get_queryset(self):
        return ItemComponent.objects.filter(item_id=self.kwargs['item_id'])

    def perform_create(self, serializer):
        serializer.save(item_id=self.kwargs['item_id'])


@_items_module
class ItemComponentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ItemComponentSerializer

    def get_queryset(self):
        return ItemComponent.objects.filter(item_id=self.kwargs['item_id'])


class ItemMetaView(APIView):
    """GET /api/items/meta/ — choice lists and the distinct room list."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        def choices(source):
            return [{'value': v, 'label': l} for v, l in source]

        rooms = (Item.objects
                 .exclude(default_room='')
                 .values_list('default_room', flat=True)
                 .distinct()
                 .order_by('default_room'))

        return Response({
            'units': choices(Item.Unit.choices),
            'calc_methods': choices(Item.CalcMethod.choices),
            'component_types': choices(ItemComponent.ComponentType.choices),
            'rooms': list(rooms),
            'categories': ItemCategorySerializer(
                ItemCategory.objects.filter(is_active=True), many=True
            ).data,
            'counts': {
                'items': Item.objects.filter(is_active=True).count(),
                'categories': ItemCategory.objects.filter(is_active=True).count(),
            },
        })
