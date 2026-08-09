"""NICARA CRM — Serializers"""
from rest_framework import serializers

from .models import Client, CrmNote, Lead


class CrmNoteSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source='get_kind_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CrmNote
        fields = ['id', 'lead', 'client', 'kind', 'kind_display', 'body',
                  'follow_up_on', 'created_by_name', 'created_at']
        read_only_fields = ['lead', 'client', 'created_at']

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else ''


class ClientListSerializer(serializers.ModelSerializer):
    # Uses the list queryset's annotation when present, counts otherwise
    # (a freshly created client has no annotation attached).
    project_count = serializers.SerializerMethodField()
    type_display = serializers.CharField(source='get_client_type_display', read_only=True)

    class Meta:
        model = Client
        fields = ['id', 'code', 'name', 'client_type', 'type_display', 'company_name',
                  'email', 'phone', 'city', 'state', 'gst_number',
                  'project_count', 'is_active', 'created_at']

    def get_project_count(self, obj):
        annotated = getattr(obj, 'project_count', None)
        return annotated if annotated is not None else obj.projects.count()


class ClientSerializer(serializers.ModelSerializer):
    # Uses the list queryset's annotation when present, counts otherwise
    # (a freshly created client has no annotation attached).
    project_count = serializers.SerializerMethodField()
    type_display = serializers.CharField(source='get_client_type_display', read_only=True)
    crm_notes = CrmNoteSerializer(many=True, read_only=True)
    projects = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = '__all__'
        read_only_fields = ['code', 'created_by', 'created_at', 'updated_at']

    def get_project_count(self, obj):
        annotated = getattr(obj, 'project_count', None)
        return annotated if annotated is not None else obj.projects.count()

    def get_projects(self, obj):
        return [
            {'id': p.id, 'name': p.name, 'stage': p.stage, 'progress': p.progress}
            for p in obj.projects.all()
        ]

    def validate_gst_number(self, value):
        value = (value or '').strip().upper()
        if value and len(value) != 15:
            raise serializers.ValidationError('GSTIN must be exactly 15 characters.')
        return value

    def validate_pan_number(self, value):
        value = (value or '').strip().upper()
        if value and len(value) != 10:
            raise serializers.ValidationError('PAN must be exactly 10 characters.')
        return value


class LeadListSerializer(serializers.ModelSerializer):
    stage_display = serializers.CharField(source='get_stage_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    owner_name = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = ['id', 'code', 'name', 'email', 'phone', 'project_name', 'developer',
                  'city', 'property_type', 'area', 'estimated_budget',
                  'stage', 'stage_display', 'source', 'source_display', 'priority',
                  'owner', 'owner_name', 'next_follow_up',
                  'converted_project', 'created_at']

    def get_owner_name(self, obj):
        return obj.owner.get_full_name() if obj.owner else ''


class LeadSerializer(serializers.ModelSerializer):
    stage_display = serializers.CharField(source='get_stage_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    owner_name = serializers.SerializerMethodField()
    notes = CrmNoteSerializer(many=True, read_only=True)
    is_open = serializers.BooleanField(read_only=True)

    class Meta:
        model = Lead
        fields = '__all__'
        read_only_fields = ['code', 'converted_client', 'converted_project',
                            'converted_at', 'created_by', 'created_at', 'updated_at']

    def get_owner_name(self, obj):
        return obj.owner.get_full_name() if obj.owner else ''

    def validate(self, data):
        stage = data.get('stage', getattr(self.instance, 'stage', None))
        reason = data.get('lost_reason', getattr(self.instance, 'lost_reason', ''))
        if stage == Lead.Stage.LOST and not (reason or '').strip():
            raise serializers.ValidationError(
                {'lost_reason': 'Give a reason when closing a lead as lost.'}
            )
        return data


class ConvertLeadSerializer(serializers.Serializer):
    """Turn a won lead into a Client + Project."""
    project_name = serializers.CharField(required=False, allow_blank=True)
    create_client = serializers.BooleanField(default=True)
    existing_client_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_existing_client_id(self, value):
        if value and not Client.objects.filter(pk=value).exists():
            raise serializers.ValidationError('Unknown client.')
        return value
