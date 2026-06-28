"""
NICARA Accounts — Serializers

Converts Django model instances ↔ JSON for the REST API.
"""
from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, PagePermission


class UserSerializer(serializers.ModelSerializer):
    """Full user representation (for admin views)."""
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'phone', 'avatar_url', 'is_active', 'date_joined',
            'last_login', 'invite_accepted',
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class UserProfileSerializer(serializers.ModelSerializer):
    """Current user's own profile (limited fields)."""
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'role', 'phone', 'avatar_url']
        read_only_fields = ['id', 'role']


class LoginSerializer(serializers.Serializer):
    """Email + password login."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data.get('email')
        password = data.get('password')

        # Django auth uses username, so find user by email first
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError('Invalid email or password.')

        user = authenticate(username=user.username, password=password)
        if not user:
            raise serializers.ValidationError('Invalid email or password.')
        if not user.is_active:
            raise serializers.ValidationError('Account is disabled.')

        data['user'] = user
        return data


class InviteUserSerializer(serializers.Serializer):
    """Send invite to a new user."""
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=30)
    last_name = serializers.CharField(max_length=30)
    role = serializers.ChoiceField(choices=User.Role.choices)
    message = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value


class AcceptInviteSerializer(serializers.Serializer):
    """Accept invitation and set password."""
    token = serializers.CharField()
    password = serializers.CharField(min_length=6, write_only=True)

    def validate_token(self, value):
        try:
            user = User.objects.get(invite_token=value, invite_accepted=False)
        except User.DoesNotExist:
            raise serializers.ValidationError('Invalid or expired invite token.')
        self.context['invited_user'] = user
        return value


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
        for entry in value:
            if not all(k in entry for k in ('user_id', 'page_id', 'level')):
                raise serializers.ValidationError(
                    'Each entry must have user_id, page_id, and level.'
                )
            if entry['level'] not in dict(PagePermission.Level.choices):
                raise serializers.ValidationError(
                    f"Invalid level: {entry['level']}"
                )
        return value
