"""
NICARA Projects — Views
"""
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Sum

from .models import (
    Project, ProjectRoom, EstimateItem, EstimateItemSpec,
    FurnitureLayout, MoodBoard, MoodBoardImage,
    PaymentSchedule, ServiceVendor, ProductVendor, Client,
)
from .serializers import (
    ProjectListSerializer, ProjectDetailSerializer, ProjectRoomSerializer,
    EstimateItemSerializer, EstimateItemWriteSerializer, EstimateItemSpecSerializer,
    FurnitureLayoutSerializer, MoodBoardSerializer, MoodBoardImageSerializer,
    PaymentScheduleSerializer, ServiceVendorSerializer, ProductVendorSerializer,
    ClientSerializer,
)


# ── Projects ────────────────────────────────────────────────

class ProjectListCreateView(generics.ListCreateAPIView):
    """GET /api/projects/ — list all, POST — create new."""
    queryset = Project.objects.all()
    filterset_fields = ['status', 'city', 'property_type']
    search_fields = ['name', 'client_name', 'project_name']
    ordering_fields = ['created_at', 'name', 'progress']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ProjectDetailSerializer
        return ProjectListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/projects/{id}/"""
    queryset = Project.objects.all()
    serializer_class = ProjectDetailSerializer


# ── Rooms ───────────────────────────────────────────────────

class ProjectRoomListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/projects/{project_id}/rooms/"""
    serializer_class = ProjectRoomSerializer

    def get_queryset(self):
        return ProjectRoom.objects.filter(project_id=self.kwargs['project_id'])

    def perform_create(self, serializer):
        serializer.save(project_id=self.kwargs['project_id'])


# ── Estimate Items ──────────────────────────────────────────

class EstimateItemListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/projects/{project_id}/estimate/"""
    filterset_fields = ['area', 'category', 'vendor_type', 'fac_or_site']

    def get_queryset(self):
        return EstimateItem.objects.filter(
            project_id=self.kwargs['project_id']
        ).prefetch_related('specs')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return EstimateItemWriteSerializer
        return EstimateItemSerializer

    def perform_create(self, serializer):
        serializer.save(project_id=self.kwargs['project_id'])


class EstimateItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/projects/{project_id}/estimate/{pk}/"""
    serializer_class = EstimateItemWriteSerializer

    def get_queryset(self):
        return EstimateItem.objects.filter(project_id=self.kwargs['project_id'])


class EstimateItemSpecListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/projects/{project_id}/estimate/{item_id}/specs/"""
    serializer_class = EstimateItemSpecSerializer

    def get_queryset(self):
        return EstimateItemSpec.objects.filter(
            estimate_item_id=self.kwargs['item_id'],
            estimate_item__project_id=self.kwargs['project_id'],
        )

    def perform_create(self, serializer):
        serializer.save(estimate_item_id=self.kwargs['item_id'])


class EstimateSummaryView(APIView):
    """GET /api/projects/{project_id}/estimate/summary/"""

    def get(self, request, project_id):
        items = EstimateItem.objects.filter(project_id=project_id)
        total = items.aggregate(total=Sum('amount'))['total'] or 0

        # Area breakdown
        area_totals = items.values('area').annotate(
            area_total=Sum('amount')
        ).order_by('area')

        return Response({
            'total': float(total),
            'item_count': items.count(),
            'area_breakdown': [
                {'area': a['area'], 'total': float(a['area_total'])}
                for a in area_totals
            ],
        })


# ── Furniture Layouts ───────────────────────────────────────

class FurnitureLayoutListCreateView(generics.ListCreateAPIView):
    serializer_class = FurnitureLayoutSerializer

    def get_queryset(self):
        return FurnitureLayout.objects.filter(project_id=self.kwargs['project_id'])

    def perform_create(self, serializer):
        serializer.save(
            project_id=self.kwargs['project_id'],
            uploaded_by=self.request.user,
        )


# ── Mood Boards ─────────────────────────────────────────────

class MoodBoardListCreateView(generics.ListCreateAPIView):
    serializer_class = MoodBoardSerializer

    def get_queryset(self):
        return MoodBoard.objects.filter(
            project_id=self.kwargs['project_id']
        ).prefetch_related('images')

    def perform_create(self, serializer):
        serializer.save(project_id=self.kwargs['project_id'])


class MoodBoardImageCreateView(generics.CreateAPIView):
    serializer_class = MoodBoardImageSerializer


# ── Payments ────────────────────────────────────────────────

class PaymentScheduleListCreateView(generics.ListCreateAPIView):
    serializer_class = PaymentScheduleSerializer

    def get_queryset(self):
        return PaymentSchedule.objects.filter(project_id=self.kwargs['project_id'])

    def perform_create(self, serializer):
        serializer.save(project_id=self.kwargs['project_id'])


# ── Vendors & Clients ──────────────────────────────────────

class ServiceVendorListCreateView(generics.ListCreateAPIView):
    queryset = ServiceVendor.objects.all()
    serializer_class = ServiceVendorSerializer
    search_fields = ['name', 'category']


class ServiceVendorDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ServiceVendor.objects.all()
    serializer_class = ServiceVendorSerializer


class ProductVendorListCreateView(generics.ListCreateAPIView):
    queryset = ProductVendor.objects.all()
    serializer_class = ProductVendorSerializer
    search_fields = ['name', 'category']


class ProductVendorDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ProductVendor.objects.all()
    serializer_class = ProductVendorSerializer


class ClientListCreateView(generics.ListCreateAPIView):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    search_fields = ['name', 'email', 'phone']


class ClientDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
