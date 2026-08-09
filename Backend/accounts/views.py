"""
NICARA Accounts — Views

API endpoints for authentication, user management, and IAM.

Auth flow
---------
POST /api/auth/login/            → { access, refresh, user }
POST /api/auth/token/refresh/    → { access, refresh }   (rotating)
POST /api/auth/logout/           → blacklists the refresh token
GET  /api/auth/me/               → current user profile
"""
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import LoginAttempt, PagePermission, User
from .modules import MODULE_IDS, ROLE_TEMPLATES, modules_payload, satisfies, template_for
from .permissions import (
    IsAdminOrHasIAM, IsAdminOrHasUsers, user_level, user_permission_map,
)
from .serializers import (
    AcceptInviteSerializer, BulkPermissionSerializer, ChangePasswordSerializer,
    InviteUserSerializer, LoginSerializer, PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer, UserProfileSerializer, UserSerializer,
)


class IsAdmin(permissions.BasePermission):
    """Only admin users can access."""
    message = 'Administrator access required.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin)


def issue_tokens(user):
    """Mint a fresh access/refresh pair for `user`."""
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


def auth_response(user, *, status_code=status.HTTP_200_OK, **extra):
    """Standard authenticated payload returned by login / accept-invite / reset."""
    payload = {'token': issue_tokens(user), 'user': UserSerializer(user).data}
    payload.update(extra)
    return Response(payload, status=status_code)


# ── Authentication ──────────────────────────────────────────

class LoginView(APIView):
    """
    POST /api/auth/login/
    Body: { "email": "...", "password": "..." }
    Returns: { "token": { "access": "...", "refresh": "..." }, "user": {...} }
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = 'login'

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        return auth_response(user)


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Body: { "refresh": "..." }
    Blacklists the refresh token so it cannot be reused.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh = request.data.get('refresh')
        if not refresh:
            return Response(
                {'detail': 'A refresh token is required to log out.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            RefreshToken(refresh).blacklist()
        except Exception:
            # Already blacklisted, malformed or expired — the client is logged
            # out either way, so this is not an error worth surfacing.
            pass
        return Response({'detail': 'Logged out.'}, status=status.HTTP_200_OK)


class MeView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/auth/me/  — current user profile
    PATCH /api/auth/me/  — update own profile (name, phone, avatar)
    """
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    Body: { "current_password": "...", "new_password": "..." }
    Rotates credentials and returns a fresh token pair.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.password_changed_at = timezone.now()
        user.save(update_fields=['password', 'password_changed_at'])

        # The old refresh token is now stale — hand the client a new pair.
        return Response({
            'detail': 'Password updated.',
            'token': issue_tokens(user),
        })


class PasswordResetRequestView(APIView):
    """
    POST /api/auth/password-reset/
    Body: { "email": "..." }
    Always returns 200 — the response does not reveal whether the email exists.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = 'password_reset'

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f'{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}'
            send_mail(
                subject='Reset your NICARA password',
                message=(
                    f'Hi {user.first_name or "there"},\n\n'
                    f'Use the link below to choose a new password. It expires in '
                    f'{settings.PASSWORD_RESET_TIMEOUT // 3600} hours.\n\n'
                    f'{reset_url}\n\n'
                    f'If you did not request this, you can safely ignore this email.\n\n'
                    f'— NICARA Design'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )

        return Response({
            'detail': 'If an account exists for that email, a reset link has been sent.'
        })


class PasswordResetConfirmView(APIView):
    """
    POST /api/auth/password-reset/confirm/
    Body: { "uid": "...", "token": "...", "new_password": "..." }
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = 'password_reset'

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        user.set_password(serializer.validated_data['new_password'])
        user.password_changed_at = timezone.now()
        user.save(update_fields=['password', 'password_changed_at'])

        return auth_response(user, detail='Password reset. You are now signed in.')


# ── User Management ─────────────────────────────────────────

