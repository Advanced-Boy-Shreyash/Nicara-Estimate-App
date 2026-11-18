from django.contrib import admin

from .models import BasicComponent, Furniture, FurnitureComponent, Room, Zone


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


@admin.register(BasicComponent)
class BasicComponentAdmin(admin.ModelAdmin):
    list_display = ['name', 'item_type', 'library_category', 'unit', 'quantity_rule', 'gst_pct', 'is_active']
    list_filter = ['item_type', 'quantity_rule', 'is_active']
    search_fields = ['name', 'code']
    readonly_fields = ['code']


class FurnitureComponentInline(admin.TabularInline):
    model = FurnitureComponent
    extra = 0
    autocomplete_fields = ['basic_component']


@admin.register(Furniture)
class FurnitureAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'cabinet_type', 'components_total', 'margin_pct', 'is_active']
    list_filter = ['is_active', 'cabinet_type', 'rooms']
    search_fields = ['name', 'code', 'description']
    readonly_fields = ['code']
    filter_horizontal = ['rooms']
    inlines = [FurnitureComponentInline]
