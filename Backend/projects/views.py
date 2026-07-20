"""
NICARA Projects — Views
Full CRUD for all project lifecycle resources.
"""
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Project, DesignRequirement, ProjectDeliverable, Estimate, EstimateItem,
    Measurement, MaterialSelection, ExecutionStage, PaymentMilestone,
    QualityCheck, Vendor,
)
from .serializers import (
    ProjectListSerializer, ProjectDetailSerializer,
    DesignRequirementSerializer, ProjectDeliverableSerializer,
    EstimateSerializer, EstimateListSerializer, EstimateItemSerializer,
    MeasurementSerializer, MaterialSelectionSerializer,
    ExecutionStageSerializer, PaymentMilestoneSerializer,
    QualityCheckSerializer, VendorSerializer,
)


# ── Projects ────────────────────────────────────────────────

class ProjectListCreateView(generics.ListCreateAPIView):
    """GET /api/projects/ — list, POST — create."""
    queryset = Project.objects.all()
    filterset_fields = ['stage', 'city', 'property_type', 'project_type']
    search_fields = ['name', 'client_name', 'developer']
    ordering_fields = ['created_at', 'name', 'progress']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ProjectDetailSerializer
        return ProjectListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/projects/{id}/"""
    queryset = Project.objects.prefetch_related(
        'design_requirements', 'deliverables', 'measurements',
        'material_selections', 'execution_stages', 'payment_milestones',
        'quality_checks', 'estimates__items',
    )
    serializer_class = ProjectDetailSerializer


class ProjectDashboardView(APIView):
    """GET /api/projects/dashboard/ — KPI summary."""
    def get(self, request):
        projects = Project.objects.all()
        stage_counts = {}
        for stage_val, stage_label in Project.Stage.choices:
            stage_counts[stage_val] = projects.filter(stage=stage_val).count()

        total_budget = sum(float(p.budget or 0) for p in projects)
        total_paid = sum(
            float(pm.amount) for pm in PaymentMilestone.objects.filter(status='paid')
        )

        return Response({
            'total_projects': projects.count(),
            'stage_counts': stage_counts,
            'total_budget': total_budget,
            'total_paid': total_paid,
            'total_pending': total_budget - total_paid,
            'overdue_payments': PaymentMilestone.objects.filter(status='overdue').count(),
        })


# ── Design Requirements ────────────────────────────────────

class DesignRequirementListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/projects/{project_id}/design-requirements/"""
    serializer_class = DesignRequirementSerializer

    def get_queryset(self):
        return DesignRequirement.objects.filter(project_id=self.kwargs['project_id'])

    def perform_create(self, serializer):
        serializer.save(project_id=self.kwargs['project_id'])


class DesignRequirementDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DesignRequirementSerializer

    def get_queryset(self):
        return DesignRequirement.objects.filter(project_id=self.kwargs['project_id'])


# ── Deliverables (FL, MB, 3D, Renders, WD) ────────────────

class DeliverableListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/projects/{project_id}/deliverables/?type=furniture_layout"""
    serializer_class = ProjectDeliverableSerializer
    filterset_fields = ['type', 'status']

    def get_queryset(self):
        return ProjectDeliverable.objects.filter(project_id=self.kwargs['project_id'])

    def perform_create(self, serializer):
        serializer.save(
            project_id=self.kwargs['project_id'],
            uploaded_by=self.request.user,
        )


class DeliverableDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectDeliverableSerializer

    def get_queryset(self):
        return ProjectDeliverable.objects.filter(project_id=self.kwargs['project_id'])


# ── Estimates ──────────────────────────────────────────────

class EstimateListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/projects/{project_id}/estimates/"""
    filterset_fields = ['type', 'status']

    def get_queryset(self):
        return Estimate.objects.filter(
            project_id=self.kwargs['project_id']
        ).prefetch_related('items')

    def get_serializer_class(self):
        if self.request.method == 'GET':
            # Return full data with items
            return EstimateSerializer
        return EstimateSerializer

    def perform_create(self, serializer):
        serializer.save(project_id=self.kwargs['project_id'])


class EstimateDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EstimateSerializer

    def get_queryset(self):
        return Estimate.objects.filter(
            project_id=self.kwargs['project_id']
        ).prefetch_related('items')


class EstimateItemListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/projects/{project_id}/estimates/{estimate_id}/items/"""
    serializer_class = EstimateItemSerializer

    def get_queryset(self):
        return EstimateItem.objects.filter(
            estimate_id=self.kwargs['estimate_id'],
            estimate__project_id=self.kwargs['project_id'],
        )

    def perform_create(self, serializer):
        serializer.save(estimate_id=self.kwargs['estimate_id'])


class EstimateItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EstimateItemSerializer

    def get_queryset(self):
        return EstimateItem.objects.filter(
            estimate_id=self.kwargs['estimate_id'],
            estimate__project_id=self.kwargs['project_id'],
        )


# ── Measurements ───────────────────────────────────────────

class MeasurementListCreateView(generics.ListCreateAPIView):
    serializer_class = MeasurementSerializer

    def get_queryset(self):
        return Measurement.objects.filter(project_id=self.kwargs['project_id'])

    def perform_create(self, serializer):
        serializer.save(project_id=self.kwargs['project_id'])


class MeasurementDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MeasurementSerializer

    def get_queryset(self):
        return Measurement.objects.filter(project_id=self.kwargs['project_id'])


# ── Material Selections ────────────────────────────────────

class MaterialSelectionListCreateView(generics.ListCreateAPIView):
    serializer_class = MaterialSelectionSerializer
    filterset_fields = ['category', 'room']

    def get_queryset(self):
        return MaterialSelection.objects.filter(project_id=self.kwargs['project_id'])

    def perform_create(self, serializer):
        serializer.save(project_id=self.kwargs['project_id'])


class MaterialSelectionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MaterialSelectionSerializer

    def get_queryset(self):
        return MaterialSelection.objects.filter(project_id=self.kwargs['project_id'])


# ── Execution Stages ───────────────────────────────────────

class ExecutionStageListCreateView(generics.ListCreateAPIView):
    serializer_class = ExecutionStageSerializer

    def get_queryset(self):
        return ExecutionStage.objects.filter(project_id=self.kwargs['project_id'])

    def perform_create(self, serializer):
        serializer.save(project_id=self.kwargs['project_id'])


class ExecutionStageDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ExecutionStageSerializer

    def get_queryset(self):
        return ExecutionStage.objects.filter(project_id=self.kwargs['project_id'])


# ── Payments ───────────────────────────────────────────────

class PaymentMilestoneListCreateView(generics.ListCreateAPIView):
    serializer_class = PaymentMilestoneSerializer

    def get_queryset(self):
        return PaymentMilestone.objects.filter(project_id=self.kwargs['project_id'])

    def perform_create(self, serializer):
        serializer.save(project_id=self.kwargs['project_id'])


class PaymentMilestoneDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PaymentMilestoneSerializer

    def get_queryset(self):
        return PaymentMilestone.objects.filter(project_id=self.kwargs['project_id'])


# ── Quality Checks ─────────────────────────────────────────

class QualityCheckListCreateView(generics.ListCreateAPIView):
    serializer_class = QualityCheckSerializer

    def get_queryset(self):
        return QualityCheck.objects.filter(project_id=self.kwargs['project_id'])

    def perform_create(self, serializer):
        serializer.save(project_id=self.kwargs['project_id'])


class QualityCheckDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = QualityCheckSerializer

    def get_queryset(self):
        return QualityCheck.objects.filter(project_id=self.kwargs['project_id'])


# ── Vendors ────────────────────────────────────────────────

class VendorListCreateView(generics.ListCreateAPIView):
    queryset = Vendor.objects.all()
    serializer_class = VendorSerializer
    filterset_fields = ['vendor_type', 'category', 'is_active']
    search_fields = ['name', 'category', 'contact_person']


class VendorDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Vendor.objects.all()
    serializer_class = VendorSerializer