class UserListView(generics.ListAPIView):
    """
    GET /api/auth/users/
    List all users (admin only).
    """
    serializer_class = UserSerializer
    permission_classes = [IsAdminOrHasUsers]
    queryset = User.objects.prefetch_related('page_permissions').all()
    filterset_fields = ['role', 'is_active']
    search_fields = ['first_name', 'last_name', 'email']


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET/PUT/DELETE /api/auth/users/{id}/
    Manage a specific user (admin only).
    """
    serializer_class = UserSerializer
    permission_classes = [IsAdminOrHasUsers]
    queryset = User.objects.prefetch_related('page_permissions').all()

    def perform_destroy(self, instance):
        if instance == self.request.user:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'You cannot delete your own account.'})
        # Deactivate rather than destroy so project history stays intact.
        instance.is_active = False
        instance.save(update_fields=['is_active'])


class InviteUserView(APIView):
    """
    POST /api/auth/invite/
    Body: { "email", "first_name", "last_name", "role", "message" }
    Creates an inactive user with an invite token and emails the link.
    """
    permission_classes = [IsAdminOrHasUsers]

    def post(self, request):
        serializer = InviteUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # password=None gives an unusable password until the invite is accepted.
        user = User.objects.create_user(
            email=data['email'],
            password=None,
            first_name=data['first_name'],
            last_name=data['last_name'],
            role=data['role'],
            invited_by=request.user,
        )

        # Seed the IAM matrix from the role template so an invited user is
        # never left with zero access waiting on a manual setup step.
        PagePermission.objects.bulk_create([
            PagePermission(user=user, page_id=module_id, level=level)
            for module_id, level in template_for(data['role']).items()
            if level != 'none'
        ])

        token = user.generate_invite_token()

        invite_url = f'{settings.FRONTEND_URL}/accept-invite?token={token}'
        sent = send_mail(
            subject='You are invited to NICARA Project OS',
            message=(
                f"Hi {data['first_name']},\n\n"
                f"{request.user.get_full_name() or request.user.email} has invited you "
                f"to join NICARA Project OS as a {user.get_role_display()}.\n\n"
                f"{data.get('message', '')}\n\n"
                f"Click to accept and set your password: {invite_url}\n\n"
                f"— NICARA Design"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )
        if sent:
            user.invite_email_sent = True
            user.save(update_fields=['invite_email_sent'])

        response = {
            'detail': f"Invitation sent to {user.email}",
            'user': UserSerializer(user).data,
        }
        if settings.DEBUG:
            # Convenience for local development, where email goes to the console.
            response['invite_url'] = invite_url
        return Response(response, status=status.HTTP_201_CREATED)


class AcceptInviteView(APIView):
    """
    POST /api/auth/accept-invite/
    Body: { "token": "...", "password": "..." }
    Activates the account, sets the password, and signs the user in.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = 'accept_invite'

    def post(self, request):
        serializer = AcceptInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        user.set_password(serializer.validated_data['password'])
        user.password_changed_at = timezone.now()
        user.invite_accepted = True
        user.invite_token = ''
        user.is_active = True
        user.last_login = timezone.now()
        user.save()

        LoginAttempt.record(user.email, successful=True, request=request, user=user)
        return auth_response(user, detail='Invitation accepted. Welcome!')


# ── IAM Permissions ─────────────────────────────────────────

class ModuleListView(APIView):
    """
    GET /api/auth/iam/modules/
    The module registry plus role templates — everything the IAM matrix needs
    to render itself.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({
            'groups': modules_payload(),
            'levels': [
                {'value': 'none', 'label': 'No Access'},
                {'value': 'view', 'label': 'View Only'},
                {'value': 'edit', 'label': 'Edit'},
                {'value': 'full', 'label': 'Full Access'},
            ],
            'role_templates': ROLE_TEMPLATES,
        })


class MyPermissionsView(APIView):
    """
    GET /api/auth/iam/my-permissions/
    What the signed-in user may see — the frontend filters its nav with this.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({
            'is_admin': request.user.is_admin,
            'can_manage_iam': request.user.is_admin
                              or satisfies(user_level(request.user, 'iam'), 'full'),
            'permissions': user_permission_map(request.user),
        })


class PermissionMatrixView(APIView):
    """
    GET  /api/auth/iam/permissions/  — full permissions matrix
    PUT  /api/auth/iam/permissions/  — bulk update

    Open to admins and to anyone granted full access to the `iam` module.
    """
    permission_classes = [IsAdminOrHasIAM]

    def get(self, request):
        users = (User.objects
                 .filter(is_active=True)
                 .prefetch_related('page_permissions'))
        return Response([
            {
                'user': UserSerializer(user).data,
                'permissions': (
                    # Admins implicitly hold everything; show that rather than
                    # an empty row the operator might try to "fix".
                    {module_id: 'full' for module_id in MODULE_IDS}
                    if user.is_admin
                    else {p.page_id: p.level for p in user.page_permissions.all()}
                ),
                'is_admin': user.is_admin,
            }
            for user in users
        ])

    def put(self, request):
        serializer = BulkPermissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entries = serializer.validated_data['permissions']
        with transaction.atomic():
            for entry in entries:
                user = User.objects.filter(pk=entry['user_id']).first()
                if not user:
                    raise DRFValidationError(
                        {'detail': f"Unknown user id {entry['user_id']}."}
                    )
                if user.is_admin:
                    # Admin access is implicit — storing rows would imply it can
                    # be revoked here, which it cannot.
                    continue
                if entry['level'] == 'none':
                    PagePermission.objects.filter(
                        user=user, page_id=entry['page_id']
                    ).delete()
                else:
                    PagePermission.objects.update_or_create(
                        user=user, page_id=entry['page_id'],
                        defaults={'level': entry['level']},
                    )

        return Response({'detail': f'{len(entries)} permission(s) updated.'})


class ApplyRoleTemplateView(APIView):
    """
    POST /api/auth/iam/apply-template/
    Body: { "user_id": 3, "role": "designer" }

    Replaces a user's matrix with the template for that role — the starting
    point an admin then fine-tunes.
    """
    permission_classes = [IsAdminOrHasIAM]

    def post(self, request):
        user_id = request.data.get('user_id')
        role = request.data.get('role')

        user = User.objects.filter(pk=user_id).first()
        if not user:
            return Response({'detail': 'Unknown user.'}, status=status.HTTP_400_BAD_REQUEST)
        if role not in ROLE_TEMPLATES:
            return Response(
                {'detail': f'Unknown role template: {role}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.is_admin:
            return Response(
                {'detail': 'Admins already hold every module.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        template = template_for(role)
        with transaction.atomic():
            user.page_permissions.all().delete()
            PagePermission.objects.bulk_create([
                PagePermission(user=user, page_id=module_id, level=level)
                for module_id, level in template.items()
                if level != 'none'
            ])

        return Response({
            'detail': f'Applied the {role} template to {user.email}.',
            'permissions': {p.page_id: p.level for p in user.page_permissions.all()},
        })
