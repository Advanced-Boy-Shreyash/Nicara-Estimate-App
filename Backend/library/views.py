"""NICARA Component Library — Views"""
from rest_framework import generics
from .models import MaterialCategory, MaterialBrand, MaterialItem, ServiceItem
from .serializers import (
    MaterialCategorySerializer, MaterialCategoryListSerializer,
    MaterialBrandSerializer, MaterialItemSerializer, ServiceItemSerializer,
)


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
    """GET/POST /api/library/brands/"""
    queryset = MaterialBrand.objects.all()
    serializer_class = MaterialBrandSerializer
    filterset_fields = ['category']
    search_fields = ['name']


class MaterialBrandDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = MaterialBrand.objects.all()
    serializer_class = MaterialBrandSerializer


class MaterialItemListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/library/items/"""
    queryset = MaterialItem.objects.select_related('brand__category').all()
    serializer_class = MaterialItemSerializer
    filterset_fields = ['brand', 'brand__category', 'is_active']
    search_fields = ['model_name', 'brand__name', 'brand__category__name']
    ordering_fields = ['model_name', 'default_rate', 'created_at']


class MaterialItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = MaterialItem.objects.all()
    serializer_class = MaterialItemSerializer


class ServiceItemListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/library/services/"""
    queryset = ServiceItem.objects.all()
    serializer_class = ServiceItemSerializer
    filterset_fields = ['category', 'is_active']
    search_fields = ['name', 'category']


class ServiceItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ServiceItem.objects.all()
    serializer_class = ServiceItemSerializer
