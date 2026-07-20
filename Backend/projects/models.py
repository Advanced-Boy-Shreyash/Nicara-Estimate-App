"""
NICARA Projects — Models

Full project lifecycle: Lead → Design → Execution → Handover
Includes design requirements, versioned deliverables, measurements,
material selections, execution tracking, payments, and quality checks.
"""
from django.db import models
from django.conf import settings
from django.utils import timezone


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
    date = models.DateField(default=timezone.now)
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
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['type', '-version']
        unique_together = ('project', 'type', 'version')

    def __str__(self):
        return f"{self.project.name} — {self.get_type_display()} v{self.version}"

    @property
    def subtotal(self):
        return sum(i.amount for i in self.items.all())

    @property
    def gst_total(self):
        return sum(i.amount * i.gst_pct / 100 for i in self.items.all())

    @property
    def grand_total(self):
        return self.subtotal + self.gst_total


class EstimateItem(models.Model):
    """Line item within an estimate."""
    estimate = models.ForeignKey(Estimate, on_delete=models.CASCADE, related_name='items')
    sno = models.IntegerField()
    area = models.CharField(max_length=100, help_text='Room/area name')
    item = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    length = models.CharField(max_length=20, blank=True, default='')
    breadth = models.CharField(max_length=20, blank=True, default='')
    height = models.CharField(max_length=20, blank=True, default='')
    qty = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit = models.CharField(max_length=20, default='unit')
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gst_pct = models.DecimalField(max_digits=5, decimal_places=2, default=18)

    class Meta:
        ordering = ['sno']

    def __str__(self):
        return f"#{self.sno} {self.area} — {self.item}"


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
    date = models.DateField(default=timezone.now)
    inspector = models.CharField(max_length=100, blank=True, default='')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    remarks = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.project.name} — {self.check_type} ({self.get_status_display()})"


# ════════════════════════════════════════════════════════════════
# VENDORS (kept from original)
# ════════════════════════════════════════════════════════════════

class Vendor(models.Model):
    """Unified vendor model — material suppliers and contractors."""

    class VendorType(models.TextChoices):
        MATERIAL_SUPPLIER = 'material_supplier', 'Material Supplier'
        CONTRACTOR = 'contractor', 'Contractor'

    name = models.CharField(max_length=200)
    vendor_type = models.CharField(max_length=20, choices=VendorType.choices)
    category = models.CharField(max_length=100, blank=True, default='')
    contact_person = models.CharField(max_length=200, blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    address = models.TextField(blank=True, default='')
    lead_time = models.CharField(max_length=50, blank=True, default='')
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_vendor_type_display()})"
