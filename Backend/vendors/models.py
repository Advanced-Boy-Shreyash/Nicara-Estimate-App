"""
NICARA Vendors — Material Suppliers & Contractors

One `Vendor` table with a `vendor_type` discriminator, because the two share
almost everything that matters commercially (GST, PAN, bank details, payment
terms, ratings). The handful of fields that differ are grouped into clearly
labelled "supplier only" / "contractor only" blocks.

    Vendor ──< VendorContact      (multiple people at the same firm)
           ──< VendorDocument     (GST certificate, PAN, cancelled cheque, …)
"""
from django.conf import settings
from django.db import models
from django.utils.text import slugify


class VendorQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)

    def suppliers(self):
        return self.filter(vendor_type=Vendor.VendorType.MATERIAL_SUPPLIER)

    def contractors(self):
        return self.filter(vendor_type=Vendor.VendorType.CONTRACTOR)


class Vendor(models.Model):
    """A material supplier or a contractor."""

    class VendorType(models.TextChoices):
        MATERIAL_SUPPLIER = 'material_supplier', 'Material Supplier'
        CONTRACTOR = 'contractor', 'Contractor'

    class Trade(models.TextChoices):
        """Contractor speciality."""
        CARPENTRY = 'carpentry', 'Carpentry'
        FALSE_CEILING = 'false_ceiling', 'False Ceiling'
        ELECTRICAL = 'electrical', 'Electrical'
        PLUMBING = 'plumbing', 'Plumbing'
        PAINTING = 'painting', 'Painting'
        FLOORING = 'flooring', 'Flooring & Tiling'
        GLASS = 'glass', 'Glass & Mirror'
        CIVIL = 'civil', 'Civil & Masonry'
        FABRICATION = 'fabrication', 'Metal Fabrication'
        HVAC = 'hvac', 'HVAC'
        UPHOLSTERY = 'upholstery', 'Upholstery'
        CLEANING = 'cleaning', 'Cleaning & Housekeeping'
        OTHER = 'other', 'Other'

    class PaymentTerms(models.TextChoices):
        ADVANCE = 'advance', '100% Advance'
        PART_ADVANCE = 'part_advance', 'Part Advance'
        ON_DELIVERY = 'on_delivery', 'On Delivery'
        NET_15 = 'net_15', 'Net 15 Days'
        NET_30 = 'net_30', 'Net 30 Days'
        NET_45 = 'net_45', 'Net 45 Days'
        MILESTONE = 'milestone', 'Milestone Based'

    # ── Identity ─────────────────────────────────────────────
    code = models.CharField(
        max_length=20, unique=True, blank=True,
        help_text='Auto-generated short code, e.g. SUP-RAJTIM or CON-SHREEF'
    )
    name = models.CharField(max_length=200)
    vendor_type = models.CharField(max_length=20, choices=VendorType.choices, db_index=True)
    legal_name = models.CharField(max_length=250, blank=True, default='',
                                  help_text='Registered business name, if different')

    # ── Primary contact ──────────────────────────────────────
    contact_person = models.CharField(max_length=200, blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    alt_phone = models.CharField(max_length=20, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    website = models.URLField(blank=True, default='')

    # ── Address ──────────────────────────────────────────────
    address = models.TextField(blank=True, default='')
    city = models.CharField(max_length=100, blank=True, default='')
    state = models.CharField(max_length=100, blank=True, default='')
    pincode = models.CharField(max_length=10, blank=True, default='')

    # ── Statutory & banking ──────────────────────────────────
    gst_number = models.CharField(max_length=15, blank=True, default='', help_text='15-character GSTIN')
    pan_number = models.CharField(max_length=10, blank=True, default='')
    bank_name = models.CharField(max_length=150, blank=True, default='')
    bank_account_name = models.CharField(max_length=200, blank=True, default='')
    bank_account_number = models.CharField(max_length=30, blank=True, default='')
    bank_ifsc = models.CharField(max_length=15, blank=True, default='')
    upi_id = models.CharField(max_length=100, blank=True, default='')

    # ── Commercial terms ─────────────────────────────────────
    payment_terms = models.CharField(
        max_length=20, choices=PaymentTerms.choices, default=PaymentTerms.ON_DELIVERY
    )
    credit_days = models.IntegerField(default=0)
    advance_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0,
                                      help_text='Advance percentage typically demanded')

    # ── Supplier only ────────────────────────────────────────
    material_categories = models.ManyToManyField(
        'library.MaterialCategory', blank=True, related_name='suppliers',
        help_text='Which library categories this supplier stocks'
    )
    brands_supplied = models.CharField(
        max_length=500, blank=True, default='',
        help_text='Comma-separated brand names, e.g. Austin, Greenlam, Hettich'
    )
    lead_time_days = models.IntegerField(default=0, help_text='Typical delivery lead time in days')
    min_order_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    delivers_on_site = models.BooleanField(default=True)

    # ── Contractor only ──────────────────────────────────────
    trade = models.CharField(max_length=30, choices=Trade.choices, blank=True, default='')
    specialization = models.CharField(max_length=300, blank=True, default='')
    team_size = models.IntegerField(default=0)
    labour_rate_per_day = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # ── Relationship health ──────────────────────────────────
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0, help_text='0.0 – 5.0')
    is_preferred = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default='')

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_vendors'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = VendorQuerySet.as_manager()

    class Meta:
        ordering = ['name']
        indexes = [models.Index(fields=['vendor_type', 'is_active'])]

    def __str__(self):
        return f"{self.name} ({self.get_vendor_type_display()})"

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = self._generate_code()
        super().save(*args, **kwargs)

    def _generate_code(self):
        prefix = 'SUP' if self.vendor_type == self.VendorType.MATERIAL_SUPPLIER else 'CON'
        stem = slugify(self.name).replace('-', '').upper()[:6] or 'VENDOR'
        base = f'{prefix}-{stem}'
        code, n = base, 1
        while Vendor.objects.filter(code=code).exclude(pk=self.pk).exists():
            n += 1
            code = f'{base}{n}'
        return code

    @property
    def is_supplier(self):
        return self.vendor_type == self.VendorType.MATERIAL_SUPPLIER

    @property
    def brand_list(self):
        return [b.strip() for b in self.brands_supplied.split(',') if b.strip()]


class VendorContact(models.Model):
    """Additional people at a vendor firm (owner, accounts, site coordinator…)."""

    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, related_name='contacts')
    name = models.CharField(max_length=200)
    designation = models.CharField(max_length=100, blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    is_primary = models.BooleanField(default=False)
    notes = models.CharField(max_length=300, blank=True, default='')

    class Meta:
        ordering = ['-is_primary', 'name']

    def __str__(self):
        return f"{self.name} — {self.vendor.name}"


class VendorDocument(models.Model):
    """Compliance paperwork held on file for a vendor."""

    class DocType(models.TextChoices):
        GST_CERTIFICATE = 'gst', 'GST Certificate'
        PAN_CARD = 'pan', 'PAN Card'
        CANCELLED_CHEQUE = 'cheque', 'Cancelled Cheque'
        AGREEMENT = 'agreement', 'Agreement / MoU'
        RATE_CARD = 'rate_card', 'Rate Card'
        CATALOGUE = 'catalogue', 'Catalogue'
        OTHER = 'other', 'Other'

    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, related_name='documents')
    doc_type = models.CharField(max_length=20, choices=DocType.choices, default=DocType.OTHER)
    title = models.CharField(max_length=200, blank=True, default='')
    file = models.FileField(upload_to='vendors/documents/%Y/%m/')
    valid_till = models.DateField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.vendor.name} — {self.get_doc_type_display()}"
