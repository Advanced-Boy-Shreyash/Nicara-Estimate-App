"""NICARA Accounts — URL patterns"""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from . import views

urlpatterns = [
    # ── Auth ──
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('me/', views.MeView.as_view(), name='me'),

    # ── Password ──
    path('change-password/', views.ChangePasswordView.as_view(), name='change-password'),
    path('password-reset/', views.PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset/confirm/', views.PasswordResetConfirmView.as_view(), name='password-reset-confirm'),

    # ── User management ──
    path('users/', views.UserListView.as_view(), name='user-list'),
    path('users/<int:pk>/', views.UserDetailView.as_view(), name='user-detail'),
    path('invite/', views.InviteUserView.as_view(), name='invite'),
    path('accept-invite/', views.AcceptInviteView.as_view(), name='accept-invite'),

    # ── IAM ──
    path('iam/permissions/', views.PermissionMatrixView.as_view(), name='permissions'),
]
