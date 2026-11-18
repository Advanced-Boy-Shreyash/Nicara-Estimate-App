"""NICARA Items — Serializers"""
from rest_framework import serializers

from .models import Item, ItemCategory, ItemComponent, dimension_in_feet


class ItemComponentSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)
    effective_rate = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    line_cost = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = ItemComponent
        fields = [
            'id', 'item', 'component_type', 'material_item', 'service_item',
            'label', 'display_name', 'qty_per_unit', 'quantity_basis', 'unit', 'rate_override',
            'effective_rate', 'wastage_pct', 'line_cost', 'notes', 'sort_order',
        ]
        read_only_fields = ['item']

    def validate(self, data):
        material = data.get('material_item') or getattr(self.instance, 'material_item', None)
        service = data.get('service_item') or getattr(self.instance, 'service_item', None)
        label = data.get('label') or getattr(self.instance, 'label', '')
        if material and service:
            raise serializers.ValidationError(
                'Link either a material or a service, not both.'
            )
        if not material and not service and not label:
            raise serializers.ValidationError(
                'Give the component a library link or a label.'
            )
        basis = data.get(
            'quantity_basis',
            getattr(self.instance, 'quantity_basis', ItemComponent.QuantityBasis.PER_UNIT),
        )
        if basis != ItemComponent.QuantityBasis.PER_UNIT:
            item = self.instance.item if self.instance else Item.objects.get(
                pk=self.context['view'].kwargs['item_id'],
            )
            dimensions = {
                'length': [item.default_length],
                'length': [item.default_length],
                'area': [item.default_length, item.default_height],
                'plan_area': [item.default_length, item.default_breadth],
                'volume': [item.default_length, item.default_breadth, item.default_height],
            }[basis]
            try:
                resolved = [dimension_in_feet(value) for value in dimensions]
            except ValueError as exc:
                raise serializers.ValidationError({'quantity_basis': str(exc)}) from exc
            if any(value <= 0 for value in resolved):
                raise serializers.ValidationError({
                    'quantity_basis': 'Set the item dimensions required by this quantity basis first.',
                })
        return data


class ItemCategorySerializer(serializers.ModelSerializer):
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = ItemCategory
        fields = ['id', 'name', 'code', 'icon', 'description',
                  'sort_order', 'is_active', 'item_count']
        read_only_fields = ['code']

    def get_item_count(self, obj):
        return obj.items.filter(is_active=True).count()


class ItemListSerializer(serializers.ModelSerializer):
    """Compact row for catalogue tables and estimate-builder pickers."""
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_icon = serializers.CharField(source='category.icon', read_only=True)
    unit_display = serializers.CharField(source='get_unit_display', read_only=True)
    catalog_furniture_name = serializers.CharField(source='catalog_furniture.name',
                                                    read_only=True, default='')
    component_cost = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Item
        fields = [
            'id', 'code', 'name', 'category', 'category_name', 'category_icon',
            'description', 'default_room', 'unit', 'unit_display', 'calc_method',
            'default_length', 'default_breadth', 'default_height',
            'default_qty', 'default_rate', 'min_rate', 'max_rate',
            'gst_pct', 'margin_pct', 'is_active',
            'catalog_furniture', 'catalog_furniture_name', 'component_cost',
        ]


class ItemSerializer(serializers.ModelSerializer):
    """Full item record including its bill of materials."""
    category_name = serializers.CharField(source='category.name', read_only=True)
    unit_display = serializers.CharField(source='get_unit_display', read_only=True)
    calc_method_display = serializers.CharField(source='get_calc_method_display', read_only=True)
    catalog_furniture_name = serializers.CharField(source='catalog_furniture.name',
                                                    read_only=True, default='')
    components = ItemComponentSerializer(many=True, read_only=True)
    component_cost = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    suggested_rate = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    # Optional so the inline "+ Add" quick-create can save a bare name; a
    # 'General' category is assigned on create when none is supplied.
    category = serializers.PrimaryKeyRelatedField(
        queryset=ItemCategory.objects.all(), required=False, allow_null=True)

    class Meta:
        model = Item
        fields = '__all__'
        read_only_fields = ['code', 'created_at', 'updated_at']

    def validate(self, data):
        min_rate = data.get('min_rate', getattr(self.instance, 'min_rate', 0)) or 0
        max_rate = data.get('max_rate', getattr(self.instance, 'max_rate', 0)) or 0
        if max_rate and min_rate > max_rate:
            raise serializers.ValidationError(
                {'min_rate': 'Minimum rate cannot exceed the maximum rate.'}
            )
        if self.instance:
            dimensions = {
                'length': data.get('default_length', self.instance.default_length),
                'breadth': data.get('default_breadth', self.instance.default_breadth),
                'height': data.get('default_height', self.instance.default_height),
            }
            bases = self.instance.components.values_list('quantity_basis', flat=True)
            for basis in set(bases):
                required = {
                    ItemComponent.QuantityBasis.LENGTH: ('length',),
                    ItemComponent.QuantityBasis.AREA: ('length', 'height'),
                    ItemComponent.QuantityBasis.PLAN_AREA: ('length', 'breadth'),
                    ItemComponent.QuantityBasis.VOLUME: ('length', 'breadth', 'height'),
                }.get(basis, ())
                try:
                    resolved = [dimension_in_feet(dimensions[name]) for name in required]
                except ValueError as exc:
                    raise serializers.ValidationError({'dimensions': str(exc)}) from exc
                if any(value <= 0 for value in resolved):
                    raise serializers.ValidationError({
                        'dimensions': f'Dimensions required by the {basis.replace("_", " ")} BOM are missing.',
                    })
        return data

    def create(self, validated_data):
        if not validated_data.get('category'):
            validated_data['category'], _ = ItemCategory.objects.get_or_create(
                name='General', defaults={'icon': '📦', 'sort_order': 999})
        return super().create(validated_data)


class AddItemsToEstimateSerializer(serializers.Serializer):
    """Payload for pushing catalogue items onto an estimate."""
    items = serializers.ListField(child=serializers.DictField(), allow_empty=False)

    def validate_items(self, value):
        for entry in value:
            if 'item_id' not in entry:
                raise serializers.ValidationError('Each entry needs an item_id.')
        return value
