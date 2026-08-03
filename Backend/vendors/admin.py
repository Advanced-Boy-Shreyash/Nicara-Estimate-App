from django.contrib import admin

from .models import Vendor, VendorContact, VendorDocument


class VendorContactInline(admin.TabularInline):
    model = VendorContact
    extra = 0


class VendorDocumentInline(admin.TabularInline):
    model = VendorDocument
    extra = 0


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'vendor_type', 'trade', 'city', 'phone', 'rating', 'is_active']
    list_filter = ['vendor_type', 'trade', 'is_active', 'is_preferred', 'city', 'payment_terms']
    search_fields = ['name', 'code', 'contact_person', 'phone', 'email', 'gst_number']
    readonly_fields = ['code', 'created_at', 'updated_at']
    filter_horizontal = ['material_categories']
    inlines = [VendorContactInline, VendorDocumentInline]

    fieldsets = (
        ('Identity', {'fields': ('code', 'name', 'legal_name', 'vendor_type')}),
        ('Contact', {'fields': ('contact_person', 'phone', 'alt_phone', 'email', 'website')}),
        ('Address', {'fields': ('address', 'city', 'state', 'pincode')}),
        ('Statutory & Banking', {'fields': (
            'gst_number', 'pan_number', 'bank_name', 'bank_account_name',
            'bank_account_number', 'bank_ifsc', 'upi_id',
        )}),
        ('Commercial Terms', {'fields': ('payment_terms', 'credit_days', 'advance_pct')}),
        ('Supplier Details', {
            'classes': ('collapse',),
            'fields': ('material_categories', 'brands_supplied', 'lead_time_days',
                       'min_order_value', 'delivers_on_site'),
        }),
        ('Contractor Details', {
            'classes': ('collapse',),
            'fields': ('trade', 'specialization', 'team_size', 'labour_rate_per_day'),
        }),
        ('Status', {'fields': ('rating', 'is_preferred', 'is_active', 'notes',
                               'created_by', 'created_at', 'updated_at')}),
    )


@admin.register(VendorContact)
class VendorContactAdmin(admin.ModelAdmin):
    list_display = ['name', 'vendor', 'designation', 'phone', 'is_primary']
    list_filter = ['is_primary']
    search_fields = ['name', 'vendor__name', 'phone']


@admin.register(VendorDocument)
class VendorDocumentAdmin(admin.ModelAdmin):
    list_display = ['vendor', 'doc_type', 'title', 'valid_till', 'uploaded_at']
    list_filter = ['doc_type']
    search_fields = ['vendor__name', 'title']
