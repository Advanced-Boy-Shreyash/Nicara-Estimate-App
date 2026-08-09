"""
NICARA CRM — Views

    /api/crm/leads/                 pipeline (?stage=&search=&owner=)
    /api/crm/leads/{id}/            retrieve / update
    /api/crm/leads/{id}/notes/      activity log
    /api/crm/leads/{id}/convert/    won lead → Client + Project
    /api/crm/leads/pipeline/        counts per stage, for the board view
    /api/crm/clients/               client list
    /api/crm/clients/{id}/          retrieve / update / deactivate
    /api/crm/clients/{id}/notes/    activity log
    /api/crm/meta/                  choice lists
"""
from django.db import transaction
from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import HasModulePermission
from projects.models import Project

from .models import Client, CrmNote, Lead
from .serializers import (
    ClientListSerializer, ClientSerializer, ConvertLeadSerializer,
    CrmNoteSerializer, LeadListSerializer, LeadSerializer,
)


# ── Leads ───────────────────────────────────────────────────

class LeadListCreateView(generics.ListCreateAPIView):
    queryset = Lead.objects.select_related('owner').all()
    permission_classes = [HasModulePermission]
    module = 'leads'
    filterset_fields = ['stage', 'source', 'priority', 'owner', 'city']
    search_fields = ['code', 'name', 'email', 'phone', 'project_name', 'developer', 'city']
    ordering_fields = ['created_at', 'next_follow_up', 'estimated_budget', 'name']

    def get_serializer_class(self):
        return LeadSerializer if self.request.method == 'POST' else LeadListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class LeadDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Lead.objects.select_related('owner').prefetch_related('notes')
    serializer_class = LeadSerializer
    permission_classes = [HasModulePermission]
    module = 'leads'
    required_write_level = 'edit'

    def perform_update(self, serializer):
        previous_stage = serializer.instance.stage
        lead = serializer.save()
        # Stage moves are the thing people audit later — log them automatically.
        if lead.stage != previous_stage:
            CrmNote.objects.create(
                lead=lead,
                kind=CrmNote.Kind.STAGE_CHANGE,
                body=f'Stage moved from {previous_stage} to {lead.stage}.',
                created_by=self.request.user,
            )


class LeadNoteListCreateView(generics.ListCreateAPIView):
    serializer_class = CrmNoteSerializer
    permission_classes = [HasModulePermission]
    module = 'leads'

    def get_queryset(self):
        return CrmNote.objects.filter(lead_id=self.kwargs['lead_id'])

    def perform_create(self, serializer):
        serializer.save(lead_id=self.kwargs['lead_id'], created_by=self.request.user)


class LeadPipelineView(APIView):
    """GET /api/crm/leads/pipeline/ — counts per stage for the board view."""
    permission_classes = [HasModulePermission]
    module = 'leads'

    def get(self, request):
        counts = dict(
            Lead.objects.values_list('stage').annotate(n=Count('id'))
        )
        return Response({
            'stages': [
                {'value': value, 'label': label, 'count': counts.get(value, 0)}
                for value, label in Lead.Stage.choices
            ],
            'open': Lead.objects.exclude(
                stage__in=[Lead.Stage.WON, Lead.Stage.LOST]
            ).count(),
            'won': counts.get(Lead.Stage.WON, 0),
            'lost': counts.get(Lead.Stage.LOST, 0),
        })


