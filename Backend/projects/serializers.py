"""
NICARA Projects — Serializers
Full project lifecycle serializers.
"""
from rest_framework import serializers
from .models import (
    BookingForm, Project, DesignRequirement, ProjectDeliverable, Estimate,
    EstimateItem, Measurement, MaterialSelection, ExecutionStage,
    PaymentMilestone, QualityCheck,
)


# ── Design Requirements ─────────────────────────────────────
class DesignRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = DesignRequirement
        fields = '__all__'
        read_only_fields = ['project']


class DesignRequirementBulkSerializer(serializers.Serializer):
    """Replace a project's requirement rows in one call (the grid saves whole)."""
    rows = serializers.ListField(child=serializers.DictField(), allow_empty=True)


# ── Deliverables (FL, MB, 3D, Renders, WD) ──────────────────
class ProjectDeliverableSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = ProjectDeliverable
        fields = '__all__'
        # Both come from the URL / session, never the request body.
        read_only_fields = ['project', 'uploaded_by']

    def get_uploaded_by_name(self, obj):
        return obj.uploaded_by.get_full_name() if obj.uploaded_by else ''


# ── Estimate Items ──────────────────────────────────────────
class EstimateItemSerializer(serializers.ModelSerializer):
    """`amount` is derived from qty × rate, so it is never accepted as input."""
    gst_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_with_gst = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    catalog_item_code = serializers.CharField(source='catalog_item.code', read_only=True)

    class Meta:
        model = EstimateItem
        fields = '__all__'
        read_only_fields = ['estimate', 'amount']

    def validate_qty(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Quantity cannot be negative.')
        return value

    def validate_rate(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Rate cannot be negative.')
        return value

    def validate_gst_pct(self, value):
        if value is not None and not (0 <= value <= 100):
            raise serializers.ValidationError('GST percentage must be between 0 and 100.')
        return value


class EstimateSerializer(serializers.ModelSerializer):
    items = EstimateItemSerializer(many=True, read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    subtotal = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_discount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    taxable_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    gst_total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    grand_total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    item_count = serializers.IntegerField(read_only=True)
    sent_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Estimate
        fields = '__all__'
        read_only_fields = [
            'project', 'sent_at', 'sent_by', 'approved_at', 'approved_by',
            'created_by', 'created_at', 'updated_at',
        ]

    def get_sent_by_name(self, obj):
        return obj.sent_by.get_full_name() if obj.sent_by else ''

    def get_approved_by_name(self, obj):
        return obj.approved_by.get_full_name() if obj.approved_by else ''


class EstimateListSerializer(serializers.ModelSerializer):
    """Lightweight — for listing estimates without items."""
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    item_count = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()

    class Meta:
        model = Estimate
        fields = ['id', 'type', 'type_display', 'version', 'status', 'status_display',
                  'title', 'item_count', 'total', 'valid_until', 'created_at']

    def get_item_count(self, obj):
        return obj.items.count()

    def get_total(self, obj):
        return float(obj.grand_total)


# ── Booking Form ────────────────────────────────────────────
class BookingFormSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    balance_due = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    client_name = serializers.CharField(source='project.client_name', read_only=True)
    client_phone = serializers.CharField(source='project.client_phone', read_only=True)
    client_email = serializers.CharField(source='project.client_email', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    developer = serializers.CharField(source='project.developer', read_only=True)
    unit_no = serializers.CharField(source='project.unit_no', read_only=True)

    class Meta:
        model = BookingForm
        fields = '__all__'
        read_only_fields = ['project', 'booking_number', 'created_by',
                            'created_at', 'updated_at']

    def validate_advance_amount(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Advance cannot be negative.')
        return value

    def validate(self, data):
        total = data.get('total_value', getattr(self.instance, 'total_value', 0)) or 0
        advance = data.get('advance_amount', getattr(self.instance, 'advance_amount', 0)) or 0
        if total and advance > total:
            raise serializers.ValidationError(
                {'advance_amount': 'Advance cannot be more than the total value.'}
            )
        return data


# ── Measurements ────────────────────────────────────────────
class MeasurementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Measurement
        fields = '__all__'
        read_only_fields = ['project']


# ── Material Selections ────────────────────────────────────
class MaterialSelectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialSelection
        fields = '__all__'
        read_only_fields = ['project']


# ── Execution Stages ────────────────────────────────────────
class ExecutionStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExecutionStage
        fields = '__all__'
        read_only_fields = ['project']


# ── Payments ────────────────────────────────────────────────
class PaymentMilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMilestone
        fields = '__all__'
        read_only_fields = ['project']


# ── Quality Checks ──────────────────────────────────────────
class QualityCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = QualityCheck
        fields = '__all__'
        read_only_fields = ['project']


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
    booking_form = BookingFormSerializer(read_only=True)
    estimates_summary = serializers.SerializerMethodField()
    design_owner_name = serializers.SerializerMethodField()
    site_manager_name = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

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

    def validate_progress(self, value):
        if value is not None and not (0 <= value <= 100):
            raise serializers.ValidationError('Progress must be between 0 and 100.')
        return value

    def validate(self, data):
        start = data.get('start_date', getattr(self.instance, 'start_date', None))
        target = data.get('target_date', getattr(self.instance, 'target_date', None))
        if start and target and target < start:
            raise serializers.ValidationError(
                {'target_date': 'Target date cannot be before the start date.'}
            )
        return data
