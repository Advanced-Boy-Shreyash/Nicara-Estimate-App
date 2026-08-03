"""NICARA Items — URL patterns (mounted at /api/items/)"""
from django.urls import path

from . import views

urlpatterns = [
    path('', views.ItemListCreateView.as_view(), name='item-list'),
    path('meta/', views.ItemMetaView.as_view(), name='item-meta'),
    path('categories/', views.ItemCategoryListCreateView.as_view(), name='item-category-list'),
    path('categories/<int:pk>/', views.ItemCategoryDetailView.as_view(), name='item-category-detail'),
    path('<int:pk>/', views.ItemDetailView.as_view(), name='item-detail'),
    path('<int:item_id>/components/', views.ItemComponentListCreateView.as_view(), name='item-component-list'),
    path('<int:item_id>/components/<int:pk>/', views.ItemComponentDetailView.as_view(), name='item-component-detail'),
]
