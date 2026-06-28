from django.contrib import admin
from .models import (
    Project, ProjectRoom, EstimateItem, EstimateItemSpec,
    FurnitureLayout, MoodBoard, MoodBoardImage,
    PaymentSchedule, ServiceVendor, ProductVendor, Client,
)


class ProjectRoomInline(admin.TabularInline):
    model = ProjectRoom
    extra = 1


class PaymentInline(admin.TabularInline):
    model = PaymentSchedule
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'client_name', 'city', 'property_type', 'status', 'progress', 'created_at']
    list_filter = ['status', 'city', 'property_type']
    search_fields = ['name', 'client_name', 'project_name']
    inlines = [ProjectRoomInline, PaymentInline]


class EstimateItemSpecInline(admin.TabularInline):
    model = EstimateItemSpec
    extra = 0
    fields = ['category', 'brand', 'model_name', 'specification', 'qty', 'unit', 'rate', 'total']


@admin.register(EstimateItem)
class EstimateItemAdmin(admin.ModelAdmin):
    list_display = ['si_no', 'project', 'area', 'item', 'amount']
    list_filter = ['project', 'area']
    inlines = [EstimateItemSpecInline]


@admin.register(ServiceVendor)
class ServiceVendorAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'contact_person', 'phone', 'rating']
    search_fields = ['name', 'category']


@admin.register(ProductVendor)
class ProductVendorAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'contact_person', 'phone', 'rating']
    search_fields = ['name', 'category']


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'phone', 'project', 'status']
    search_fields = ['name', 'email']


admin.site.register(FurnitureLayout)
admin.site.register(MoodBoard)
