"""NICARA Projects — URL patterns"""
from django.urls import path
from . import views

urlpatterns = [
    # Projects
    path('projects/', views.ProjectListCreateView.as_view(), name='project-list'),
    path('projects/<int:pk>/', views.ProjectDetailView.as_view(), name='project-detail'),
    # Rooms
    path('projects/<int:project_id>/rooms/', views.ProjectRoomListCreateView.as_view(), name='room-list'),
    # Estimates
    path('projects/<int:project_id>/estimate/', views.EstimateItemListCreateView.as_view(), name='estimate-list'),
    path('projects/<int:project_id>/estimate/summary/', views.EstimateSummaryView.as_view(), name='estimate-summary'),
    path('projects/<int:project_id>/estimate/<int:pk>/', views.EstimateItemDetailView.as_view(), name='estimate-detail'),
    path('projects/<int:project_id>/estimate/<int:item_id>/specs/', views.EstimateItemSpecListCreateView.as_view(), name='spec-list'),
    # Layouts
    path('projects/<int:project_id>/layouts/', views.FurnitureLayoutListCreateView.as_view(), name='layout-list'),
    # Mood boards
    path('projects/<int:project_id>/moodboards/', views.MoodBoardListCreateView.as_view(), name='moodboard-list'),
    path('moodboard-images/', views.MoodBoardImageCreateView.as_view(), name='moodboard-image'),
    # Payments
    path('projects/<int:project_id>/payments/', views.PaymentScheduleListCreateView.as_view(), name='payment-list'),
    # Vendors
    path('vendors/service/', views.ServiceVendorListCreateView.as_view(), name='service-vendor-list'),
    path('vendors/service/<int:pk>/', views.ServiceVendorDetailView.as_view(), name='service-vendor-detail'),
    path('vendors/product/', views.ProductVendorListCreateView.as_view(), name='product-vendor-list'),
    path('vendors/product/<int:pk>/', views.ProductVendorDetailView.as_view(), name='product-vendor-detail'),
    # Clients
    path('clients/', views.ClientListCreateView.as_view(), name='client-list'),
    path('clients/<int:pk>/', views.ClientDetailView.as_view(), name='client-detail'),
]
