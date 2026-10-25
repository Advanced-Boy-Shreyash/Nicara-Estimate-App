"""
NICARA Projects — Views
Full CRUD for all project lifecycle resources.
"""
import os
import re

from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from decimal import Decimal

from catalog import rules
from catalog.models import Furniture as CatalogFurniture
from catalog.pricing import size_inches
from items.models import Item, ItemComponent, dimension_in_feet
from items.serializers import AddItemsToEstimateSerializer
from library.models import MaterialItem as LibraryMaterialItem
from nicara.media import build_derivatives

from . import generation
from .exports import booking_pdf, estimate_pdf, estimate_xlsx

from .models import (
    BookingForm, Project, DesignRequirement, ProjectFloorPlan, ProjectDeliverable, Estimate,
    EstimateItem, EstimateItemComponent, Measurement, MaterialSelection,
    ExecutionStage, PaymentMilestone, QualityCheck,
)
from .serializers import (
    BookingFormSerializer, ProjectListSerializer, ProjectDetailSerializer,
    DeliverableReviewSerializer, DesignRequirementBulkSerializer,
    DesignRequirementSerializer, ProjectFloorPlanSerializer, ProjectDeliverableSerializer,
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
    Body: { "rows": [ {id?, room, zone, unit, furniture, length, breadth, height,
                       finishing, options, remarks, design_required}, ... ] }

    Saves the whole grid: rows with an `id` are updated in place (so estimate
    groups generated from them stay linked), new rows are created, and rows
    left out are deleted.
    """

    def put(self, request, project_id):
        project = get_object_or_404(Project, pk=project_id)
        serializer = DesignRequirementBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rows = serializer.validated_data['rows']

        saved = []
        with transaction.atomic():
            existing = {dr.id: dr for dr in project.design_requirements.all()}
            for index, row in enumerate(rows, start=1):
                instance = existing.pop(row.get('id'), None) if row.get('id') else None
                payload = {k: v for k, v in row.items() if k != 'id'}
                row_serializer = DesignRequirementSerializer(
                    instance, data={**payload, 'sort_order': index})
                row_serializer.is_valid(raise_exception=True)
                saved.append(row_serializer.save(project=project))
            for leftover in existing.values():
                leftover.delete()

        return Response(
            DesignRequirementSerializer(saved, many=True).data,
            status=status.HTTP_200_OK,
        )


class ProjectFloorPlanListCreateView(generics.ListCreateAPIView):
    """List or upload floor-plan files for one project."""
    serializer_class = ProjectFloorPlanSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return ProjectFloorPlan.objects.filter(project_id=self.kwargs['project_id'])

    def create(self, request, *args, **kwargs):
        project = get_object_or_404(Project, pk=self.kwargs['project_id'])
        files = request.FILES.getlist('files')
        if not files:
            return Response(
                {'detail': 'Select at least one floor-plan file.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        upload_serializers = [
            self.get_serializer(data={'file': file})
            for file in files
        ]
        for serializer in upload_serializers:
            serializer.is_valid(raise_exception=True)

        created = []
        with transaction.atomic():
            for file, serializer in zip(files, upload_serializers):
                created.append(serializer.save(
                    project=project,
                    file_name=os.path.basename(file.name)[:255],
                    file_size=file.size,
                ))

        return Response(
            self.get_serializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class ProjectFloorPlanDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = ProjectFloorPlanSerializer

    def get_queryset(self):
        return ProjectFloorPlan.objects.filter(project_id=self.kwargs['project_id'])

    def perform_destroy(self, instance):
        instance.file.delete(save=False)
        instance.delete()


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
            # Copy every column (spreadsheet fields, generated-row links, overrides)
            # and each line's material breakdown.
            skip = {'id', 'estimate'}
            fields = [f.name for f in EstimateItem._meta.concrete_fields if f.name not in skip]
            for item in source.items.prefetch_related('components'):
                copy = EstimateItem.objects.create(
                    estimate=clone, **{f: getattr(item, f) for f in fields})
                for comp in item.components.all():
                    EstimateItemComponent.objects.create(
                        estimate_item=copy, sno=comp.sno, basic_component=comp.basic_component,
                        detail=comp.detail, brand=comp.brand, model=comp.model, qty=comp.qty,
                        unit=comp.unit, price=comp.price,
                        library_material_item=comp.library_material_item,
                    )

        return Response(EstimateSerializer(clone).data, status=status.HTTP_201_CREATED)


def _matching_material(category, chosen):
    """
    Which raw material a row of `category` should switch to when the user picks
    `chosen`: the same category takes it directly; another category in the same
    product group (e.g. a different ply thickness) takes its model from the same
    brand — same model name if there is one — so one choice covers all of them.
    """
    if category is None:
        return None
    if category.id == chosen.category_id:
        return chosen
    group = chosen.category.product_group
    if category.product_group != group or group == 'other' or not chosen.brand_id:
        return None
    same_brand = category.materials.filter(is_active=True, brand__name__iexact=chosen.brand.name)
    return (same_brand.filter(model_name__iexact=chosen.model_name).first()
            or same_brand.order_by('default_rate').first())


class EstimateApplySmartMaterialsView(EstimateActionView):
    """
    POST …/estimates/{id}/apply-smart-materials/
    Body: { "materials": [ {"library_item_id": 12}, … ] }

    Applies the chosen brands/models (Smart Estimate Generator) to the
    estimate's rows and to any line breakdowns, re-pricing them from the Raw
    Material Library. Quantities are untouched.
    """

    def post(self, request, project_id, pk):
        estimate = self.get_estimate()
        ids = [p.get('library_item_id') for p in request.data.get('materials', []) if p.get('library_item_id')]
        chosen = list(LibraryMaterialItem.objects.select_related('category', 'brand')
                      .filter(pk__in=ids, is_active=True))
        missing = set(ids) - {m.id for m in chosen}
        if missing:
            return Response({'detail': f'Unknown or inactive raw material id(s): {sorted(missing)}.'},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            rows = list(estimate.items.select_related(
                'basic_component__library_category', 'raw_material__category'))
            for row in rows:
                category = (row.basic_component.library_category if row.basic_component_id
                            else row.raw_material.category if row.raw_material_id else None)
                for item in chosen:
                    target = _matching_material(category, item)
                    if target is not None:
                        row.raw_material = target
                        row.brand = target.brand.name if target.brand_id else ''
                        row.model_name = target.model_name
                        row.rate = target.default_rate
                        row.save()
                        break

            components = (EstimateItemComponent.objects.filter(estimate_item__estimate=estimate)
                          .select_related('library_material_item__category'))
            for comp in components:
                category = comp.library_material_item.category if comp.library_material_item_id else None
                for item in chosen:
                    target = _matching_material(category, item)
                    if target is not None:
                        comp.library_material_item = target
                        comp.brand = target.brand.name if target.brand_id else ''
                        comp.model = target.model_name
                        comp.price = target.default_rate
                        comp.save()
                        break

        return self.responded(estimate)


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
                   'qty', 'unit', 'rate', 'gst_pct', 'remarks',
                   'width_ft', 'width_in', 'height_ft', 'height_in',
                   'depth_ft', 'depth_in'}

    def post(self, request, project_id, estimate_id):
        estimate = get_object_or_404(Estimate, pk=estimate_id, project_id=project_id)
        serializer = AddItemsToEstimateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entries = serializer.validated_data['items']
        catalog = Item.objects.prefetch_related(
            'components__material_item__category', 'components__material_item__brand',
            'components__service_item',
            'catalog_furniture__parts__materials__material',
            'catalog_furniture__parts__materials__default_option',
            'catalog_furniture__item_components__item__components__material_item__category',
            'catalog_furniture__item_components__item__components__material_item__brand',
            'catalog_furniture__item_components__item__components__service_item',
        ).in_bulk([e['item_id'] for e in entries])

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
                if source.catalog_furniture_id:
                    # A finished product: add it as its calculation-sheet rows.
                    furniture = source.catalog_furniture
                    width, height, depth = size_inches(
                        overrides.get('length') or source.default_length or furniture.default_length,
                        overrides.get('height') or source.default_height or furniture.default_height,
                        overrides.get('breadth') or source.default_breadth or furniture.default_breadth,
                    )
                    rows, _ = generation.create_group(
                        estimate, furniture, width, height, depth,
                        area=overrides.get('area', source.default_room), item_name=source.name)
                    created.extend(rows)
                    continue
                fields = source.as_estimate_line(**overrides)
                line = EstimateItem.objects.create(estimate=estimate, **fields)
                # An item with its own bill of materials arrives fully costed.
                if source.components.exists():
                    populate_line_from_item(line, source, replace=True)
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
    """
    PATCH a row. Typing a quantity on a generated row:
      • Doors / Drawers / Shelves → becomes the group's count, and every row of
        that furniture (channels, hinges, ply, locks, …) recalculates;
      • any other row → kept as an override (survives recalculation; reset via
        …/items/{id}/reset-qty/).
    """
    serializer_class = EstimateItemSerializer

    def get_queryset(self):
        return EstimateItem.objects.filter(
            estimate_id=self.kwargs['estimate_id'],
            estimate__project_id=self.kwargs['project_id'],
        ).prefetch_related('components')

    def perform_update(self, serializer):
        row = serializer.instance
        new_qty = serializer.validated_data.get('qty')
        if new_qty is not None and row.group_key and row.quantity_rule in rules.SPEC_RULES:
            serializer.validated_data.pop('qty')
            serializer.save()
            generation.set_spec_count(row.estimate, row, new_qty)
            return
        if new_qty is not None and row.calculated_qty is not None:
            serializer.save(qty_overridden=generation.qty_is_override(row, new_qty))
            return
        serializer.save()


class EstimateItemResetQtyView(APIView):
    """POST …/items/{item_id}/reset-qty/ — back to the calculated quantity."""

    def post(self, request, project_id, estimate_id, item_id):
        row = _get_line({'project_id': project_id, 'estimate_id': estimate_id, 'item_id': item_id})
        generation.reset_row_qty(row.estimate, row)
        row.refresh_from_db()
        return Response(EstimateItemSerializer(row).data)


# ── Estimate line breakdown (bill of materials) ────────────

def _get_line(kwargs):
    return get_object_or_404(
        EstimateItem,
        pk=kwargs['item_id'],
        estimate_id=kwargs['estimate_id'],
        estimate__project_id=kwargs['project_id'],
    )


def _estimate_dimension_factor(line, component):
    """Resolve dimension-based material quantities from the current estimate line."""
    if component.quantity_basis == ItemComponent.QuantityBasis.PER_UNIT:
        return Decimal('1')
    width = Decimal(line.width_ft or 0) + Decimal(line.width_in or 0) / Decimal('12')
    height = Decimal(line.height_ft or 0) + Decimal(line.height_in or 0) / Decimal('12')
    depth = Decimal(line.depth_ft or 0) + Decimal(line.depth_in or 0) / Decimal('12')
    width = width or dimension_in_feet(line.length or component.item.default_length)
    depth = depth or dimension_in_feet(line.breadth or component.item.default_breadth)
    height = height or dimension_in_feet(line.height or component.item.default_height)
    if component.quantity_basis == ItemComponent.QuantityBasis.LENGTH:
        if not width:
            raise ValidationError({'dimensions': 'Length is required for this item BOM.'})
        return width
    if component.quantity_basis == ItemComponent.QuantityBasis.AREA:
        if not width or not height:
            raise ValidationError({'dimensions': 'Length and height are required for this item BOM.'})
        return width * height
    if component.quantity_basis == ItemComponent.QuantityBasis.PLAN_AREA:
        if not width or not depth:
            raise ValidationError({'dimensions': 'Length and depth are required for this item BOM.'})
        return width * depth
    if not width or not depth or not height:
        raise ValidationError({'dimensions': 'All dimensions are required for this item BOM.'})
    return width * depth * height


def _append_item_bom(line, item, multiplier):
    created = 0
    for component in item.components.all():
        material = component.material_item
        service = component.service_item
        quantity = component.qty_per_unit or Decimal('0')
        quantity *= multiplier
        if material:
            quantity *= _estimate_dimension_factor(line, component)
            quantity *= Decimal('1') + (component.wastage_pct or Decimal('0')) / Decimal('100')
            category = material.category
            name = category.name
            detail = material.thickness or material.length or ''
            brand = material.brand.name if material.brand_id else ''
            model = material.model_name
            price = component.effective_rate
            unit = component.unit or material.default_unit
        elif service:
            category = None
            name = service.category
            detail = service.sub_type
            brand = ''
            model = service.name
            price = component.effective_rate
            unit = component.unit or service.default_unit
        else:
            category = None
            name = component.label or 'Other'
            detail = ''
            brand = ''
            model = ''
            price = component.effective_rate
            unit = component.unit
        EstimateItemComponent.objects.create(
            estimate_item=line,
            basic_component=name,
            detail=detail,
            brand=brand,
            model=model,
            qty=quantity,
            unit=unit,
            price=price,
            library_material_item=material,
        )
        created += 1
    return created


def populate_line_from_item(line, item, replace=True, multiplier=None):
    """Snapshot a reusable item's BOM into its estimate line."""
    if replace:
        line.components.all().delete()
    quantity = multiplier if multiplier is not None else (line.qty or Decimal('1'))
    created = _append_item_bom(line, item, quantity)
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



# ── Generated furniture groups (calculation sheet) ─────────

def _size_from_request(data, prefix):
    """ft/in pair (`width_ft`, `width_in`) or a written size (`width`: "7'0\\"") → inches, or None."""
    if data.get(f'{prefix}_ft') not in (None, '') or data.get(f'{prefix}_in') not in (None, ''):
        return rules.to_inches(data.get(f'{prefix}_ft') or 0, data.get(f'{prefix}_in') or 0)
    if data.get(prefix) not in (None, ''):
        value = rules.parse_inches(data.get(prefix))
        if value is None:
            raise ValidationError({prefix: f'Could not read the size "{data.get(prefix)}".'})
        return value
    return None


class EstimateGenerateFromDesignView(EstimateActionView):
    """
    POST …/estimates/{id}/generate-from-design/
    Turns every design requirement linked to a catalogue furniture into its
    calculation-sheet rows; re-running refreshes those groups to the latest
    sizes and options, keeping chosen brands and typed-over quantities.
    """

    def post(self, request, project_id, pk):
        estimate = self.get_estimate()
        if estimate.status == Estimate.Status.APPROVED:
            return Response({'detail': 'This estimate is approved and locked.'},
                            status=status.HTTP_400_BAD_REQUEST)
        summary = generation.generate_from_design(estimate)
        parts = [f"{summary['created']} added", f"{summary['updated']} refreshed"]
        if summary['skipped']:
            parts.append(f"{len(summary['skipped'])} without a catalogue furniture: "
                         + ', '.join(summary['skipped'][:5]))
        return Response({'detail': '; '.join(parts) + '.', **summary,
                         'estimate': EstimateSerializer(estimate).data})


class EstimateAddFurnitureView(EstimateActionView):
    """
    POST …/estimates/{id}/add-furniture/
    Body: { "furniture_id": 3, "area": "Master Bedroom", "zone": "East Wall",
            "item": "Wardrobe", "width": "7'0\\"", "height": "9'6\\"", "depth": "2'0\\"",
            "options": {...} }     (sizes may also be width_ft / width_in, …)
    """

    def post(self, request, project_id, pk):
        estimate = self.get_estimate()
        if estimate.status == Estimate.Status.APPROVED:
            return Response({'detail': 'This estimate is approved and locked.'},
                            status=status.HTTP_400_BAD_REQUEST)
        furniture = CatalogFurniture.objects.filter(pk=request.data.get('furniture_id'), is_active=True).first()
        if furniture is None:
            return Response({'detail': 'Pick a catalogue furniture.'}, status=status.HTTP_400_BAD_REQUEST)
        dw, dh, dd = size_inches(furniture.default_length, furniture.default_height, furniture.default_breadth)
        width = _size_from_request(request.data, 'width')
        height = _size_from_request(request.data, 'height')
        depth = _size_from_request(request.data, 'depth')
        rows, calc = generation.create_group(
            estimate, furniture, dw if width is None else width, dh if height is None else height,
            dd if depth is None else depth, options=request.data.get('options') or {},
            area=request.data.get('area', ''), zone=request.data.get('zone', ''),
            item_name=request.data.get('item') or furniture.name)
        return Response({'detail': f'{furniture.name}: {len(rows)} row(s) added.',
                         'group_key': rows[0].group_key if rows else '',
                         'warnings': calc.warnings,
                         'estimate': EstimateSerializer(estimate).data},
                        status=status.HTTP_201_CREATED)


class EstimateGroupView(EstimateActionView):
    """
    POST   …/estimates/{id}/groups/{group_key}/   recalculate — body may carry
           width/height/depth (or *_ft/*_in), options, area, zone, item
    DELETE …/estimates/{id}/groups/{group_key}/   remove the furniture's rows
    """

    def _locked(self, estimate):
        if estimate.status == Estimate.Status.APPROVED:
            return Response({'detail': 'This estimate is approved and locked.'},
                            status=status.HTTP_400_BAD_REQUEST)
        return None

    def post(self, request, project_id, pk, group_key):
        estimate = self.get_estimate()
        locked = self._locked(estimate)
        if locked is not None:
            return locked
        data = request.data
        try:
            rows, calc = generation.recalculate_group(
                estimate, group_key,
                width=_size_from_request(data, 'width'), height=_size_from_request(data, 'height'),
                depth=_size_from_request(data, 'depth'),
                options=data.get('options') if 'options' in data else None,
                area=data.get('area'), zone=data.get('zone'), item_name=data.get('item'))
        except LookupError:
            return Response({'detail': 'No rows in that group.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'detail': f'{len(rows)} row(s) recalculated.',
                         'calculation': calc.summary() if calc else None,
                         'estimate': EstimateSerializer(estimate).data})

    def delete(self, request, project_id, pk, group_key):
        estimate = self.get_estimate()
        locked = self._locked(estimate)
        if locked is not None:
            return locked
        deleted, _ = EstimateItem.objects.filter(estimate=estimate, group_key=group_key).delete()
        if not deleted:
            return Response({'detail': 'No rows in that group.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


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
