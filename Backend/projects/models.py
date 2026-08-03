"""
NICARA Projects — Models

Full project lifecycle: Lead → Design → Execution → Handover
Includes design requirements, versioned deliverables, measurements,
material selections, execution tracking, payments, and quality checks.
"""
from decimal import Decimal, ROUND_HALF_UP

from django.db import models
from django.conf import settings
from django.utils import timezone

MONEY = Decimal('0.01')


def money(value):
    """Round a computed amount to paise so it fits a decimal_places=2 column."""
    return Decimal(value or 0).quantize(MONEY, rounding=ROUND_HALF_UP)


# ════════════════════════════════════════════════════════════════
# PROJECT
# ════════════════════════════════════════════════════════════════

class Project(models.Model):
    """A client interior design project."""

    class Stage(models.TextChoices):
        LEAD = 'lead', 'Lead'
        DESIGN = 'design', 'Design'
        EXECUTION = 'execution', 'Execution'
        COMPLETED = 'completed', 'Completed'

    class PropertyType(models.TextChoices):
        BHK1 = '1BHK', '1 BHK'
        BHK2 = '2BHK', '2 BHK'
        BHK3 = '3BHK', '3 BHK'
        BHK4 = '4BHK', '4 BHK'
        VILLA = 'Villa', 'Villa'
        PENTHOUSE = 'Penthouse', 'Penthouse'
        COMMERCIAL = 'Commercial', 'Commercial'
        OTHER = 'Other', 'Other'

    class ProjectType(models.TextChoices):
        RESIDENTIAL = 'Residential', 'Residential'
        COMMERCIAL = 'Commercial', 'Commercial'

    class Purpose(models.TextChoices):
        SELF = 'Self', 'Self'
        RENTAL = 'Rental', 'Rental'

    # Client info
    client_name = models.CharField(max_length=200)
    client_email = models.EmailField(blank=True, default='')
    client_phone = models.CharField(max_length=20, blank=True, default='')
    client_address = models.TextField(blank=True, default='')

    # Project info
    name = models.CharField(max_length=200, help_text='Display name, e.g. Sharma Residence')
    developer = models.CharField(max_length=200, blank=True, default='',
                                  help_text='Developer - Project, e.g. Prestige Lakeside')
    unit_no = models.CharField(max_length=50, blank=True, default='')
    city = models.CharField(max_length=100, default='Mumbai')
    state = models.CharField(max_length=100, blank=True, default='')
    pincode = models.CharField(max_length=10, blank=True, default='')

    # Property details
    area = models.CharField(max_length=50, blank=True, default='', help_text='e.g. 1,850 sqft')
    property_type = models.CharField(max_length=20, choices=PropertyType.choices, default=PropertyType.BHK3)
    project_type = models.CharField(max_length=20, choices=ProjectType.choices, default=ProjectType.RESIDENTIAL)
    purpose = models.CharField(max_length=20, choices=Purpose.choices, default=Purpose.SELF)
    interior_style = models.CharField(max_length=100, blank=True, default='Contemporary')
    budget = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)

    # Stage & progress
    stage = models.CharField(max_length=20, choices=Stage.choices, default=Stage.LEAD)
    progress = models.IntegerField(default=0, help_text='0-100 percentage')
    start_date = models.DateField(null=True, blank=True)
    target_date = models.DateField(null=True, blank=True)

    # Team
    design_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='design_projects'
    )
    site_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='managed_projects'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name='created_projects'
    )
    team_members = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name='assigned_projects'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.get_stage_display()})"


# ════════════════════════════════════════════════════════════════
# DESIGN REQUIREMENTS
# ════════════════════════════════════════════════════════════════

class DesignRequirement(models.Model):
    """Room/unit design requirements — generated from room selection."""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='design_requirements')
    room = models.CharField(max_length=100, help_text='Master Bedroom, Kitchen, etc.')
    unit = models.CharField(max_length=100, help_text='Wardrobe, TV Unit, etc.')
    length = models.CharField(max_length=20, blank=True, default='')
    breadth = models.CharField(max_length=20, blank=True, default='')
    height = models.CharField(max_length=20, blank=True, default='')
    finishing = models.CharField(max_length=100, blank=True, default='')
    remarks = models.TextField(blank=True, default='')
    design_required = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'room', 'unit']

    def __str__(self):
        return f"{self.project.name} — {self.room}: {self.unit}"


