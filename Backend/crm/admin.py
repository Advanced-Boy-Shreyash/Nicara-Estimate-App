from django.contrib import admin

from .models import Client, CrmNote, Lead


class CrmNoteInline(admin.TabularInline):
    model = CrmNote
    fk_name = 'lead'
    extra = 0
    readonly_fields = ['created_by', 'created_at']


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'project_name', 'city', 'stage', 'priority',
                    'owner', 'estimated_budget', 'created_at']
    list_filter = ['stage', 'source', 'priority', 'city']
    search_fields = ['code', 'name', 'email', 'phone', 'project_name']
    readonly_fields = ['code', 'converted_client', 'converted_project', 'converted_at',
                       'created_by', 'created_at', 'updated_at']
    inlines = [CrmNoteInline]


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'client_type', 'phone', 'email', 'city', 'is_active']
    list_filter = ['client_type', 'is_active', 'city']
    search_fields = ['code', 'name', 'company_name', 'email', 'phone', 'gst_number']
    readonly_fields = ['code', 'created_by', 'created_at', 'updated_at']


@admin.register(CrmNote)
class CrmNoteAdmin(admin.ModelAdmin):
    list_display = ['kind', 'lead', 'client', 'follow_up_on', 'created_by', 'created_at']
    list_filter = ['kind']
    search_fields = ['body', 'lead__name', 'client__name']
