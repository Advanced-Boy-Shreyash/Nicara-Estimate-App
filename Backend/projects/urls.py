"""
NICARA Projects — URL Configuration

Mounted at /api/projects/ so the project list is /api/projects/.
Vendors moved to their own app at /api/vendors/.
"""
from django.urls import path
from . import views

urlpatterns = [
    # ── Projects ──
    path('', views.ProjectListCreateView.as_view(), name='project-list'),
    path('dashboard/', views.ProjectDashboardView.as_view(), name='project-dashboard'),
    path('meta/', views.ProjectMetaView.as_view(), name='project-meta'),
    path('<int:pk>/', views.ProjectDetailView.as_view(), name='project-detail'),

    # ══ INITIAL ENGAGEMENT ══════════════════════════════════

    # Client Details is the Project record itself (PATCH /api/projects/{id}/).

    # ── Design Requirements ──
    path('<int:project_id>/design-requirements/', views.DesignRequirementListCreateView.as_view(), name='design-req-list'),
    path('<int:project_id>/design-requirements/bulk/', views.DesignRequirementBulkView.as_view(), name='design-req-bulk'),
    path('<int:project_id>/design-requirements/<int:pk>/', views.DesignRequirementDetailView.as_view(), name='design-req-detail'),

    # ── Deliverables (FL, MB, 3D, Renders, WD) ──
    path('<int:project_id>/deliverables/', views.DeliverableListCreateView.as_view(), name='deliverable-list'),
    path('<int:project_id>/deliverables/<int:pk>/', views.DeliverableDetailView.as_view(), name='deliverable-detail'),

    # ── Estimates ──
    path('<int:project_id>/estimates/', views.EstimateListCreateView.as_view(), name='estimate-list'),
    path('<int:project_id>/estimates/<int:pk>/', views.EstimateDetailView.as_view(), name='estimate-detail'),
    path('<int:project_id>/estimates/<int:pk>/send/', views.EstimateSendView.as_view(), name='estimate-send'),
    path('<int:project_id>/estimates/<int:pk>/approve/', views.EstimateApproveView.as_view(), name='estimate-approve'),
    path('<int:project_id>/estimates/<int:pk>/request-revision/', views.EstimateRequestRevisionView.as_view(), name='estimate-revision'),
    path('<int:project_id>/estimates/<int:pk>/duplicate/', views.EstimateDuplicateView.as_view(), name='estimate-duplicate'),
    path('<int:project_id>/estimates/<int:estimate_id>/items/', views.EstimateItemListCreateView.as_view(), name='estimate-item-list'),
    path('<int:project_id>/estimates/<int:estimate_id>/items/add-from-catalog/', views.EstimateAddFromCatalogView.as_view(), name='estimate-item-from-catalog'),
    path('<int:project_id>/estimates/<int:estimate_id>/items/<int:pk>/', views.EstimateItemDetailView.as_view(), name='estimate-item-detail'),

    # ── Booking Form ──
    path('<int:project_id>/booking-form/', views.BookingFormView.as_view(), name='booking-form'),

    # ══ DESIGN PHASE ════════════════════════════════════════
    path('<int:project_id>/measurements/', views.MeasurementListCreateView.as_view(), name='measurement-list'),
    path('<int:project_id>/measurements/<int:pk>/', views.MeasurementDetailView.as_view(), name='measurement-detail'),
    path('<int:project_id>/material-selections/', views.MaterialSelectionListCreateView.as_view(), name='material-sel-list'),
    path('<int:project_id>/material-selections/<int:pk>/', views.MaterialSelectionDetailView.as_view(), name='material-sel-detail'),

    # ══ EXECUTION PHASE ═════════════════════════════════════
    path('<int:project_id>/execution-stages/', views.ExecutionStageListCreateView.as_view(), name='exec-stage-list'),
    path('<int:project_id>/execution-stages/<int:pk>/', views.ExecutionStageDetailView.as_view(), name='exec-stage-detail'),
    path('<int:project_id>/payments/', views.PaymentMilestoneListCreateView.as_view(), name='payment-list'),
    path('<int:project_id>/payments/<int:pk>/', views.PaymentMilestoneDetailView.as_view(), name='payment-detail'),
    path('<int:project_id>/quality-checks/', views.QualityCheckListCreateView.as_view(), name='quality-list'),
    path('<int:project_id>/quality-checks/<int:pk>/', views.QualityCheckDetailView.as_view(), name='quality-detail'),
]
