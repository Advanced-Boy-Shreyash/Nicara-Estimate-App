"""
NICARA Accounts — Views

API endpoints for authentication, user management, and IAM.
"""
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.mail import send_mail
from django.conf import settings

from .models import User, PagePermission
from .serializers import (
    UserSerializer, UserProfileSerializer, LoginSerializer,
    InviteUserSerializer, AcceptInviteSerializer,
    PagePermissionSerializer, BulkPermissionSerializer,
)


class IsAdmin(permissions.BasePermission):
    """Only admin users can access."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


# ── Authentication ──────────────────────────────────────────

class LoginView(APIView):
    """
    POST /api/auth/login/
    Body: { "email": "...", "password": "..." }
    Returns: { "token": { "access": "...", "refresh": "..." }, "user": {...} }
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        refresh = RefreshToken.for_user(user)
        return Response({
            'token': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
            'user': UserSerializer(user).data,
        })


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Body: { "refresh": "..." }
    Blacklists the refresh token.
    """
    def post(self, request):
        try:
            token = RefreshToken(request.data.get('refresh', ''))
            token.blacklist()
        except Exception:
            pass  # Token may already be blacklisted
        return Response({'detail': 'Logged out.'}, status=status.HTTP_200_OK)


class MeView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/auth/me/  — get current user profile
    PUT  /api/auth/me/  — update profile (name, phone)
    """
    serializer_class = UserProfileSerializer

    def get_object(self):
        return self.request.user


# ── User Management ─────────────────────────────────────────

class UserListView(generics.ListAPIView):
    """
    GET /api/auth/users/
    List all users (admin only).
    """
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]
    queryset = User.objects.all()
    filterset_fields = ['role', 'is_active']
    search_fields = ['first_name', 'last_name', 'email']


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET/PUT/DELETE /api/auth/users/{id}/
    Manage a specific user (admin only).
    """
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]
    queryset = User.objects.all()


class InviteUserView(APIView):
    """
    POST /api/auth/invite/
    Body: { "email": "...", "first_name": "...", "last_name": "...", "role": "...", "message": "..." }
    Creates user with invite token and sends email.
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = InviteUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Create inactive user
        user = User.objects.create_user(
            username=data['email'].split('@')[0],
            email=data['email'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            role=data['role'],
            is_active=False,
            invited_by=request.user,
        )
        token = user.generate_invite_token()

        # Send invite email
        invite_url = f"{settings.CORS_ALLOWED_ORIGINS[0]}/invite?token={token}"
        try:
            send_mail(
                subject='You are invited to NICARA Project OS',
                message=(
                    f"Hi {data['first_name']},\n\n"
                    f"{request.user.get_full_name()} has invited you to join NICARA Project OS "
                    f"as a {data['role']}.\n\n"
                    f"{data.get('message', '')}\n\n"
                    f"Click to accept: {invite_url}\n\n"
                    f"— NICARA Design"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[data['email']],
                fail_silently=True,
            )
            user.invite_email_sent = True
            user.save(update_fields=['invite_email_sent'])
        except Exception:
            pass  # Email sending is best-effort

        return Response({
            'detail': f"Invitation sent to {data['email']}",
            'user': UserSerializer(user).data,
        }, status=status.HTTP_201_CREATED)


class AcceptInviteView(APIView):
    """
    POST /api/auth/accept-invite/
    Body: { "token": "...", "password": "..." }
    Activates user account and sets password.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = AcceptInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.context['invited_user']
        user.set_password(serializer.validated_data['password'])
        user.invite_accepted = True
        user.invite_token = ''
        user.is_active = True
        user.save()

        # Auto-login: return JWT tokens
        refresh = RefreshToken.for_user(user)
        return Response({
            'detail': 'Invitation accepted. Welcome!',
            'token': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
            'user': UserSerializer(user).data,
        })


# ── IAM Permissions ─────────────────────────────────────────

class PermissionMatrixView(APIView):
    """
    GET  /api/iam/permissions/  — full permissions matrix
    PUT  /api/iam/permissions/  — bulk update
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        users = User.objects.filter(is_active=True).exclude(is_superuser=True)
        result = []
        for user in users:
            perms = {p.page_id: p.level for p in user.page_permissions.all()}
            result.append({
                'user': UserSerializer(user).data,
                'permissions': perms,
            })
        return Response(result)

    def put(self, request):
        serializer = BulkPermissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        for entry in serializer.validated_data['permissions']:
            PagePermission.objects.update_or_create(
                user_id=entry['user_id'],
                page_id=entry['page_id'],
                defaults={'level': entry['level']},
            )

        return Response({'detail': 'Permissions updated.'})
