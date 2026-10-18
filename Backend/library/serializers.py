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

    def validate(self, data):
        brand = data.get('brand', getattr(self.instance, 'brand', None))
        category = data.get('category', getattr(self.instance, 'category', None))
        if brand and category and brand.category_id != category.id:
            raise serializers.ValidationError(
                {'brand': 'The selected brand must belong to the selected category.'}
            )
        if not category and brand:
            data['category'] = brand.category
        elif not category:
            raise serializers.ValidationError({'category': 'A material category is required.'})
        return data

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
        fields = ['id', 'name', 'type', 'icon', 'product_group', 'is_active',
                  'brand_count', 'item_count']

    def get_brand_count(self, obj):
        return obj.brands.count()

    def get_item_count(self, obj):
        return MaterialItem.objects.filter(category=obj).count()


class ServiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceItem
        fields = '__all__'