# ════════════════════════════════════════════════════════════════
# VERSIONED DELIVERABLES (FL, MB, 3D, Renders, Working Drawings)
# ════════════════════════════════════════════════════════════════

class ProjectDeliverable(models.Model):
    """Versioned file deliverable — covers FL, MB, 3D, Renders, WD, etc."""

    class DeliverableType(models.TextChoices):
        FURNITURE_LAYOUT = 'furniture_layout', 'Furniture Layout'
        MOOD_BOARD = 'mood_board', 'Mood Board'
        MODEL_3D = 'model_3d', '3D Model'
        RENDER = 'render', 'Render'
        FINAL_RENDER = 'final_render', 'Final Render'
        WORKING_DRAWING = 'working_drawing', 'Working Drawing'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REVISION = 'revision', 'Revision Required'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='deliverables')
    type = models.CharField(max_length=30, choices=DeliverableType.choices)
    version = models.CharField(max_length=20, help_text='Ver 1, Ver 2, etc.')
    file = models.FileField(upload_to='deliverables/%Y/%m/', blank=True)
    file_name = models.CharField(max_length=200, blank=True, default='')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    remarks = models.TextField(blank=True, default='')
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    date = models.DateField(default=timezone.localdate)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['type', '-date']

    def __str__(self):
        return f"{self.project.name} — {self.get_type_display()} {self.version}"


# ════════════════════════════════════════════════════════════════
# ESTIMATES (Initial, Intermediate, Final)
# ════════════════════════════════════════════════════════════════

class Estimate(models.Model):
    """An estimate version — a project can have multiple (initial, intermediate, final)."""

    class EstimateType(models.TextChoices):
        INITIAL = 'initial', 'Initial Estimate'
        INTERMEDIATE = 'intermediate', 'Intermediate Estimate'
        FINAL = 'final', 'Final Estimate'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SENT = 'sent', 'Sent for Approval'
        APPROVED = 'approved', 'Approved'
        REVISION = 'revision', 'Revision Required'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='estimates')
    type = models.CharField(max_length=20, choices=EstimateType.choices)
    version = models.IntegerField(default=1)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    title = models.CharField(max_length=200, blank=True, default='')
    notes = models.TextField(blank=True, default='')

    # Commercials. Detailed quote maths lands here later; for now a flat
    # discount on the subtotal is enough to drive the totals.
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    valid_until = models.DateField(null=True, blank=True)

    # Approval trail
    sent_at = models.DateTimeField(null=True, blank=True)
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='sent_estimates'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approved_estimates'
    )
    client_remarks = models.TextField(blank=True, default='')

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_estimates'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['type', '-version']
        unique_together = ('project', 'type', 'version')

    def __str__(self):
        return f"{self.project.name} — {self.get_type_display()} v{self.version}"

    # ── Totals ───────────────────────────────────────────────
    # Computed from line items so a stale stored total can never be served.
    @property
    def subtotal(self):
        return money(sum((i.amount for i in self.items.all()), Decimal('0')))

    @property
    def total_discount(self):
        pct = self.discount_pct or Decimal('0')
        flat = self.discount_amount or Decimal('0')
        return money(self.subtotal * pct / Decimal('100') + flat)

    @property
    def taxable_amount(self):
        return money(self.subtotal - self.total_discount)

    @property
    def gst_total(self):
        """GST per line, proportionally reduced by any header discount."""
        subtotal = self.subtotal
        if not subtotal:
            return Decimal('0.00')
        ratio = self.taxable_amount / subtotal
        return money(sum(
            (i.amount * ratio * i.gst_pct / Decimal('100') for i in self.items.all()),
            Decimal('0'),
        ))

    @property
    def grand_total(self):
        return money(self.taxable_amount + self.gst_total)

    @property
    def item_count(self):
        return self.items.count()

    def next_version(self):
        """Version number for the next revision of this estimate type."""
        latest = (Estimate.objects
                  .filter(project=self.project, type=self.type)
                  .order_by('-version')
                  .first())
        return (latest.version if latest else 0) + 1


