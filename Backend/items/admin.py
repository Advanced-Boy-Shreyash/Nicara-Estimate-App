from django.contrib import admin

from .models import Item, ItemCategory, ItemComponent


class ItemComponentInline(admin.TabularInline):
    model = ItemComponent
    extra = 0
    autocomplete_fields = ['material_item', 'service_item']


@admin.register(ItemCategory)
class ItemCategoryAdmin(admin.ModelAdmin):
    list_display = ['icon', 'name', 'code', 'sort_order', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name', 'code']
    readonly_fields = ['code']


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'category', 'default_room', 'unit',
                    'default_rate', 'gst_pct', 'is_active']
    list_filter = ['category', 'unit', 'calc_method', 'is_active']
    search_fields = ['name', 'code', 'description', 'default_room']
    readonly_fields = ['code', 'created_at', 'updated_at', 'component_cost', 'suggested_rate']
    inlines = [ItemComponentInline]

    fieldsets = (
        ('Identity', {'fields': ('code', 'name', 'category', 'description', 'default_room')}),
        ('Defaults for estimate lines', {'fields': (
            'unit', 'calc_method', 'default_length', 'default_breadth',
            'default_height', 'default_qty', 'default_rate',
        )}),
        ('Pricing', {'fields': ('min_rate', 'max_rate', 'gst_pct', 'margin_pct',
                                'component_cost', 'suggested_rate')}),
        ('Other', {'fields': ('image', 'notes', 'sort_order', 'is_active',
                              'created_at', 'updated_at')}),
    )


@admin.register(ItemComponent)
class ItemComponentAdmin(admin.ModelAdmin):
    list_display = ['item', 'display_name', 'component_type', 'qty_per_unit', 'unit', 'wastage_pct']
    list_filter = ['component_type']
    search_fields = ['item__name', 'label']
