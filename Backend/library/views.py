"""NICARA Component Library — Views"""
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import MaterialCategory, MaterialBrand, MaterialItem, ServiceItem
from .serializers import (
    MaterialCategorySerializer, MaterialCategoryListSerializer,
    MaterialBrandSerializer, MaterialItemSerializer, ServiceItemSerializer,
)

LIBRARY_UNITS = [
    {"value": "nos", "label": "nos"},
    {"value": "set", "label": "set"},
    {"value": "sft", "label": "sft"},
    {"value": "rft", "label": "rft"},
    {"value": "sqm", "label": "sqm"},
    {"value": "sheets", "label": "sheets"},
    {"value": "kg", "label": "kg"},
    {"value": "litre", "label": "litre"},
    {"value": "lot", "label": "lot"},
    {"value": "mtr", "label": "mtr"},
    {"value": "feet", "label": "feet"},
]


class LibraryMetaView(APIView):
    """GET /api/library/meta/ — categories, brands and units for dropdowns."""

    def get(self, request):
        categories = MaterialCategory.objects.filter(is_active=True).values(
            'id', 'name', 'icon', 'type', 'product_group'
        )
        # Brands are one master list; category_ids says where each one has models.
        used = {}
        for brand_id, category_id in MaterialItem.objects.filter(brand__isnull=False).values_list(
                'brand_id', 'category_id').distinct():
            used.setdefault(brand_id, []).append(category_id)
        brands = [{'id': b['id'], 'name': b['name'], 'category_ids': used.get(b['id'], [])}
                  for b in MaterialBrand.objects.filter(is_active=True).values('id', 'name')]
        return Response({
            'categories': list(categories),
            'brands': brands,
            'units': LIBRARY_UNITS,
            'counts': {
                'categories': MaterialCategory.objects.count(),
                'brands': MaterialBrand.objects.count(),
                'items': MaterialItem.objects.count(),
                'services': ServiceItem.objects.count(),
            }
        })


class MaterialCategoryListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/library/categories/"""
    queryset = MaterialCategory.objects.all()
    search_fields = ['name']

    def get_serializer_class(self):
        if self.request.method == 'GET' and 'detail' not in self.request.query_params:
            return MaterialCategoryListSerializer
        return MaterialCategorySerializer


class MaterialCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/library/categories/{id}/"""
    queryset = MaterialCategory.objects.all()
    serializer_class = MaterialCategorySerializer


class MaterialBrandListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/library/brands/ — the brand master list (?category=<id>: brands with a model there)."""
    serializer_class = MaterialBrandSerializer
    search_fields = ['name']

    def get_queryset(self):
        qs = MaterialBrand.objects.all()
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(items__category_id=category).distinct()
        return qs


class MaterialBrandDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = MaterialBrand.objects.all()
    serializer_class = MaterialBrandSerializer

    def perform_destroy(self, instance):
        if instance.items.exists():
            raise ValidationError({'detail': f'"{instance.name}" is used by {instance.items.count()} raw '
                                             'material(s). Reassign or delete them first, or mark the brand inactive.'})
        instance.delete()


class MaterialItemListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/library/items/"""
    queryset = MaterialItem.objects.select_related('category', 'brand').all()
    serializer_class = MaterialItemSerializer
    filterset_fields = ['brand', 'category', 'is_active']
    search_fields = ['model_name', 'brand__name', 'category__name', 'description']
    ordering_fields = ['model_name', 'default_rate', 'created_at']


class MaterialItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = MaterialItem.objects.all()
    serializer_class = MaterialItemSerializer


class SmartEstimateOptionsView(APIView):
    """
    GET /api/library/smart-estimate-options/
    Brands per product group for the Smart Estimate Generator. Only categories
    that estimate rows are priced from (a Basic Component's raw-material
    category) count, so a brand listed here can re-price at least one row type.
    """

    def get(self, request):
        groups = [
            MaterialCategory.ProductGroup.PLYWOOD,
            MaterialCategory.ProductGroup.HARDWARE,
            MaterialCategory.ProductGroup.KITCHEN_ACCESSORIES,
            MaterialCategory.ProductGroup.FINISHING,
        ]
        items = (MaterialItem.objects.filter(
            is_active=True, brand__isnull=False, brand__is_active=True,
            category__is_active=True, category__product_group__in=groups,
            category__basic_components__isnull=False,
        ).select_related('category', 'brand').distinct())
        found = {group: {} for group in groups}
        for item in items:
            entry = found[item.category.product_group].setdefault(item.brand_id, {
                'id': item.brand_id, 'name': item.brand.name, 'categories': set(), 'models': 0,
            })
            entry['categories'].add(item.category.name)
            entry['models'] += 1
        results = {
            group: sorted(({**b, 'categories': sorted(b['categories'])} for b in brands.values()),
                          key=lambda b: b['name'].lower())
            for group, brands in found.items()
        }
        return Response(results)


class ServiceItemListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/library/services/"""
    queryset = ServiceItem.objects.all()
    serializer_class = ServiceItemSerializer
    filterset_fields = ['category', 'is_active']
    search_fields = ['name', 'category']


class ServiceItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ServiceItem.objects.all()
    serializer_class = ServiceItemSerializer
