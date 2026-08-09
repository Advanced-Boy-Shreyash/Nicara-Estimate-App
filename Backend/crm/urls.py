"""NICARA CRM — URL patterns (mounted at /api/crm/)"""
from django.urls import path

from . import views

urlpatterns = [
    path('meta/', views.CrmMetaView.as_view(), name='crm-meta'),

    # ── Leads ──
    path('leads/', views.LeadListCreateView.as_view(), name='lead-list'),
    path('leads/pipeline/', views.LeadPipelineView.as_view(), name='lead-pipeline'),
    path('leads/<int:pk>/', views.LeadDetailView.as_view(), name='lead-detail'),
    path('leads/<int:lead_id>/notes/', views.LeadNoteListCreateView.as_view(), name='lead-notes'),
    path('leads/<int:lead_id>/convert/', views.ConvertLeadView.as_view(), name='lead-convert'),

    # ── Clients ──
    path('clients/', views.ClientListCreateView.as_view(), name='client-list'),
    path('clients/<int:pk>/', views.ClientDetailView.as_view(), name='client-detail'),
    path('clients/<int:client_id>/notes/', views.ClientNoteListCreateView.as_view(), name='client-notes'),
]
