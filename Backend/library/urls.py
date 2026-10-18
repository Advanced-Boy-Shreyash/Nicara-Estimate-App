"""NICARA Component Library — URL patterns"""
from django.urls import path
from . import views

urlpatterns = [
    path('meta/', views.LibraryMetaView.as_view(), name='library-meta'),
    path('categories/', views.MaterialCategoryListCreateView.as_view(), name='category-list'),
    path('categories/<int:pk>/', views.MaterialCategoryDetailView.as_view(), name='category-detail'),
    path('brands/', views.MaterialBrandListCreateView.as_view(), name='brand-list'),
    path('brands/<int:pk>/', views.MaterialBrandDetailView.as_view(), name='brand-detail'),
    path('items/', views.MaterialItemListCreateView.as_view(), name='item-list'),
    path('items/<int:pk>/', views.MaterialItemDetailView.as_view(), name='item-detail'),
    path('smart-estimate-options/', views.SmartEstimateOptionsView.as_view(),
         name='smart-estimate-options'),
    path('services/', views.ServiceItemListCreateView.as_view(), name='service-list'),
    path('services/<int:pk>/', views.ServiceItemDetailView.as_view(), name='service-detail'),
]
