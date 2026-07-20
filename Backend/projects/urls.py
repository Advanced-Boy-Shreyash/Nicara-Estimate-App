"""
NICARA Projects — URL Configuration
"""
from django.urls import path
from . import views

urlpatterns = [
    # ── Projects ──
    path('', views.ProjectListCreateView.as_view(), name='project-list'),
    path('dashboard/', views.ProjectDashboardView.as_view(), name='project-dashboard'),
    path('<int:pk>/', views.ProjectDetailView.as_view(), name='project-detail'),

    # ── Design Requirements ──
    path('<int:project_id>/design-requirements/', views.DesignRequirementListCreateView.as_view(), name='design-req-list'),
    path('<int:project_id>/design-requirements/<int:pk>/', views.DesignRequirementDetailView.as_view(), name='design-req-detail'),

    # ── Deliverables (FL, MB, 3D, Renders, WD) ──
    path('<int:project_id>/deliverables/', views.DeliverableListCreateView.as_view(), name='deliverable-list'),
    path('<int:project_id>/deliverables/<int:pk>/', views.DeliverableDetailView.as_view(), name='deliverable-detail'),

    # ── Estimates ──
    path('<int:project_id>/estimates/', views.EstimateListCreateView.as_view(), name='estimate-list'),
    path('<int:project_id>/estimates/<int:pk>/', views.EstimateDetailView.as_view(), name='estimate-detail'),
    path('<int:project_id>/estimates/<int:estimate_id>/items/', views.EstimateItemListCreateView.as_view(), name='estimate-item-list'),
    path('<int:project_id>/estimates/<int:estimate_id>/items/<int:pk>/', views.EstimateItemDetailView.as_view(), name='estimate-item-detail'),

    # ── Measurements ──
    path('<int:project_id>/measurements/', views.MeasurementListCreateView.as_view(), name='measurement-list'),
    path('<int:project_id>/measurements/<int:pk>/', views.MeasurementDetailView.as_view(), name='measurement-detail'),

    # ── Material Selections ──
    path('<int:project_id>/material-selections/', views.MaterialSelectionListCreateView.as_view(), name='material-sel-list'),
    path('<int:project_id>/material-selections/<int:pk>/', views.MaterialSelectionDetailView.as_view(), name='material-sel-detail'),

    # ── Execution Stages ──
    path('<int:project_id>/execution-stages/', views.ExecutionStageListCreateView.as_view(), name='exec-stage-list'),
    path('<int:project_id>/execution-stages/<int:pk>/', views.ExecutionStageDetailView.as_view(), name='exec-stage-detail'),

    # ── Payments ──
    path('<int:project_id>/payments/', views.PaymentMilestoneListCreateView.as_view(), name='payment-list'),
    path('<int:project_id>/payments/<int:pk>/', views.PaymentMilestoneDetailView.as_view(), name='payment-detail'),

    # ── Quality Checks ──
    path('<int:project_id>/quality-checks/', views.QualityCheckListCreateView.as_view(), name='quality-list'),
    path('<int:project_id>/quality-checks/<int:pk>/', views.QualityCheckDetailView.as_view(), name='quality-detail'),

    # ── Vendors ──
    path('vendors/', views.VendorListCreateView.as_view(), name='vendor-list'),
    path('vendors/<int:pk>/', views.VendorDetailView.as_view(), name='vendor-detail'),
]
