"""NICARA Component Library — Serializers"""
from rest_framework import serializers
from .models import MaterialCategory, MaterialBrand, MaterialItem, ServiceItem


class MaterialItemSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.name', read_only=True)
    category_name = serializers.CharField(source='brand.category.name', read_only=True)
    full_display = serializers.CharField(read_only=True)

    class Meta:
        model = MaterialItem
        fields = '__all__'


class MaterialBrandSerializer(serializers.ModelSerializer):
    items = MaterialItemSerializer(many=True, read_only=True)
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = MaterialBrand
        fields = '__all__'

    def get_item_count(self, obj):
        return obj.items.count()


class MaterialCategorySerializer(serializers.ModelSerializer):
    brands = MaterialBrandSerializer(many=True, read_only=True)
    brand_count = serializers.SerializerMethodField()

    class Meta:
        model = MaterialCategory
        fields = '__all__'

    def get_brand_count(self, obj):
        return obj.brands.count()


class MaterialCategoryListSerializer(serializers.ModelSerializer):
    """Lightweight version for list views."""
    brand_count = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = MaterialCategory
        fields = ['id', 'name', 'type', 'icon', 'is_active', 'brand_count', 'item_count']

    def get_brand_count(self, obj):
        return obj.brands.count()

    def get_item_count(self, obj):
        return MaterialItem.objects.filter(brand__category=obj).count()


class ServiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceItem
        fields = '__all__'
