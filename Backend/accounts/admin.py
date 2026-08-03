from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import LoginAttempt, PagePermission, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin tuned for an email-as-username model."""

    ordering = ['-date_joined']
    list_display = ['email', 'first_name', 'last_name', 'role', 'is_active', 'date_joined']
    list_filter = ['role', 'is_active', 'is_staff', 'invite_accepted']
    search_fields = ['first_name', 'last_name', 'email']
    readonly_fields = ['date_joined', 'last_login', 'password_changed_at']

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Profile', {'fields': ('first_name', 'last_name', 'phone', 'avatar_url', 'role')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Invitation', {'fields': ('invited_by', 'invite_token', 'invite_accepted', 'invite_email_sent')}),
        ('Important dates', {'fields': ('last_login', 'date_joined', 'password_changed_at')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'role', 'password1', 'password2'),
        }),
    )


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    list_display = ['email', 'successful', 'ip_address', 'created_at']
    list_filter = ['successful', 'created_at']
    search_fields = ['email', 'ip_address']
    readonly_fields = ['email', 'user', 'successful', 'ip_address', 'user_agent', 'created_at']

    def has_add_permission(self, request):
        return False


@admin.register(PagePermission)
class PagePermissionAdmin(admin.ModelAdmin):
    list_display = ['user', 'page_id', 'level']
    list_filter = ['page_id', 'level']
    search_fields = ['user__email']