class EstimateItem(models.Model):
    """
    Line item within an estimate.

    `catalog_item` points at the Items module master record when the line was
    picked from the catalogue; free-text lines simply leave it null.
    """
    estimate = models.ForeignKey(Estimate, on_delete=models.CASCADE, related_name='items')
    catalog_item = models.ForeignKey(
        'items.Item', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='estimate_lines',
        help_text='Master item this line was created from, if any'
    )
    sno = models.IntegerField(default=0)
    area = models.CharField(max_length=100, help_text='Room/area name')
    item = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    length = models.CharField(max_length=20, blank=True, default='')
    breadth = models.CharField(max_length=20, blank=True, default='')
    height = models.CharField(max_length=20, blank=True, default='')
    qty = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit = models.CharField(max_length=20, default='unit')
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                 help_text='Auto-computed as qty × rate')
    gst_pct = models.DecimalField(max_digits=5, decimal_places=2, default=18)
    remarks = models.CharField(max_length=300, blank=True, default='')

    class Meta:
        ordering = ['sno', 'id']

    def __str__(self):
        return f"#{self.sno} {self.area} — {self.item}"

    def save(self, *args, **kwargs):
        # qty × rate is the single source of truth for a line total.
        self.amount = money((self.qty or Decimal('0')) * (self.rate or Decimal('0')))
        if not self.sno:
            last = EstimateItem.objects.filter(estimate=self.estimate).order_by('-sno').first()
            self.sno = (last.sno if last else 0) + 1
        super().save(*args, **kwargs)

    @property
    def gst_amount(self):
        return money(self.amount * self.gst_pct / Decimal('100'))

    @property
    def total_with_gst(self):
        return money(self.amount + self.gst_amount)


# ════════════════════════════════════════════════════════════════
# MEASUREMENTS
# ════════════════════════════════════════════════════════════════

class Measurement(models.Model):
    """Room measurement data — walls and proof check."""

    class Status(models.TextChoices):
        COMPLETE = 'complete', 'Complete'
        PENDING = 'pending', 'Pending'
        ISSUE = 'issue', 'Issue'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='measurements')
    room = models.CharField(max_length=100)
    plan_verified = models.BooleanField(default=False)
    east = models.CharField(max_length=20, blank=True, default='')
    west = models.CharField(max_length=20, blank=True, default='')
    north = models.CharField(max_length=20, blank=True, default='')
    south = models.CharField(max_length=20, blank=True, default='')
    other_details = models.TextField(blank=True, default='')
    measurement_file = models.FileField(upload_to='measurements/%Y/%m/', blank=True)
    proof_checked_by = models.CharField(max_length=100, blank=True, default='')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    class Meta:
        ordering = ['room']

    def __str__(self):
        return f"{self.project.name} — {self.room} measurements"


# ════════════════════════════════════════════════════════════════
# MATERIAL SELECTIONS
# ════════════════════════════════════════════════════════════════

class MaterialSelection(models.Model):
    """Per-room, per-wall material selection with supplier details."""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='material_selections')
    category = models.CharField(max_length=100, help_text='Plywood, Laminates, Hardware, etc.')
    room = models.CharField(max_length=100)
    wall_area = models.CharField(max_length=100, help_text='Which wall or area')
    price_range = models.CharField(max_length=50, blank=True, default='')
    supplier_name = models.CharField(max_length=200, blank=True, default='')
    brand_name = models.CharField(max_length=200, blank=True, default='')
    catalog = models.CharField(max_length=200, blank=True, default='')
    item_code = models.CharField(max_length=100, blank=True, default='')
    supplier_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    availability = models.CharField(max_length=50, default='In Stock')
    # Optional reference to library item
    library_item = models.ForeignKey(
        'library.MaterialItem', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='selections'
    )

    class Meta:
        ordering = ['category', 'room']

    def __str__(self):
        return f"{self.project.name} — {self.category}: {self.brand_name} ({self.room})"


# ════════════════════════════════════════════════════════════════
# EXECUTION STAGES
# ════════════════════════════════════════════════════════════════

class ExecutionStage(models.Model):
    """Execution phase stage tracking."""

    class Status(models.TextChoices):
        UPCOMING = 'upcoming', 'Upcoming'
        IN_PROGRESS = 'in-progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        DELAYED = 'delayed', 'Delayed'

    class PaymentStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PARTIAL = 'partial', 'Partial'
        PAID = 'paid', 'Paid'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='execution_stages')
    name = models.CharField(max_length=200, help_text='Floor Protection, False Ceiling, etc.')
    vendor = models.CharField(max_length=200, blank=True, default='')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UPCOMING)
    progress = models.IntegerField(default=0, help_text='0-100')
    payment = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order']

    def __str__(self):
        return f"{self.project.name} — {self.name}"


