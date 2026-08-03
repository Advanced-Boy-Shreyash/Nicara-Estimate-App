"""
NICARA Vendors — Views

    /api/vendors/                 all vendors  (?vendor_type=…&city=…&search=…)
    /api/vendors/suppliers/       material suppliers only
    /api/vendors/contractors/     contractors only
    /api/vendors/{id}/            retrieve / update / deactivate
    /api/vendors/{id}/contacts/   extra contact people
    /api/vendors/{id}/documents/  compliance paperwork
    /api/vendors/meta/            dropdown choices for the vendor forms
"""
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Vendor, VendorContact, VendorDocument
from .serializers import (
    VendorContactSerializer, VendorDocumentSerializer,
    VendorListSerializer, VendorSerializer,
)

COMMON_FILTERS = ['vendor_type', 'city', 'state', 'trade', 'is_active', 'is_preferred']
COMMON_SEARCH = ['name', 'code', 'contact_person', 'phone', 'email',
                 'brands_supplied', 'specialization', 'city']
COMMON_ORDERING = ['name', 'rating', 'created_at', 'lead_time_days']


class VendorListCreateView(generics.ListCreateAPIView):
    """GET /api/vendors/ — list, POST — create."""
    queryset = Vendor.objects.prefetch_related('contacts', 'material_categories').all()
    filterset_fields = COMMON_FILTERS
    search_fields = COMMON_SEARCH
    ordering_fields = COMMON_ORDERING

    def get_serializer_class(self):
        return VendorSerializer if self.request.method == 'POST' else VendorListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class TypedVendorListCreateView(VendorListCreateView):
    """
    Base for the two type-scoped endpoints.

    `vendor_type` is stamped onto the payload *before* validation, so callers
    never have to send it and cannot post the wrong type to the wrong URL.
    """
    forced_type: str = ''

    def get_serializer(self, *args, **kwargs):
        if 'data' in kwargs:
            data = kwargs['data'].copy()
            data['vendor_type'] = self.forced_type
            kwargs['data'] = data
        return super().get_serializer(*args, **kwargs)


class SupplierListCreateView(TypedVendorListCreateView):
    """GET/POST /api/vendors/suppliers/ — material suppliers."""
    forced_type = Vendor.VendorType.MATERIAL_SUPPLIER

    def get_queryset(self):
        return super().get_queryset().suppliers()


class ContractorListCreateView(TypedVendorListCreateView):
    """GET/POST /api/vendors/contractors/ — contractors."""
    forced_type = Vendor.VendorType.CONTRACTOR

    def get_queryset(self):
        return super().get_queryset().contractors()


class VendorDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/vendors/{id}/"""
    queryset = Vendor.objects.prefetch_related('contacts', 'documents', 'material_categories')
    serializer_class = VendorSerializer

    def perform_destroy(self, instance):
        # Vendors are referenced by historical purchase and execution records,
        # so deactivate instead of deleting.
        instance.is_active = False
        instance.save(update_fields=['is_active'])


class VendorContactListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/vendors/{vendor_id}/contacts/"""
    serializer_class = VendorContactSerializer

    def get_queryset(self):
        return VendorContact.objects.filter(vendor_id=self.kwargs['vendor_id'])

    def perform_create(self, serializer):
        serializer.save(vendor_id=self.kwargs['vendor_id'])


class VendorContactDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = VendorContactSerializer

    def get_queryset(self):
        return VendorContact.objects.filter(vendor_id=self.kwargs['vendor_id'])


class VendorDocumentListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/vendors/{vendor_id}/documents/ (multipart upload)"""
    serializer_class = VendorDocumentSerializer

    def get_queryset(self):
        return VendorDocument.objects.filter(vendor_id=self.kwargs['vendor_id'])

    def perform_create(self, serializer):
        serializer.save(vendor_id=self.kwargs['vendor_id'])


class VendorDocumentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = VendorDocumentSerializer

    def get_queryset(self):
        return VendorDocument.objects.filter(vendor_id=self.kwargs['vendor_id'])


class VendorMetaView(APIView):
    """GET /api/vendors/meta/ — choice lists for building the vendor forms."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        def choices(source):
            return [{'value': v, 'label': l} for v, l in source]

        return Response({
            'vendor_types': choices(Vendor.VendorType.choices),
            'trades': choices(Vendor.Trade.choices),
            'payment_terms': choices(Vendor.PaymentTerms.choices),
            'document_types': choices(VendorDocument.DocType.choices),
            'counts': {
                'suppliers': Vendor.objects.suppliers().active().count(),
                'contractors': Vendor.objects.contractors().active().count(),
            },
        })
