"""NICARA Catalogue — URL patterns (mounted at /api/catalog/)"""
from django.urls import path

from . import views

urlpatterns = [
    path('meta/', views.CatalogMetaView.as_view(), name='catalog-meta'),
    path('tree/', views.CatalogTreeView.as_view(), name='catalog-tree'),

    # Rooms
    path('rooms/', views.RoomListCreateView.as_view(), name='catalog-room-list'),
    path('rooms/<int:pk>/', views.RoomDetailView.as_view(), name='catalog-room-detail'),

    # Zones
    path('zones/', views.ZoneListCreateView.as_view(), name='catalog-zone-list'),
    path('zones/<int:pk>/', views.ZoneDetailView.as_view(), name='catalog-zone-detail'),

    # Materials & options
    path('materials/', views.MaterialListCreateView.as_view(), name='catalog-material-list'),
    path('materials/<int:pk>/', views.MaterialDetailView.as_view(), name='catalog-material-detail'),
    path('materials/<int:material_id>/options/', views.MaterialOptionListCreateView.as_view(), name='catalog-option-list'),
    path('materials/<int:material_id>/options/<int:pk>/', views.MaterialOptionDetailView.as_view(), name='catalog-option-detail'),

    # Furniture → parts → materials
    path('furniture/', views.FurnitureListCreateView.as_view(), name='catalog-furniture-list'),
    path('furniture/<int:pk>/', views.FurnitureDetailView.as_view(), name='catalog-furniture-detail'),
    path('furniture/<int:furniture_id>/parts/', views.FurniturePartListCreateView.as_view(), name='catalog-part-list'),
    path('furniture/parts/<int:pk>/', views.FurniturePartDetailView.as_view(), name='catalog-part-detail'),
    path('furniture/parts/<int:part_id>/materials/', views.PartMaterialListCreateView.as_view(), name='catalog-partmaterial-list'),
    path('furniture/part-materials/<int:pk>/', views.PartMaterialDetailView.as_view(), name='catalog-partmaterial-detail'),
]
