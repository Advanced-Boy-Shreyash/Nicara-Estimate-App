"""
NICARA Projects — Admin Configuration
"""
from django.contrib import admin
from .models import (
    Project, DesignRequirement, ProjectDeliverable, Estimate, EstimateItem,
    Measurement, MaterialSelection, ExecutionStage, PaymentMilestone,
    QualityCheck, Vendor,
)


class DesignRequirementInline(admin.TabularInline):
    model = DesignRequirement
    extra = 0


class PaymentMilestoneInline(admin.TabularInline):
    model = PaymentMilestone
    extra = 0


class ExecutionStageInline(admin.TabularInline):
    model = ExecutionStage
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'client_name', 'stage', 'progress', 'city', 'budget', 'start_date', 'target_date']
    list_filter = ['stage', 'city', 'project_type', 'purpose']
    search_fields = ['name', 'client_name', 'developer']
    inlines = [DesignRequirementInline, PaymentMilestoneInline, ExecutionStageInline]


@admin.register(DesignRequirement)
class DesignRequirementAdmin(admin.ModelAdmin):
    list_display = ['project', 'room', 'unit', 'finishing', 'design_required']
    list_filter = ['project', 'room']


@admin.register(ProjectDeliverable)
class ProjectDeliverableAdmin(admin.ModelAdmin):
    list_display = ['project', 'type', 'version', 'status', 'uploaded_by', 'date']
    list_filter = ['type', 'status']


class EstimateItemInline(admin.TabularInline):
    model = EstimateItem
    extra = 0


@admin.register(Estimate)
class EstimateAdmin(admin.ModelAdmin):
    list_display = ['project', 'type', 'version', 'status', 'created_at']
    list_filter = ['type', 'status']
    inlines = [EstimateItemInline]


@admin.register(Measurement)
class MeasurementAdmin(admin.ModelAdmin):
    list_display = ['project', 'room', 'east', 'west', 'north', 'south', 'status']
    list_filter = ['status']


@admin.register(MaterialSelection)
class MaterialSelectionAdmin(admin.ModelAdmin):
    list_display = ['project', 'category', 'room', 'brand_name', 'supplier_price', 'availability']
    list_filter = ['category', 'availability']


@admin.register(ExecutionStage)
class ExecutionStageAdmin(admin.ModelAdmin):
    list_display = ['project', 'name', 'vendor', 'status', 'progress', 'payment_status']
    list_filter = ['status', 'payment_status']


@admin.register(PaymentMilestone)
class PaymentMilestoneAdmin(admin.ModelAdmin):
    list_display = ['project', 'milestone', 'amount', 'due_date', 'status', 'mode']
    list_filter = ['status']


@admin.register(QualityCheck)
class QualityCheckAdmin(admin.ModelAdmin):
    list_display = ['project', 'area', 'check_type', 'date', 'inspector', 'status']
    list_filter = ['status']


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ['name', 'vendor_type', 'category', 'contact_person', 'phone', 'rating', 'is_active']
    list_filter = ['vendor_type', 'is_active']
    search_fields = ['name', 'category']
