"""NICARA Component Library — Serializers"""
from rest_framework import serializers
from .models import MaterialCategory, MaterialBrand, MaterialItem, ServiceItem


class MaterialItemSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_id = serializers.IntegerField(source='category.id', read_only=True)
    category_icon = serializers.CharField(source='category.icon', read_only=True)
    product_group = serializers.CharField(source='category.product_group', read_only=True)
    full_display = serializers.CharField(read_only=True)

    class Meta:
        model = MaterialItem
        fields = [
            'id', 'category', 'brand', 'brand_name', 'category_id', 'category_name',
            'category_icon', 'product_group',
            'model_name', 'description', 'weight', 'length', 'thickness',
            'default_unit', 'default_rate', 'gst_pct', 'margin_pct',
            'is_active', 'notes', 'image', 'created_at', 'updated_at',
            'full_display',
        ]


class MaterialBrandSerializer(serializers.ModelSerializer):
    """A brand from the master list, with how many raw materials use it and in which categories."""
    item_count = serializers.SerializerMethodField()
    categories = serializers.SerializerMethodField()

    class Meta:
        model = MaterialBrand
        fields = ['id', 'name', 'website', 'is_active', 'item_count', 'categories']

    def validate_name(self, value):
        value = value.strip()
        clash = MaterialBrand.objects.filter(name__iexact=value)
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError(f'A brand named "{value}" already exists.')
        return value

    def get_item_count(self, obj):
        return obj.items.count()

    def get_categories(self, obj):
        return sorted(set(obj.items.values_list('category__name', flat=True)))


class MaterialCategorySerializer(serializers.ModelSerializer):
    brands = serializers.SerializerMethodField()
    brand_count = serializers.SerializerMethodField()

    class Meta:
        model = MaterialCategory
        fields = '__all__'

    def _brands(self, obj):
        return MaterialBrand.objects.filter(items__category=obj).distinct()

    def get_brands(self, obj):
        return [{'id': b.id, 'name': b.name} for b in self._brands(obj)]

    def get_brand_count(self, obj):
        return self._brands(obj).count()


class MaterialCategoryListSerializer(serializers.ModelSerializer):
    """Lightweight version for list views."""
    brand_count = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = MaterialCategory
        fields = ['id', 'name', 'type', 'icon', 'product_group', 'is_active',
                  'brand_count', 'item_count']

    def get_brand_count(self, obj):
        return MaterialBrand.objects.filter(items__category=obj).distinct().count()

    def get_item_count(self, obj):
        return MaterialItem.objects.filter(category=obj).count()


class ServiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceItem
        fields = '__all__'
