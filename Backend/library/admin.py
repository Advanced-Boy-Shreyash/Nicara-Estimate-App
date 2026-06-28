from django.contrib import admin
from .models import MaterialCategory, MaterialBrand, MaterialItem, ServiceItem


class MaterialBrandInline(admin.TabularInline):
    model = MaterialBrand
    extra = 1


class MaterialItemInline(admin.TabularInline):
    model = MaterialItem
    extra = 0
    fields = ['model_name', 'default_unit', 'default_rate', 'gst_pct', 'margin_pct', 'is_active']


@admin.register(MaterialCategory)
class MaterialCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'type', 'icon', 'is_active', 'sort_order']
    list_filter = ['type', 'is_active']
    inlines = [MaterialBrandInline]


@admin.register(MaterialBrand)
class MaterialBrandAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'is_active']
    list_filter = ['category', 'is_active']
    inlines = [MaterialItemInline]


@admin.register(MaterialItem)
class MaterialItemAdmin(admin.ModelAdmin):
    list_display = ['model_name', 'brand', 'default_unit', 'default_rate', 'gst_pct', 'is_active']
    list_filter = ['brand__category', 'is_active']
    search_fields = ['model_name', 'brand__name']


@admin.register(ServiceItem)
class ServiceItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'sub_type', 'default_unit', 'default_rate']
    list_filter = ['category']
    search_fields = ['name', 'category']
