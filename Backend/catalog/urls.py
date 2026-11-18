"""NICARA Catalogue — URL patterns (mounted at /api/catalog/)"""
from django.urls import path

from . import views

urlpatterns = [
    path('meta/', views.CatalogMetaView.as_view(), name='catalog-meta'),
    path('tree/', views.CatalogTreeView.as_view(), name='catalog-tree'),

    path('rooms/', views.RoomListCreateView.as_view(), name='catalog-room-list'),
    path('rooms/<int:pk>/', views.RoomDetailView.as_view(), name='catalog-room-detail'),
    path('zones/', views.ZoneListCreateView.as_view(), name='catalog-zone-list'),
    path('zones/<int:pk>/', views.ZoneDetailView.as_view(), name='catalog-zone-detail'),

    path('basic-components/', views.BasicComponentListCreateView.as_view(), name='catalog-basic-component-list'),
    path('basic-components/<int:pk>/', views.BasicComponentDetailView.as_view(), name='catalog-basic-component-detail'),

    path('furniture/', views.FurnitureListCreateView.as_view(), name='catalog-furniture-list'),
    path('furniture/<int:pk>/', views.FurnitureDetailView.as_view(), name='catalog-furniture-detail'),
    path('furniture/<int:pk>/calculate/', views.FurnitureCalculateView.as_view(), name='catalog-furniture-calculate'),
    path('furniture/<int:furniture_id>/components/', views.FurnitureComponentListCreateView.as_view(),
         name='catalog-furniture-component-list'),
    path('furniture/components/<int:pk>/', views.FurnitureComponentDetailView.as_view(),
         name='catalog-furniture-component-detail'),
]
