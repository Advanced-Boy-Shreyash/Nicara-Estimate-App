"""
NICARA Projects — Admin Configuration
"""
from django.contrib import admin
from .models import (
    BookingForm, Project, DesignRequirement, ProjectDeliverable, Estimate,
    EstimateItem, EstimateItemComponent, Measurement, MaterialSelection,
    ExecutionStage, PaymentMilestone, QualityCheck,
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


class EstimateItemComponentInline(admin.TabularInline):
    model = EstimateItemComponent
    extra = 0
    readonly_fields = ['amount']


class EstimateItemInline(admin.TabularInline):
    model = EstimateItem
    extra = 0
    autocomplete_fields = ['catalog_item']
    readonly_fields = ['amount']


@admin.register(EstimateItem)
class EstimateItemAdmin(admin.ModelAdmin):
    list_display = ['sno', 'estimate', 'area', 'zone', 'item', 'finishing', 'amount']
    list_filter = ['estimate__type']
    search_fields = ['area', 'zone', 'item']
    readonly_fields = ['amount']
    inlines = [EstimateItemComponentInline]


@admin.register(Estimate)
class EstimateAdmin(admin.ModelAdmin):
    list_display = ['project', 'type', 'version', 'status', 'grand_total_display', 'created_at']
    list_filter = ['type', 'status']
    search_fields = ['project__name', 'title']
    readonly_fields = ['sent_at', 'sent_by', 'approved_at', 'approved_by',
                       'created_by', 'created_at', 'updated_at']
    inlines = [EstimateItemInline]

    @admin.display(description='Grand total')
    def grand_total_display(self, obj):
        return f'₹{obj.grand_total:,.2f}'


@admin.register(BookingForm)
class BookingFormAdmin(admin.ModelAdmin):
    list_display = ['booking_number', 'project', 'booking_date', 'total_value',
                    'advance_amount', 'advance_received', 'status']
    list_filter = ['status', 'advance_received', 'payment_mode']
    search_fields = ['booking_number', 'project__name', 'project__client_name']
    readonly_fields = ['booking_number', 'balance_due', 'created_by',
                       'created_at', 'updated_at']


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
