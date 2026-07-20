"""
NICARA Projects — Serializers
Full project lifecycle serializers.
"""
from rest_framework import serializers
from .models import (
    Project, DesignRequirement, ProjectDeliverable, Estimate, EstimateItem,
    Measurement, MaterialSelection, ExecutionStage, PaymentMilestone,
    QualityCheck, Vendor,
)


# ── Design Requirements ─────────────────────────────────────
class DesignRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = DesignRequirement
        fields = '__all__'


# ── Deliverables (FL, MB, 3D, Renders, WD) ──────────────────
class ProjectDeliverableSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = ProjectDeliverable
        fields = '__all__'

    def get_uploaded_by_name(self, obj):
        return obj.uploaded_by.get_full_name() if obj.uploaded_by else ''


# ── Estimate Items ──────────────────────────────────────────
class EstimateItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstimateItem
        fields = '__all__'


class EstimateSerializer(serializers.ModelSerializer):
    items = EstimateItemSerializer(many=True, read_only=True)
    subtotal = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    gst_total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    grand_total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Estimate
        fields = '__all__'


class EstimateListSerializer(serializers.ModelSerializer):
    """Lightweight — for listing estimates without items."""
    item_count = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()

    class Meta:
        model = Estimate
        fields = ['id', 'type', 'version', 'status', 'item_count', 'total', 'created_at']

    def get_item_count(self, obj):
        return obj.items.count()

    def get_total(self, obj):
        return float(obj.grand_total)


# ── Measurements ────────────────────────────────────────────
class MeasurementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Measurement
        fields = '__all__'


# ── Material Selections ────────────────────────────────────
class MaterialSelectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialSelection
        fields = '__all__'


# ── Execution Stages ────────────────────────────────────────
class ExecutionStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExecutionStage
        fields = '__all__'


# ── Payments ────────────────────────────────────────────────
class PaymentMilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMilestone
        fields = '__all__'


# ── Quality Checks ──────────────────────────────────────────
class QualityCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = QualityCheck
        fields = '__all__'


# ── Vendors ─────────────────────────────────────────────────
class VendorSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_vendor_type_display', read_only=True)

    class Meta:
        model = Vendor
        fields = '__all__'


# ── Project Serializers ─────────────────────────────────────
class ProjectListSerializer(serializers.ModelSerializer):
    """Lightweight — for project list tables."""
    design_owner_name = serializers.SerializerMethodField()
    site_manager_name = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'client_name', 'client_phone', 'developer', 'unit_no',
            'city', 'state', 'area', 'property_type', 'project_type', 'purpose',
            'interior_style', 'stage', 'progress', 'budget',
            'start_date', 'target_date',
            'design_owner_name', 'site_manager_name', 'created_at',
        ]

    def get_design_owner_name(self, obj):
        return obj.design_owner.get_full_name() if obj.design_owner else ''

    def get_site_manager_name(self, obj):
        return obj.site_manager.get_full_name() if obj.site_manager else ''


class ProjectDetailSerializer(serializers.ModelSerializer):
    """Full detail — includes all nested data."""
    design_requirements = DesignRequirementSerializer(many=True, read_only=True)
    deliverables = ProjectDeliverableSerializer(many=True, read_only=True)
    measurements = MeasurementSerializer(many=True, read_only=True)
    material_selections = MaterialSelectionSerializer(many=True, read_only=True)
    execution_stages = ExecutionStageSerializer(many=True, read_only=True)
    payment_milestones = PaymentMilestoneSerializer(many=True, read_only=True)
    quality_checks = QualityCheckSerializer(many=True, read_only=True)
    estimates_summary = serializers.SerializerMethodField()
    design_owner_name = serializers.SerializerMethodField()
    site_manager_name = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = '__all__'

    def get_estimates_summary(self, obj):
        return [
            {
                'id': e.id,
                'type': e.type,
                'version': e.version,
                'status': e.status,
                'item_count': e.items.count(),
                'total': float(e.grand_total),
            }
            for e in obj.estimates.all()
        ]

    def get_design_owner_name(self, obj):
        return obj.design_owner.get_full_name() if obj.design_owner else ''

    def get_site_manager_name(self, obj):
        return obj.site_manager.get_full_name() if obj.site_manager else ''
