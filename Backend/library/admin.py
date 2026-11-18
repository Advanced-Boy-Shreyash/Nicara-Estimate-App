from django.contrib import admin
from .models import MaterialCategory, MaterialBrand, MaterialItem, ServiceItem


class MaterialItemInline(admin.TabularInline):
    model = MaterialItem
    extra = 0
    fields = ['category', 'model_name', 'default_unit', 'default_rate', 'gst_pct', 'margin_pct', 'is_active']


@admin.register(MaterialCategory)
class MaterialCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'type', 'product_group', 'is_active', 'sort_order']
    list_filter = ['type', 'product_group', 'is_active']


@admin.register(MaterialBrand)
class MaterialBrandAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name']
    inlines = [MaterialItemInline]


@admin.register(MaterialItem)
class MaterialItemAdmin(admin.ModelAdmin):
    list_display = ['model_name', 'brand', 'category', 'default_unit', 'default_rate', 'gst_pct', 'is_active']
    list_filter = ['category', 'brand', 'is_active']
    search_fields = ['model_name', 'brand__name', 'category__name']


@admin.register(ServiceItem)
class ServiceItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'sub_type', 'default_unit', 'default_rate']
    list_filter = ['category']
    search_fields = ['name', 'category']
