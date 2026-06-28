"""NICARA Accounts — URL patterns"""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Auth
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', views.MeView.as_view(), name='me'),
    # User management
    path('users/', views.UserListView.as_view(), name='user-list'),
    path('users/<int:pk>/', views.UserDetailView.as_view(), name='user-detail'),
    path('invite/', views.InviteUserView.as_view(), name='invite'),
    path('accept-invite/', views.AcceptInviteView.as_view(), name='accept-invite'),
    # IAM
    path('iam/permissions/', views.PermissionMatrixView.as_view(), name='permissions'),
]
