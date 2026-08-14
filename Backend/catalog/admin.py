from django.contrib import admin

from .models import (
    Furniture, FurniturePart, Material, MaterialOption, PartMaterial, Room, Zone,
)


class MaterialOptionInline(admin.TabularInline):
    model = MaterialOption
    extra = 0


class PartMaterialInline(admin.TabularInline):
    model = PartMaterial
    extra = 0
    autocomplete_fields = ['material', 'default_option']


class FurniturePartInline(admin.TabularInline):
    model = FurniturePart
    extra = 0


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['icon', 'name', 'code', 'sort_order', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name', 'code']
    readonly_fields = ['code']


@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'sort_order', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name', 'code']
    readonly_fields = ['code']


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ['icon', 'name', 'code', 'default_unit', 'options_total', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name', 'code']
    readonly_fields = ['code']
    inlines = [MaterialOptionInline]


@admin.register(MaterialOption)
class MaterialOptionAdmin(admin.ModelAdmin):
    list_display = ['detail', 'material', 'brand', 'model_no', 'size', 'price', 'unit', 'is_active']
    list_filter = ['material', 'brand', 'is_active']
    search_fields = ['detail', 'brand', 'model_no']


@admin.register(Furniture)
class FurnitureAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'default_unit', 'parts_total', 'base_rate', 'is_active']
    list_filter = ['is_active', 'rooms']
    search_fields = ['name', 'code', 'description']
    readonly_fields = ['code', 'material_cost', 'suggested_rate']
    filter_horizontal = ['rooms']
    inlines = [FurniturePartInline]


@admin.register(FurniturePart)
class FurniturePartAdmin(admin.ModelAdmin):
    list_display = ['name', 'furniture', 'sort_order', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name', 'furniture__name']
    inlines = [PartMaterialInline]
