"""NICARA Catalogue — Serializers"""
from rest_framework import serializers

from .models import (
    Furniture, FurnitureItemComponent, FurniturePart, Material, MaterialOption,
    PartMaterial, Room, Zone,
)


# ── Rooms & Zones ───────────────────────────────────────────

class RoomSerializer(serializers.ModelSerializer):
    furniture_count = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = ['id', 'code', 'name', 'icon', 'description',
                  'sort_order', 'is_active', 'furniture_count']
        read_only_fields = ['code']

    def get_furniture_count(self, obj):
        return obj.furniture.filter(is_active=True).count()


class ZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Zone
        fields = ['id', 'code', 'name', 'sort_order', 'is_active']
        read_only_fields = ['code']


# ── Materials & options ─────────────────────────────────────

class MaterialOptionSerializer(serializers.ModelSerializer):
    label = serializers.CharField(read_only=True)
    material_name = serializers.CharField(source='material.name', read_only=True)
    effective_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = MaterialOption
        fields = ['id', 'material', 'material_name', 'detail', 'brand', 'model_no',
                  'size', 'price', 'unit', 'notes', 'source', 'library_item', 'label',
                  'effective_price', 'sort_order', 'is_active']
        read_only_fields = ['material']

    def validate_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Price cannot be negative.')
        return value

    def _sync_library_item(self, instance):
        instance.sync_library_item()

    def create(self, validated_data):
        instance = super().create(validated_data)
        self._sync_library_item(instance)
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        self._sync_library_item(instance)
        return instance


def _annotated_or(obj, annotation_attr, live):
    """Prefer a queryset annotation; fall back to a live count on a bare instance."""
    value = getattr(obj, annotation_attr, None)
    return value if value is not None else live()


class MaterialSerializer(serializers.ModelSerializer):
    option_count = serializers.SerializerMethodField()
    options = MaterialOptionSerializer(many=True, read_only=True)
    price_from = serializers.SerializerMethodField()

    class Meta:
        model = Material
        fields = ['id', 'code', 'name', 'library_category', 'default_unit', 'icon', 'option_count',
                  'price_from', 'options', 'sort_order', 'is_active']
        read_only_fields = ['code']

    def get_option_count(self, obj):
        return _annotated_or(obj, 'option_count', obj.options.count)

    def get_price_from(self, obj):
        cheapest = min(
            obj.options.filter(is_active=True).select_related('library_item'),
            key=lambda option: option.effective_price,
            default=None,
        )
        return float(cheapest.effective_price) if cheapest else None

    def create(self, validated_data):
        instance = super().create(validated_data)
        instance.ensure_library_category()
        return instance


class MaterialListSerializer(serializers.ModelSerializer):
    """Lighter row without the nested options."""
    option_count = serializers.SerializerMethodField()

    class Meta:
        model = Material
        fields = ['id', 'code', 'name', 'library_category', 'default_unit', 'icon',
                  'option_count', 'sort_order', 'is_active']

    def get_option_count(self, obj):
        return _annotated_or(obj, 'option_count', obj.options.count)


class FurnitureItemComponentSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_code = serializers.CharField(source='item.code', read_only=True)
    item_cost = serializers.DecimalField(
        source='item.component_cost', max_digits=14, decimal_places=2, read_only=True,
    )
    line_cost = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = FurnitureItemComponent
        fields = ['id', 'furniture', 'item', 'item_name', 'item_code',
                  'qty_per_unit', 'notes', 'item_cost', 'line_cost',
                  'sort_order', 'is_active']
        read_only_fields = ['furniture']

    def validate_item(self, value):
        furniture = self.context.get('furniture')
        if furniture:
            def reaches_target(item, target_id, visited_items, visited_furniture):
                if item.pk in visited_items:
                    return False
                visited_items.add(item.pk)
                linked_furniture_id = item.catalog_furniture_id
                if not linked_furniture_id:
                    return False
                if linked_furniture_id == target_id:
                    return True
                if linked_furniture_id in visited_furniture:
                    return False
                visited_furniture.add(linked_furniture_id)
                nested = FurnitureItemComponent.objects.filter(
                    furniture_id=linked_furniture_id,
                ).select_related('item')
                return any(
                    reaches_target(component.item, target_id, visited_items, visited_furniture)
                    for component in nested
                )

            if reaches_target(value, furniture.id, set(), set()):
                raise serializers.ValidationError(
                    'Furniture composition cannot create a circular item dependency.'
                )
        return value


# ── Furniture → parts → materials ───────────────────────────

class PartMaterialSerializer(serializers.ModelSerializer):
    material_name = serializers.CharField(source='material.name', read_only=True)
    option_label = serializers.SerializerMethodField()
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    line_cost = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = PartMaterial
        fields = ['id', 'part', 'material', 'material_name', 'default_option',
                  'option_label', 'qty_per_unit', 'unit', 'wastage_pct',
                  'unit_price', 'line_cost', 'notes', 'sort_order']
        read_only_fields = ['part']

    def get_option_label(self, obj):
        option = obj.effective_option
        return option.label if option else ''

    def validate(self, data):
        option = data.get('default_option')
        material = data.get('material') or getattr(self.instance, 'material', None)
        if option and material and option.material_id != material.id:
            raise serializers.ValidationError(
                {'default_option': 'That option belongs to a different material.'}
            )
        return data


class FurniturePartSerializer(serializers.ModelSerializer):
    materials = PartMaterialSerializer(many=True, read_only=True)
    material_cost = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = FurniturePart
        fields = ['id', 'furniture', 'name', 'notes', 'materials',
                  'material_cost', 'sort_order', 'is_active']
        read_only_fields = ['furniture']


class FurnitureListSerializer(serializers.ModelSerializer):
    room_names = serializers.SerializerMethodField()
    part_count = serializers.SerializerMethodField()

    class Meta:
        model = Furniture
        fields = ['id', 'code', 'name', 'description', 'rooms', 'room_names',
                  'default_unit', 'base_rate', 'gst_pct', 'margin_pct',
                  'part_count', 'sort_order', 'is_active']

    def get_room_names(self, obj):
        return [r.name for r in obj.rooms.all()]

    def get_part_count(self, obj):
        return _annotated_or(obj, 'part_count', obj.parts.count)


class FurnitureSerializer(serializers.ModelSerializer):
    room_names = serializers.SerializerMethodField()
    parts = FurniturePartSerializer(many=True, read_only=True)
    item_components = FurnitureItemComponentSerializer(many=True, read_only=True)
    part_count = serializers.SerializerMethodField()
    material_cost = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    suggested_rate = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Furniture
        fields = '__all__'
        read_only_fields = ['code', 'created_at', 'updated_at']

    def get_room_names(self, obj):
        return [r.name for r in obj.rooms.all()]

    def get_part_count(self, obj):
        return _annotated_or(obj, 'part_count', obj.parts.count)
