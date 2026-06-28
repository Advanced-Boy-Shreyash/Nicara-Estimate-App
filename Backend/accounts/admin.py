from django.contrib import admin
from .models import User, PagePermission


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'first_name', 'last_name', 'role', 'is_active', 'date_joined']
    list_filter = ['role', 'is_active', 'invite_accepted']
    search_fields = ['first_name', 'last_name', 'email']
    readonly_fields = ['date_joined', 'last_login']


@admin.register(PagePermission)
class PagePermissionAdmin(admin.ModelAdmin):
    list_display = ['user', 'page_id', 'level']
    list_filter = ['page_id', 'level']
