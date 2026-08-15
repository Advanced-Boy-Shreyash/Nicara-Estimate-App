"""
NICARA Projects — Views
Full CRUD for all project lifecycle resources.
"""
import os
import re

from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from decimal import Decimal

from catalog.models import Furniture as CatalogFurniture
from items.models import Item
from items.serializers import AddItemsToEstimateSerializer
from nicara.media import build_derivatives

from .exports import booking_pdf, estimate_pdf, estimate_xlsx

from .models import (
    BookingForm, Project, DesignRequirement, ProjectDeliverable, Estimate,
    EstimateItem, EstimateItemComponent, Measurement, MaterialSelection,
    ExecutionStage, PaymentMilestone, QualityCheck,
)
from .serializers import (
    BookingFormSerializer, ProjectListSerializer, ProjectDetailSerializer,
    DeliverableReviewSerializer, DesignRequirementBulkSerializer,
    DesignRequirementSerializer, ProjectDeliverableSerializer,
    EstimateSerializer, EstimateListSerializer, EstimateItemSerializer,
    EstimateItemComponentSerializer,
    MeasurementSerializer, MaterialSelectionSerializer,
    ExecutionStageSerializer, PaymentMilestoneSerializer,
    QualityCheckSerializer,
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
    """
    GET/PUT/PATCH/DELETE /api/projects/{id}/

    PATCH is what the Initial Engagement → Client Details form saves to.
    """
    queryset = Project.objects.select_related('booking_form').prefetch_related(
        'design_requirements', 'deliverables', 'measurements',
        'material_selections', 'execution_stages', 'payment_milestones',
        'quality_checks', 'estimates__items',
    )
    serializer_class = ProjectDetailSerializer


class ProjectMetaView(APIView):
    """GET /api/projects/meta/ — choice lists for the project forms."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        def choices(source):
            return [{'value': v, 'label': l} for v, l in source]

        return Response({
            'stages': choices(Project.Stage.choices),
            'property_types': choices(Project.PropertyType.choices),
            'project_types': choices(Project.ProjectType.choices),
            'purposes': choices(Project.Purpose.choices),
            'estimate_types': choices(Estimate.EstimateType.choices),
            'estimate_statuses': choices(Estimate.Status.choices),
            'deliverable_types': choices(ProjectDeliverable.DeliverableType.choices),
            'booking_statuses': choices(BookingForm.Status.choices),
            'payment_modes': choices(BookingForm.PaymentMode.choices),
        })


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


class DesignRequirementBulkView(APIView):
    """
    PUT /api/projects/{project_id}/design-requirements/bulk/
    Body: { "rows": [ {room, unit, length, breadth, height, finishing, remarks,
                       design_required}, ... ] }

    Replaces the whole set — the requirements grid is edited and saved as one
    table, so a wholesale swap matches how the UI behaves.
    """

    def put(self, request, project_id):
        project = get_object_or_404(Project, pk=project_id)
        serializer = DesignRequirementBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rows = serializer.validated_data['rows']

        created = []
        with transaction.atomic():
            project.design_requirements.all().delete()
            for index, row in enumerate(rows, start=1):
                row_serializer = DesignRequirementSerializer(data={**row, 'sort_order': index})
                row_serializer.is_valid(raise_exception=True)
                created.append(row_serializer.save(project=project))

        return Response(
            DesignRequirementSerializer(created, many=True).data,
            status=status.HTTP_200_OK,
        )


# ── Deliverables (FL, MB, 3D, Renders, WD) ────────────────

class DeliverableListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/projects/{project_id}/deliverables/?type=furniture_layout
    POST — create a new version (multipart when a file is attached).

    Version numbers are assigned server-side and the new row becomes the
    current one for its type.
    """
    serializer_class = ProjectDeliverableSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ['type', 'status', 'is_current']

    def get_queryset(self):
        return ProjectDeliverable.objects.filter(project_id=self.kwargs['project_id'])

    def perform_create(self, serializer):
        project_id = self.kwargs['project_id']
        deliverable_type = serializer.validated_data.get('type')

        previous = (ProjectDeliverable.objects
                    .filter(project_id=project_id, type=deliverable_type, is_current=True)
                    .first())

        deliverable = serializer.save(
            project_id=project_id,
            uploaded_by=self.request.user,
            version_no=ProjectDeliverable.next_version_no(project_id, deliverable_type),
            supersedes=previous,
        )
        _finalise_upload(deliverable)
        deliverable.mark_current()


class DeliverableDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectDeliverableSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return ProjectDeliverable.objects.filter(project_id=self.kwargs['project_id'])

    def perform_update(self, serializer):
        deliverable = serializer.save()
        if 'file' in serializer.validated_data:
            _finalise_upload(deliverable)


def _finalise_upload(deliverable):
    """Record the file size and build image derivatives after an upload."""
    if not deliverable.file:
        return
    try:
        deliverable.file_size = deliverable.file.size
    except (OSError, ValueError):
        deliverable.file_size = 0
    if not deliverable.file_name:
        deliverable.file_name = os.path.basename(deliverable.file.name)
    build_derivatives(deliverable)
    deliverable.save(update_fields=['file_size', 'file_name', 'thumbnail', 'preview'])


class DeliverableActionView(APIView):
    """Shared lookup for the deliverable approval endpoints."""

    def get_deliverable(self):
        return get_object_or_404(
            ProjectDeliverable,
            pk=self.kwargs['pk'],
            project_id=self.kwargs['project_id'],
        )

    def responded(self, deliverable):
        return Response(
            ProjectDeliverableSerializer(deliverable, context={'request': self.request}).data
        )


class DeliverableSubmitView(DeliverableActionView):
    """POST …/deliverables/{id}/submit/ — send this version for approval."""

    def post(self, request, project_id, pk):
        deliverable = self.get_deliverable()
        if deliverable.status == ProjectDeliverable.Status.APPROVED:
            return Response(
                {'detail': 'This version is already approved.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        deliverable.status = ProjectDeliverable.Status.PENDING
        deliverable.submitted_at = timezone.now()
        deliverable.submitted_by = request.user
        deliverable.save(update_fields=['status', 'submitted_at', 'submitted_by'])
        return self.responded(deliverable)


class DeliverableApproveView(DeliverableActionView):
    """POST …/deliverables/{id}/approve/ — client signed off on this version."""

    def post(self, request, project_id, pk):
        deliverable = self.get_deliverable()
        serializer = DeliverableReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        deliverable.status = ProjectDeliverable.Status.APPROVED
        deliverable.reviewed_at = timezone.now()
        deliverable.reviewed_by = request.user
        deliverable.review_remarks = serializer.validated_data['remarks']
        deliverable.save(update_fields=[
            'status', 'reviewed_at', 'reviewed_by', 'review_remarks',
        ])
        # The approved version is the one the client is looking at.
        deliverable.mark_current()
        return self.responded(deliverable)


class DeliverableRequestRevisionView(DeliverableActionView):
    """
    POST …/deliverables/{id}/request-revision/
    Body: { "remarks": "Kitchen island position needs to change" }
    """

    def post(self, request, project_id, pk):
        deliverable = self.get_deliverable()
        serializer = DeliverableReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        remarks = serializer.validated_data['remarks'].strip()

        if not remarks:
            return Response(
                {'detail': 'Say what needs changing when asking for a revision.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deliverable.status = ProjectDeliverable.Status.REVISION
        deliverable.reviewed_at = timezone.now()
        deliverable.reviewed_by = request.user
        deliverable.review_remarks = remarks
        deliverable.save(update_fields=[
            'status', 'reviewed_at', 'reviewed_by', 'review_remarks',
        ])
        return self.responded(deliverable)


# ── Estimates ──────────────────────────────────────────────

class EstimateListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/projects/{project_id}/estimates/        (?type=initial)
    POST /api/projects/{project_id}/estimates/

    Version numbers are assigned server-side, so two designers creating a
    revision at the same time cannot collide.
    """
    filterset_fields = ['type', 'status']

    def get_queryset(self):
        return Estimate.objects.filter(
            project_id=self.kwargs['project_id']
        ).prefetch_related('items')

    def get_serializer_class(self):
        return EstimateListSerializer if self.request.method == 'GET' else EstimateSerializer

    def perform_create(self, serializer):
        project_id = self.kwargs['project_id']
        estimate_type = serializer.validated_data.get('type')
        latest = (Estimate.objects
                  .filter(project_id=project_id, type=estimate_type)
                  .order_by('-version')
                  .first())
        serializer.save(
            project_id=project_id,
            version=(latest.version if latest else 0) + 1,
            created_by=self.request.user,
        )


class EstimateDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EstimateSerializer

    def get_queryset(self):
        return Estimate.objects.filter(
            project_id=self.kwargs['project_id']
        ).prefetch_related('items')


class EstimateActionView(APIView):
    """Shared lookup for the estimate workflow endpoints."""

    def get_estimate(self):
        return get_object_or_404(
            Estimate,
            pk=self.kwargs['pk'],
            project_id=self.kwargs['project_id'],
        )

    def responded(self, estimate):
        return Response(EstimateSerializer(estimate).data)


class EstimateSendView(EstimateActionView):
    """POST …/estimates/{id}/send/ — mark as sent for client approval."""

    def post(self, request, project_id, pk):
        estimate = self.get_estimate()
        if not estimate.items.exists():
            return Response(
                {'detail': 'Add at least one line item before sending.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if estimate.status == Estimate.Status.APPROVED:
            return Response(
                {'detail': 'This estimate is already approved.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        estimate.status = Estimate.Status.SENT
        estimate.sent_at = timezone.now()
        estimate.sent_by = request.user
        estimate.save(update_fields=['status', 'sent_at', 'sent_by', 'updated_at'])
        return self.responded(estimate)


class EstimateApproveView(EstimateActionView):
    """POST …/estimates/{id}/approve/ — client accepted this version."""

    def post(self, request, project_id, pk):
        estimate = self.get_estimate()
        estimate.status = Estimate.Status.APPROVED
        estimate.approved_at = timezone.now()
        estimate.approved_by = request.user
        estimate.client_remarks = request.data.get('client_remarks', estimate.client_remarks)
        estimate.save(update_fields=[
            'status', 'approved_at', 'approved_by', 'client_remarks', 'updated_at',
        ])
        return self.responded(estimate)


class EstimateRequestRevisionView(EstimateActionView):
    """POST …/estimates/{id}/request-revision/ — client wants changes."""

    def post(self, request, project_id, pk):
        estimate = self.get_estimate()
        estimate.status = Estimate.Status.REVISION
        estimate.client_remarks = request.data.get('client_remarks', '')
        estimate.save(update_fields=['status', 'client_remarks', 'updated_at'])
        return self.responded(estimate)


class EstimateDuplicateView(EstimateActionView):
    """
    POST …/estimates/{id}/duplicate/
    Body (optional): { "type": "final" }

    Copies the estimate and all its line items into a fresh draft — how a
    revision, or an initial → final promotion, is created.
    """

    def post(self, request, project_id, pk):
        source = self.get_estimate()
        target_type = request.data.get('type', source.type)
        if target_type not in dict(Estimate.EstimateType.choices):
            return Response(
                {'detail': f'Unknown estimate type: {target_type}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            latest = (Estimate.objects
                      .filter(project_id=project_id, type=target_type)
                      .order_by('-version')
                      .first())
            clone = Estimate.objects.create(
                project_id=project_id,
                type=target_type,
                version=(latest.version if latest else 0) + 1,
                status=Estimate.Status.DRAFT,
                title=source.title,
                notes=source.notes,
                discount_pct=source.discount_pct,
                discount_amount=source.discount_amount,
                created_by=request.user,
            )
            EstimateItem.objects.bulk_create([
                EstimateItem(
                    estimate=clone,
                    catalog_item=item.catalog_item,
                    sno=item.sno, area=item.area, item=item.item,
                    description=item.description,
                    length=item.length, breadth=item.breadth, height=item.height,
                    qty=item.qty, unit=item.unit, rate=item.rate,
                    amount=item.amount, gst_pct=item.gst_pct, remarks=item.remarks,
                )
                for item in source.items.all()
            ])

        return Response(EstimateSerializer(clone).data, status=status.HTTP_201_CREATED)


class EstimateItemListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/projects/{project_id}/estimates/{estimate_id}/items/"""
    serializer_class = EstimateItemSerializer

    def get_queryset(self):
        return EstimateItem.objects.filter(
            estimate_id=self.kwargs['estimate_id'],
            estimate__project_id=self.kwargs['project_id'],
        ).select_related('catalog_item')

    def perform_create(self, serializer):
        estimate = get_object_or_404(
            Estimate,
            pk=self.kwargs['estimate_id'],
            project_id=self.kwargs['project_id'],
        )
        serializer.save(estimate=estimate)


class EstimateAddFromCatalogView(APIView):
    """
    POST …/estimates/{estimate_id}/items/add-from-catalog/
    Body: { "items": [ {"item_id": 3, "area": "Kitchen", "qty": 2,
                        "rate": 225000}, ... ] }

    Each entry pulls the catalogue defaults; anything supplied alongside
    `item_id` overrides them.
    """
    OVERRIDABLE = {'area', 'item', 'description', 'length', 'breadth', 'height',
                   'qty', 'unit', 'rate', 'gst_pct', 'remarks'}

    def post(self, request, project_id, estimate_id):
        estimate = get_object_or_404(Estimate, pk=estimate_id, project_id=project_id)
        serializer = AddItemsToEstimateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entries = serializer.validated_data['items']
        catalog = Item.objects.in_bulk([e['item_id'] for e in entries])

        missing = [e['item_id'] for e in entries if e['item_id'] not in catalog]
        if missing:
            return Response(
                {'detail': f'Unknown catalogue item id(s): {missing}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = []
        with transaction.atomic():
            for entry in entries:
                source = catalog[entry['item_id']]
                overrides = {k: v for k, v in entry.items() if k in self.OVERRIDABLE}
                fields = source.as_estimate_line(**overrides)
                line = EstimateItem.objects.create(estimate=estimate, **fields)
                # Linked to a furniture? Seed the material breakdown from its BOM
                # so the line arrives fully costed, not just as a flat rate.
                if source.catalog_furniture_id:
                    populate_line_from_furniture(line, source.catalog_furniture, replace=True)
                created.append(line)

        return Response(
            {
                'detail': f'{len(created)} item(s) added.',
                'items': EstimateItemSerializer(created, many=True).data,
                'estimate': EstimateSerializer(estimate).data,
            },
            status=status.HTTP_201_CREATED,
        )


class EstimateItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EstimateItemSerializer

    def get_queryset(self):
        return EstimateItem.objects.filter(
            estimate_id=self.kwargs['estimate_id'],
            estimate__project_id=self.kwargs['project_id'],
        ).prefetch_related('components')


# ── Estimate line breakdown (bill of materials) ────────────

def _get_line(kwargs):
    return get_object_or_404(
        EstimateItem,
        pk=kwargs['item_id'],
        estimate_id=kwargs['estimate_id'],
        estimate__project_id=kwargs['project_id'],
    )


def populate_line_from_furniture(line, furniture, replace=True):
    """
    Copy a catalogue Furniture's bill of materials onto an estimate line's
    component breakdown, then roll the line amount up from it. Shared by the
    explicit "Pull from Catalogue" action and the add-from-catalogue flow when
    the source item is linked to a furniture. Returns the number of rows added.
    """
    if replace:
        line.components.all().delete()

    created = 0
    for part in furniture.parts.filter(is_active=True):
        for pm in part.materials.all():
            option = pm.effective_option
            wastage = pm.wastage_pct or Decimal('0')
            qty = (pm.qty_per_unit or Decimal('0')) * (Decimal('1') + wastage / Decimal('100'))
            EstimateItemComponent.objects.create(
                estimate_item=line,
                basic_component=pm.material.name,
                detail=option.detail if option else '',
                brand=option.brand if option else '',
                model=option.model_no if option else '',
                qty=qty,
                unit=pm.unit or (option.unit if option else pm.material.default_unit),
                price=option.price if option else Decimal('0'),
                catalog_material=pm.material,
                catalog_option=option,
            )
            created += 1

    line.recompute_amount()
    return created


class EstimateItemComponentListCreateView(generics.ListCreateAPIView):
    """
    GET/POST …/estimates/{estimate_id}/items/{item_id}/components/
    The material breakdown for one line. Adding a component makes the line's
    amount roll up from the breakdown instead of qty × rate.
    """
    serializer_class = EstimateItemComponentSerializer

    def get_queryset(self):
        return EstimateItemComponent.objects.filter(
            estimate_item_id=self.kwargs['item_id'],
            estimate_item__estimate_id=self.kwargs['estimate_id'],
            estimate_item__estimate__project_id=self.kwargs['project_id'],
        )

    def perform_create(self, serializer):
        serializer.save(estimate_item=_get_line(self.kwargs))


class EstimateItemComponentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EstimateItemComponentSerializer

    def get_queryset(self):
        return EstimateItemComponent.objects.filter(
            estimate_item_id=self.kwargs['item_id'],
            estimate_item__estimate_id=self.kwargs['estimate_id'],
            estimate_item__estimate__project_id=self.kwargs['project_id'],
        )


class EstimatePopulateFromFurnitureView(APIView):
    """
    POST …/estimates/{estimate_id}/items/{item_id}/populate-from-furniture/
    Body: { "furniture_id": 5, "replace": true }

    Fills the line's component breakdown from a catalogue Furniture's bill of
    materials — every part's materials become rows (Basic Component | Detail |
    Brand | Model | Qty | Unit | Price | Amount), pricing against each
    material's chosen or cheapest option. The line amount then rolls up from
    the breakdown.
    """
    def post(self, request, project_id, estimate_id, item_id):
        line = _get_line({'project_id': project_id, 'estimate_id': estimate_id, 'item_id': item_id})
        furniture_id = request.data.get('furniture_id')

        furniture = CatalogFurniture.objects.filter(pk=furniture_id).first()
        if not furniture:
            return Response({'detail': 'Unknown catalogue furniture.'},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            created = populate_line_from_furniture(
                line, furniture, replace=request.data.get('replace', True))
            if not line.item:
                line.item = furniture.name
                line.save(update_fields=['item'])

        line.refresh_from_db()
        return Response({
            'detail': f'{created} component(s) added from {furniture.name}.',
            'item': EstimateItemSerializer(line).data,
        }, status=status.HTTP_201_CREATED)


# ── Downloads ──────────────────────────────────────────────

def _download(content, filename, content_type):
    response = HttpResponse(content, content_type=content_type)
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response['Content-Length'] = len(content)
    return response


def _safe(text):
    """Filename-safe slug of a project name."""
    return re.sub(r'[^A-Za-z0-9]+', '_', text or 'project').strip('_') or 'project'


class EstimatePDFView(EstimateActionView):
    """GET …/estimates/{id}/pdf/ — download the quotation as a PDF."""

    def get(self, request, project_id, pk):
        estimate = self.get_estimate()
        filename = f'{_safe(estimate.project.name)}_{estimate.type}_v{estimate.version}.pdf'
        return _download(estimate_pdf(estimate), filename, 'application/pdf')


class EstimateExcelView(EstimateActionView):
    """GET …/estimates/{id}/excel/ — download the estimate as .xlsx."""

    def get(self, request, project_id, pk):
        estimate = self.get_estimate()
        filename = f'{_safe(estimate.project.name)}_{estimate.type}_v{estimate.version}.xlsx'
        return _download(
            estimate_xlsx(estimate), filename,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )


class BookingPDFView(APIView):
    """GET /api/projects/{project_id}/booking-form/pdf/"""

    def get(self, request, project_id):
        booking = get_object_or_404(BookingForm, project_id=project_id)
        filename = f'{booking.booking_number}_{_safe(booking.project.name)}.pdf'
        return _download(booking_pdf(booking), filename, 'application/pdf')


# ── Booking Form ───────────────────────────────────────────

class BookingFormView(APIView):
    """
    GET   /api/projects/{project_id}/booking-form/  — fetch (404 if none yet)
    POST  — create, seeded from the approved initial estimate
    PATCH — update (record advance, mark signed, …)
    """

    def get_object(self, project_id):
        return BookingForm.objects.filter(project_id=project_id).first()

    def get(self, request, project_id):
        booking = self.get_object(project_id)
        if not booking:
            return Response(
                {'detail': 'No booking form has been created for this project yet.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(BookingFormSerializer(booking).data)

    def post(self, request, project_id):
        project = get_object_or_404(Project, pk=project_id)
        if BookingForm.objects.filter(project=project).exists():
            return Response(
                {'detail': 'This project already has a booking form. Use PATCH to update it.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = request.data.copy()

        # Default the value from the approved initial estimate when not supplied.
        if not data.get('total_value'):
            approved = (project.estimates
                        .filter(type=Estimate.EstimateType.INITIAL,
                                status=Estimate.Status.APPROVED)
                        .order_by('-version')
                        .first())
            if approved:
                data['total_value'] = approved.grand_total
                data.setdefault('estimate', approved.pk)

        serializer = BookingFormSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        booking = serializer.save(project=project, created_by=request.user)
        return Response(BookingFormSerializer(booking).data, status=status.HTTP_201_CREATED)

    def patch(self, request, project_id):
        booking = self.get_object(project_id)
        if not booking:
            return Response(
                {'detail': 'No booking form to update. Create one first.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = BookingFormSerializer(booking, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()

        # Signing is what actually closes Initial Engagement.
        if booking.status == BookingForm.Status.SIGNED and not booking.signed_at:
            booking.signed_at = timezone.now()
            booking.save(update_fields=['signed_at'])

        return Response(BookingFormSerializer(booking).data)


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
