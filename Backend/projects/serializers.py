"""
NICARA Projects — Serializers
"""
from rest_framework import serializers
from django.db.models import Sum
from .models import (
    Project, ProjectRoom, EstimateItem, EstimateItemSpec,
    FurnitureLayout, MoodBoard, MoodBoardImage,
    PaymentSchedule, ServiceVendor, ProductVendor, Client,
)


class ProjectRoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectRoom
        fields = '__all__'


class EstimateItemSpecSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstimateItemSpec
        fields = '__all__'


class EstimateItemSerializer(serializers.ModelSerializer):
    specs = EstimateItemSpecSerializer(many=True, read_only=True)
    dimension_display = serializers.SerializerMethodField()

    class Meta:
        model = EstimateItem
        fields = '__all__'

    def get_dimension_display(self, obj):
        """Format dimensions as 8'0\" style."""
        parts = []
        if obj.width_ft or obj.width_in:
            parts.append(f"{obj.width_ft}'{obj.width_in}\"")
        if obj.height_ft or obj.height_in:
            parts.append(f"{obj.height_ft}'{obj.height_in}\"")
        if obj.depth_ft or obj.depth_in:
            parts.append(f"{obj.depth_ft}'{obj.depth_in}\"")
        return ' × '.join(parts) if parts else '—'


class EstimateItemWriteSerializer(serializers.ModelSerializer):
    """For creating/updating estimate items (no nested specs)."""
    class Meta:
        model = EstimateItem
        fields = '__all__'


class FurnitureLayoutSerializer(serializers.ModelSerializer):
    class Meta:
        model = FurnitureLayout
        fields = '__all__'


class MoodBoardImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MoodBoardImage
        fields = '__all__'


class MoodBoardSerializer(serializers.ModelSerializer):
    images = MoodBoardImageSerializer(many=True, read_only=True)

    class Meta:
        model = MoodBoard
        fields = '__all__'


class PaymentScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentSchedule
        fields = '__all__'


class ProjectListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for project list view."""
    created_by_name = serializers.SerializerMethodField()
    team_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'client_name', 'project_name', 'unit_no', 'city',
            'location', 'property_type', 'status', 'progress',
            'created_by_name', 'team_count', 'created_at',
        ]

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else ''

    def get_team_count(self, obj):
        return obj.team_members.count()


class ProjectDetailSerializer(serializers.ModelSerializer):
    """Full serializer for project detail view."""
    rooms = ProjectRoomSerializer(many=True, read_only=True)
    payments = PaymentScheduleSerializer(many=True, read_only=True)
    estimate_total = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = '__all__'

    def get_estimate_total(self, obj):
        return float(obj.estimate_items.aggregate(
            total=Sum('amount')
        )['total'] or 0)


class ServiceVendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceVendor
        fields = '__all__'


class ProductVendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVendor
        fields = '__all__'


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'
