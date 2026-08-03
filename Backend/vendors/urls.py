"""NICARA Vendors — URL patterns (mounted at /api/vendors/)"""
from django.urls import path

from . import views

urlpatterns = [
    path('', views.VendorListCreateView.as_view(), name='vendor-list'),
    path('meta/', views.VendorMetaView.as_view(), name='vendor-meta'),
    path('suppliers/', views.SupplierListCreateView.as_view(), name='supplier-list'),
    path('contractors/', views.ContractorListCreateView.as_view(), name='contractor-list'),
    path('<int:pk>/', views.VendorDetailView.as_view(), name='vendor-detail'),
    path('<int:vendor_id>/contacts/', views.VendorContactListCreateView.as_view(), name='vendor-contact-list'),
    path('<int:vendor_id>/contacts/<int:pk>/', views.VendorContactDetailView.as_view(), name='vendor-contact-detail'),
    path('<int:vendor_id>/documents/', views.VendorDocumentListCreateView.as_view(), name='vendor-document-list'),
    path('<int:vendor_id>/documents/<int:pk>/', views.VendorDocumentDetailView.as_view(), name='vendor-document-detail'),
]
