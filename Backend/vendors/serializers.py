"""NICARA Vendors — Serializers"""
from rest_framework import serializers

from .models import Vendor, VendorContact, VendorDocument


class VendorContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = VendorContact
        fields = ['id', 'vendor', 'name', 'designation', 'phone', 'email', 'is_primary', 'notes']
        read_only_fields = ['vendor']


class VendorDocumentSerializer(serializers.ModelSerializer):
    doc_type_display = serializers.CharField(source='get_doc_type_display', read_only=True)

    class Meta:
        model = VendorDocument
        fields = ['id', 'vendor', 'doc_type', 'doc_type_display', 'title', 'file',
                  'valid_till', 'uploaded_at']
        read_only_fields = ['vendor', 'uploaded_at']


class VendorListSerializer(serializers.ModelSerializer):
    """Lightweight row for the Material Suppliers / Contractors tables."""
    type_display = serializers.CharField(source='get_vendor_type_display', read_only=True)
    trade_display = serializers.CharField(source='get_trade_display', read_only=True)
    payment_terms_display = serializers.CharField(source='get_payment_terms_display', read_only=True)

    class Meta:
        model = Vendor
        fields = [
            'id', 'code', 'name', 'vendor_type', 'type_display',
            'contact_person', 'phone', 'email', 'city', 'state',
            'gst_number', 'payment_terms', 'payment_terms_display', 'credit_days',
            'brands_supplied', 'lead_time_days', 'min_order_value',
            'trade', 'trade_display', 'team_size', 'labour_rate_per_day',
            'rating', 'is_preferred', 'is_active',
        ]


class VendorSerializer(serializers.ModelSerializer):
    """Full vendor record."""
    type_display = serializers.CharField(source='get_vendor_type_display', read_only=True)
    trade_display = serializers.CharField(source='get_trade_display', read_only=True)
    payment_terms_display = serializers.CharField(source='get_payment_terms_display', read_only=True)
    brand_list = serializers.ListField(child=serializers.CharField(), read_only=True)
    contacts = VendorContactSerializer(many=True, read_only=True)
    documents = VendorDocumentSerializer(many=True, read_only=True)
    material_category_names = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = '__all__'
        read_only_fields = ['code', 'created_by', 'created_at', 'updated_at']

    def get_material_category_names(self, obj):
        return [c.name for c in obj.material_categories.all()]

    def validate_gst_number(self, value):
        value = (value or '').strip().upper()
        if value and len(value) != 15:
            raise serializers.ValidationError('GSTIN must be exactly 15 characters.')
        return value

    def validate_pan_number(self, value):
        value = (value or '').strip().upper()
        if value and len(value) != 10:
            raise serializers.ValidationError('PAN must be exactly 10 characters.')
        return value

    def validate_rating(self, value):
        if value is not None and not (0 <= value <= 5):
            raise serializers.ValidationError('Rating must be between 0 and 5.')
        return value

    def validate(self, data):
        """Keep type-specific fields consistent with vendor_type."""
        vendor_type = data.get('vendor_type') or getattr(self.instance, 'vendor_type', None)
        if vendor_type == Vendor.VendorType.CONTRACTOR and data.get('trade') == '':
            raise serializers.ValidationError({'trade': 'A contractor needs a trade.'})
        return data