# ════════════════════════════════════════════════════════════════
# PAYMENT SCHEDULE
# ════════════════════════════════════════════════════════════════

class PaymentMilestone(models.Model):
    """Payment milestone for a project."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PARTIAL = 'partial', 'Partial'
        PAID = 'paid', 'Paid'
        OVERDUE = 'overdue', 'Overdue'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='payment_milestones')
    milestone = models.CharField(max_length=200, help_text='Booking Advance, Design Phase P1, etc.')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    due_date = models.DateField()
    paid_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    mode = models.CharField(max_length=50, blank=True, default='', help_text='NEFT, UPI, RTGS, etc.')
    reference = models.CharField(max_length=200, blank=True, default='')

    class Meta:
        ordering = ['due_date']

    def __str__(self):
        return f"{self.project.name} — {self.milestone}: ₹{self.amount}"


# ════════════════════════════════════════════════════════════════
# QUALITY CHECKS
# ════════════════════════════════════════════════════════════════

class QualityCheck(models.Model):
    """Quality inspection record."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PASS = 'pass', 'Pass'
        FAIL = 'fail', 'Fail'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='quality_checks')
    area = models.CharField(max_length=100)
    check_type = models.CharField(max_length=200)
    date = models.DateField(default=timezone.localdate)
    inspector = models.CharField(max_length=100, blank=True, default='')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    remarks = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.project.name} — {self.check_type} ({self.get_status_display()})"


# ════════════════════════════════════════════════════════════════
# BOOKING FORM — final step of Initial Engagement
# ════════════════════════════════════════════════════════════════

class BookingForm(models.Model):
    """
    Signed commitment that closes the Initial Engagement phase.

    Generated once the client approves an initial estimate: it snapshots the
    agreed value, records the booking advance, and tracks the signature.
    """

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SENT = 'sent', 'Sent to Client'
        SIGNED = 'signed', 'Signed'
        CANCELLED = 'cancelled', 'Cancelled'

    class PaymentMode(models.TextChoices):
        NEFT = 'NEFT', 'NEFT'
        RTGS = 'RTGS', 'RTGS'
        IMPS = 'IMPS', 'IMPS'
        UPI = 'UPI', 'UPI'
        CHEQUE = 'Cheque', 'Cheque'
        CASH = 'Cash', 'Cash'
        CARD = 'Card', 'Card'

    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='booking_form')
    booking_number = models.CharField(max_length=30, unique=True, blank=True)
    # localdate, not now — `timezone.now` hands a datetime to a DateField.
    booking_date = models.DateField(default=timezone.localdate)

    # The estimate the client agreed to.
    estimate = models.ForeignKey(
        'Estimate', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='bookings'
    )
    total_value = models.DecimalField(max_digits=14, decimal_places=2, default=0,
                                      help_text='Agreed project value at booking time')

    # Booking advance
    advance_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    advance_received = models.BooleanField(default=False)
    advance_received_on = models.DateField(null=True, blank=True)
    payment_mode = models.CharField(max_length=20, choices=PaymentMode.choices, blank=True, default='')
    payment_reference = models.CharField(max_length=200, blank=True, default='')
    payment_link = models.URLField(blank=True, default='')

    # Sign-off
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    terms_accepted = models.BooleanField(default=False)
    signed_by_name = models.CharField(max_length=200, blank=True, default='')
    signed_at = models.DateTimeField(null=True, blank=True)
    signature_file = models.FileField(upload_to='bookings/signatures/%Y/%m/', blank=True)
    generated_pdf = models.FileField(upload_to='bookings/pdf/%Y/%m/', blank=True)

    scope_summary = models.TextField(blank=True, default='',
                                     help_text='Short description of what is being booked')
    terms = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_bookings'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-booking_date']

    def __str__(self):
        return f"{self.booking_number or 'BKG'} — {self.project.name}"

    def save(self, *args, **kwargs):
        if not self.booking_number:
            self.booking_number = self._generate_number()
        super().save(*args, **kwargs)

    def _generate_number(self):
        year = (self.booking_date or timezone.now().date()).year
        seq = BookingForm.objects.filter(booking_number__startswith=f'BKG-{year}-').count() + 1
        number = f'BKG-{year}-{seq:04d}'
        while BookingForm.objects.filter(booking_number=number).exists():
            seq += 1
            number = f'BKG-{year}-{seq:04d}'
        return number

    @property
    def balance_due(self):
        return self.total_value - (self.advance_amount if self.advance_received else 0)
