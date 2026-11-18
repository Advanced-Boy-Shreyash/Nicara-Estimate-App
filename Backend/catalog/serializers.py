"""NICARA Catalogue — Serializers"""
from rest_framework import serializers

from .models import BasicComponent, Furniture, FurnitureComponent, Room, Zone
from .rules import RULE_KEYS


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


# ── Basic components ────────────────────────────────────────

class BasicComponentSerializer(serializers.ModelSerializer):
    library_category_name = serializers.CharField(source='library_category.name', read_only=True,
                                                  default='')
    used_in = serializers.SerializerMethodField()

    class Meta:
        model = BasicComponent
        fields = ['id', 'code', 'name', 'item_type', 'library_category', 'library_category_name',
                  'unit', 'price_unit', 'quantity_rule', 'default_qty', 'fallback_rate', 'gst_pct',
                  'description', 'used_in', 'sort_order', 'is_active']
        read_only_fields = ['code']

    def get_used_in(self, obj):
        return obj.furniture_links.filter(is_active=True).count()

    def validate_quantity_rule(self, value):
        if value not in RULE_KEYS:
            raise serializers.ValidationError(f'Unknown rule "{value}".')
        return value


# ── Furniture & its components ──────────────────────────────

class FurnitureComponentSerializer(serializers.ModelSerializer):
    basic_component_name = serializers.CharField(source='basic_component.name', read_only=True)
    item_type = serializers.CharField(source='basic_component.item_type', read_only=True)
    quantity_rule = serializers.CharField(source='basic_component.quantity_rule', read_only=True)
    unit = serializers.CharField(source='basic_component.unit', read_only=True)
    library_category = serializers.IntegerField(source='basic_component.library_category_id',
                                                read_only=True)
    default_material_label = serializers.SerializerMethodField()
    rate = serializers.SerializerMethodField()

    class Meta:
        model = FurnitureComponent
        fields = ['id', 'furniture', 'basic_component', 'basic_component_name', 'item_type',
                  'quantity_rule', 'unit', 'library_category', 'default_material',
                  'default_material_label', 'rate', 'fixed_qty', 'application',
                  'sort_order', 'is_active']
        read_only_fields = ['furniture']

    def get_default_material_label(self, obj):
        m = obj.default_material
        return str(m) if m else ''

    def get_rate(self, obj):
        from .pricing import price_for
        _, rate = price_for(obj.basic_component, obj.default_material)
        return float(rate)

    def validate(self, data):
        material = data.get('default_material', getattr(self.instance, 'default_material', None))
        component = data.get('basic_component', getattr(self.instance, 'basic_component', None))
        if material and component and component.library_category_id \
                and material.category_id != component.library_category_id:
            raise serializers.ValidationError(
                {'default_material': f'Pick a {component.library_category.name} raw material.'})
        return data


class FurnitureListSerializer(serializers.ModelSerializer):
    room_names = serializers.SerializerMethodField()
    cabinet_type_display = serializers.CharField(source='get_cabinet_type_display', read_only=True)
    component_count = serializers.SerializerMethodField()

    class Meta:
        model = Furniture
        fields = ['id', 'code', 'name', 'description', 'rooms', 'room_names', 'cabinet_type',
                  'cabinet_type_display', 'default_length', 'default_breadth', 'default_height',
                  'margin_pct', 'gst_pct', 'component_count', 'sort_order', 'is_active']

    def get_room_names(self, obj):
        return [r.name for r in obj.rooms.all()]

    def get_component_count(self, obj):
        value = getattr(obj, 'component_count', None)
        return value if value is not None else obj.components.filter(is_active=True).count()


class FurnitureSerializer(FurnitureListSerializer):
    components = FurnitureComponentSerializer(many=True, read_only=True)

    class Meta(FurnitureListSerializer.Meta):
        fields = FurnitureListSerializer.Meta.fields + ['default_unit', 'components',
                                                        'created_at', 'updated_at']
        read_only_fields = ['code', 'created_at', 'updated_at']