class ConvertLeadView(APIView):
    """
    POST /api/crm/leads/{lead_id}/convert/

    Creates the Client (or reuses one) and a Project seeded from the lead,
    then marks the lead won. Idempotent — converting twice returns the
    existing records rather than duplicating them.
    """
    permission_classes = [HasModulePermission]
    module = 'leads'

    def post(self, request, lead_id):
        lead = get_object_or_404(Lead, pk=lead_id)

        if lead.converted_project_id:
            return Response(
                {'detail': f'This lead was already converted to project #{lead.converted_project_id}.',
                 'project_id': lead.converted_project_id,
                 'client_id': lead.converted_client_id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ConvertLeadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            client = None
            if data.get('existing_client_id'):
                client = Client.objects.get(pk=data['existing_client_id'])
            elif data.get('create_client', True):
                client, _ = Client.objects.get_or_create(
                    name=lead.name,
                    defaults={
                        'email': lead.email, 'phone': lead.phone,
                        'city': lead.city, 'state': lead.state,
                        'created_by': request.user,
                    },
                )

            project = Project.objects.create(
                client=client,
                client_name=lead.name,
                client_email=lead.email,
                client_phone=lead.phone,
                name=data.get('project_name') or lead.project_name or f'{lead.name} Residence',
                developer=lead.developer,
                unit_no=lead.unit_no,
                city=lead.city or 'Mumbai',
                state=lead.state,
                area=lead.area,
                property_type=lead.property_type or Project.PropertyType.BHK3,
                budget=lead.estimated_budget,
                stage=Project.Stage.LEAD,
                design_owner=lead.owner,
                created_by=request.user,
            )

            lead.stage = Lead.Stage.WON
            lead.converted_client = client
            lead.converted_project = project
            lead.converted_at = timezone.now()
            lead.save(update_fields=[
                'stage', 'converted_client', 'converted_project', 'converted_at', 'updated_at',
            ])

            CrmNote.objects.create(
                lead=lead, kind=CrmNote.Kind.STAGE_CHANGE,
                body=f'Converted to project "{project.name}".',
                created_by=request.user,
            )

        return Response({
            'detail': f'Lead converted to project "{project.name}".',
            'project_id': project.id,
            'client_id': client.id if client else None,
            'lead': LeadSerializer(lead).data,
        }, status=status.HTTP_201_CREATED)


# ── Clients ─────────────────────────────────────────────────

class ClientListCreateView(generics.ListCreateAPIView):
    queryset = Client.objects.annotate(project_count=Count('projects')).all()
    permission_classes = [HasModulePermission]
    module = 'clients'
    filterset_fields = ['client_type', 'city', 'state', 'is_active']
    search_fields = ['code', 'name', 'company_name', 'email', 'phone', 'city', 'gst_number']
    ordering_fields = ['name', 'created_at']

    def get_serializer_class(self):
        return ClientSerializer if self.request.method == 'POST' else ClientListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ClientDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Client.objects.annotate(project_count=Count('projects')).prefetch_related(
        'projects', 'crm_notes'
    )
    serializer_class = ClientSerializer
    permission_classes = [HasModulePermission]
    module = 'clients'

    def perform_destroy(self, instance):
        # Projects reference clients — deactivate rather than orphan them.
        instance.is_active = False
        instance.save(update_fields=['is_active'])


class ClientNoteListCreateView(generics.ListCreateAPIView):
    serializer_class = CrmNoteSerializer
    permission_classes = [HasModulePermission]
    module = 'clients'

    def get_queryset(self):
        return CrmNote.objects.filter(client_id=self.kwargs['client_id'])

    def perform_create(self, serializer):
        serializer.save(client_id=self.kwargs['client_id'], created_by=self.request.user)


class CrmMetaView(APIView):
    """GET /api/crm/meta/ — choice lists for the lead and client forms."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        def choices(source):
            return [{'value': v, 'label': l} for v, l in source]

        return Response({
            'lead_stages': choices(Lead.Stage.choices),
            'lead_sources': choices(Lead.Source.choices),
            'priorities': choices(Lead.Priority.choices),
            'client_types': choices(Client.ClientType.choices),
            'note_kinds': choices(CrmNote.Kind.choices),
            'counts': {
                'open_leads': Lead.objects.exclude(
                    stage__in=[Lead.Stage.WON, Lead.Stage.LOST]
                ).count(),
                'clients': Client.objects.filter(is_active=True).count(),
            },
        })
