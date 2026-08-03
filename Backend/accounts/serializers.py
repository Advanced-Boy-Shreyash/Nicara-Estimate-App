"""
NICARA Accounts — Serializers

Converts Django model instances ↔ JSON for the REST API, and carries all
authentication validation (credentials, lockout, password strength, tokens).
"""
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers

from .models import LoginAttempt, PagePermission, User


class UserSerializer(serializers.ModelSerializer):
    """Full user representation (for admin views)."""
    full_name = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'phone', 'avatar_url', 'is_active', 'date_joined',
            'last_login', 'invite_accepted', 'permissions',
        ]
        read_only_fields = ['id', 'date_joined', 'last_login', 'invite_accepted']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.email

    def get_permissions(self, obj):
        return {p.page_id: p.level for p in obj.page_permissions.all()}


class UserProfileSerializer(serializers.ModelSerializer):
    """Current user's own profile — role and status are not self-editable."""
    full_name = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'phone', 'avatar_url', 'last_login', 'permissions',
        ]
        read_only_fields = ['id', 'email', 'role', 'last_login']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.email

    def get_permissions(self, obj):
        return {p.page_id: p.level for p in obj.page_permissions.all()}


class LoginSerializer(serializers.Serializer):
    """Email + password login with lockout protection."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    # One message for "no such user" and "wrong password" so the endpoint
    # cannot be used to enumerate registered email addresses.
    INVALID = 'Invalid email or password.'

    def validate(self, data):
        request = self.context.get('request')
        email = data['email'].lower()
        password = data['password']

        if LoginAttempt.is_locked(email):
            raise serializers.ValidationError({
                'detail': (
                    f'Too many failed attempts. This account is locked for '
                    f'{settings.LOGIN_LOCKOUT_MINUTES} minutes.'
                )
            }, code='locked')

        user = authenticate(request=request, username=email, password=password)

        if user is None:
            # `authenticate` returns None for inactive users too — separate the
            # two so a disabled account gets an accurate message.
            existing = User.objects.filter(email__iexact=email).first()
            LoginAttempt.record(email, successful=False, request=request, user=existing)
            if existing and not existing.is_active and existing.check_password(password):
                if not existing.invite_accepted:
                    raise serializers.ValidationError(
                        {'detail': 'Your invitation has not been accepted yet.'}
                    )
                raise serializers.ValidationError({'detail': 'This account is disabled.'})
            remaining = settings.LOGIN_MAX_FAILED_ATTEMPTS - LoginAttempt.recent_failures(email)
            detail = self.INVALID
            if 0 < remaining <= 2:
                detail = f'{self.INVALID} {remaining} attempt(s) remaining before lockout.'
            raise serializers.ValidationError({'detail': detail})

        LoginAttempt.record(email, successful=True, request=request, user=user)
        data['user'] = user
        return data


class ChangePasswordSerializer(serializers.Serializer):
    """Change the password of the authenticated user."""
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value

    def validate_new_password(self, value):
        user = self.context['request'].user
        try:
            validate_password(value, user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def validate(self, data):
        if data['current_password'] == data['new_password']:
            raise serializers.ValidationError(
                {'new_password': 'New password must be different from the current one.'}
            )
        return data


class PasswordResetRequestSerializer(serializers.Serializer):
    """Ask for a reset link. Always succeeds — never leaks whether email exists."""
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Complete a reset using the uid + token from the emailed link."""
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, data):
        try:
            pk = force_str(urlsafe_base64_decode(data['uid']))
            user = User.objects.get(pk=pk)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError({'detail': 'Invalid or expired reset link.'})

        if not default_token_generator.check_token(user, data['token']):
            raise serializers.ValidationError({'detail': 'Invalid or expired reset link.'})

        try:
            validate_password(data['new_password'], user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'new_password': list(exc.messages)})

        data['user'] = user
        return data


class InviteUserSerializer(serializers.Serializer):
    """Send invite to a new user."""
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    role = serializers.ChoiceField(choices=User.Role.choices)
    message = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value.lower()


class AcceptInviteSerializer(serializers.Serializer):
    """Accept invitation and set the initial password."""
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, data):
        try:
            user = User.objects.get(invite_token=data['token'], invite_accepted=False)
        except User.DoesNotExist:
            raise serializers.ValidationError({'detail': 'Invalid or expired invite token.'})

        try:
            validate_password(data['password'], user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})

        data['user'] = user
        return data


class PagePermissionSerializer(serializers.ModelSerializer):
    """Single user-page permission entry."""
    class Meta:
        model = PagePermission
        fields = ['id', 'user', 'page_id', 'level']


class BulkPermissionSerializer(serializers.Serializer):
    """Bulk update permissions for the IAM matrix."""
    permissions = serializers.ListField(
        child=serializers.DictField(child=serializers.CharField())
    )

    def validate_permissions(self, value):
        """Validate each entry has user_id, page_id, level."""
        valid_pages = {p[0] for p in PagePermission.PAGE_CHOICES}
        for entry in value:
            if not all(k in entry for k in ('user_id', 'page_id', 'level')):
                raise serializers.ValidationError(
                    'Each entry must have user_id, page_id, and level.'
                )
            if entry['page_id'] not in valid_pages:
                raise serializers.ValidationError(f"Invalid page_id: {entry['page_id']}")
            if entry['level'] not in dict(PagePermission.Level.choices):
                raise serializers.ValidationError(f"Invalid level: {entry['level']}")
        return value
