"""
NICARA Projects — Models

Project, rooms, estimate items with specs, furniture layouts,
mood boards, and payment schedules.
"""
from django.db import models
from django.conf import settings


class Project(models.Model):
    """A client interior design project."""

    class Status(models.TextChoices):
        CLIENT_REQ = 'Client Requirements', 'Client Requirements'
        FURNITURE = 'Furniture Layout', 'Furniture Layout'
        MOOD_BOARD = 'Mood Board', 'Mood Board'
        INITIAL_EST = 'Initial Estimate', 'Initial Estimate'
        DESIGN = 'Design', 'Design'
        FINAL_EST = 'Final Estimate', 'Final Estimate'
        EXECUTION = 'Execution', 'Execution'
        HANDOVER = 'Handover', 'Handover'

    class PropertyType(models.TextChoices):
        BHK1 = '1BHK', '1 BHK'
        BHK2 = '2BHK', '2 BHK'
        BHK3 = '3BHK', '3 BHK'
        BHK4 = '4BHK', '4 BHK'
        VILLA = 'Villa', 'Villa'
        PENTHOUSE = 'Penthouse', 'Penthouse'
        COMMERCIAL = 'Commercial', 'Commercial'
        OTHER = 'Other', 'Other'

    # Client info
    client_name = models.CharField(max_length=200)
    client_email = models.EmailField(blank=True, default='')
    client_phone = models.CharField(max_length=20, blank=True, default='')

    # Project info
    name = models.CharField(max_length=200, help_text='Display name, e.g. Sharma Residence')
    developer = models.CharField(max_length=200, blank=True, default='')
    project_name = models.CharField(max_length=200, blank=True, default='',
                                     help_text='Society/building name, e.g. ABC Homes')
    unit_no = models.CharField(max_length=50, blank=True, default='')
    city = models.CharField(max_length=100, default='Mumbai')
    location = models.CharField(max_length=200, blank=True, default='',
                                 help_text='Area/locality, e.g. Bandra')

    # Property details
    super_built_up_area = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    carpet_area = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    property_type = models.CharField(max_length=20, choices=PropertyType.choices, default=PropertyType.BHK3)
    budget = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)

    # Usage
    purpose = models.CharField(max_length=50, default='Primary Home')
    use = models.CharField(max_length=50, default='Self Use')
    interior_style = models.CharField(max_length=100, blank=True, default='Contemporary')

    # Progress
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.INITIAL_EST)
    progress = models.IntegerField(default=0, help_text='0-100 percentage')
    handover_date = models.DateField(null=True, blank=True)

    # Tracking
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
        return f"{self.name} ({self.status})"


class ProjectRoom(models.Model):
    """Rooms selected for the project."""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='rooms')
    name = models.CharField(max_length=100)
    selected = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f"{self.project.name} — {self.name}"


class EstimateItem(models.Model):
    """
    Line item in the estimate — matches the Estimate sheet columns.
    SI No | Area | Item | Width | Height | Depth | Amount
    """
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='estimate_items')
    si_no = models.IntegerField()
    area = models.CharField(max_length=100, help_text='Kitchen, Living, Suite 1, etc.')
    category = models.CharField(max_length=100, blank=True, default='',
                                 help_text='Furniture, Electrical, etc.')
    sub_category = models.CharField(max_length=100, blank=True, default='')
    item = models.CharField(max_length=200, help_text='Wardrobe, TV Console, etc.')
    finish = models.CharField(max_length=200, blank=True, default='')

    # Dimensions in feet + inches
    width_ft = models.IntegerField(default=0)
    width_in = models.IntegerField(default=0)
    height_ft = models.IntegerField(default=0)
    height_in = models.IntegerField(default=0)
    depth_ft = models.IntegerField(default=0)
    depth_in = models.IntegerField(default=0)

    # Costing
    vendor_type = models.CharField(max_length=50, blank=True, default='',
                                    help_text='Service Vendor / Product Vendor')
    fac_or_site = models.CharField(max_length=20, blank=True, default='Factory',
                                    choices=[('Factory', 'Factory'), ('Site', 'Site')])
    qty = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit = models.CharField(max_length=20, blank=True, default='Sft')
    budget_per_unit = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['si_no']
        unique_together = ('project', 'si_no')

    def __str__(self):
        return f"#{self.si_no} {self.area} — {self.item}"


class EstimateItemSpec(models.Model):
    """
    Material specifications for each estimate item.
    Matches the Sample Detail sheet columns.
    """

    class SpecType(models.TextChoices):
        PROCUREMENT = 'Procurement', 'Procurement'
        SERVICE = 'Service', 'Service'
        SPEC_PURPOSE = 'Spec Purpose', 'Spec Purpose'
        PROC_SERVICE = 'Procurement cum Service', 'Procurement cum Service'

    estimate_item = models.ForeignKey(EstimateItem, on_delete=models.CASCADE, related_name='specs')

    # Type & Category (from library)
    type = models.CharField(max_length=30, choices=SpecType.choices, default=SpecType.PROCUREMENT)
    category = models.CharField(max_length=100, help_text='e.g. Core Material(16mm BWP Ply)')
    brand = models.CharField(max_length=100, blank=True, default='')
    model_name = models.CharField(max_length=200, blank=True, default='')
    notes = models.CharField(max_length=300, blank=True, default='')
    specification = models.CharField(max_length=500, help_text='Full display text')

    # Costing
    qty = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit = models.CharField(max_length=20, blank=True, default='')
    rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    cost = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                help_text='qty × rate')
    margin_pct = models.DecimalField(max_digits=5, decimal_places=2, default=35)
    margin_amt = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gst_pct = models.DecimalField(max_digits=5, decimal_places=2, default=18)
    gst_amt = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                 help_text='cost + margin + gst')
    service_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Reference to library item (optional)
    library_item = models.ForeignKey(
        'library.MaterialItem', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='used_in_specs'
    )

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.category}: {self.brand} {self.model_name}"


class FurnitureLayout(models.Model):
    """Furniture layout file uploads per project."""

    class LayoutStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SUBMITTED = 'submitted', 'Submitted'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='layouts')
    version = models.IntegerField(default=1)
    file = models.FileField(upload_to='layouts/%Y/%m/')
    status = models.CharField(max_length=20, choices=LayoutStatus.choices, default=LayoutStatus.DRAFT)
    notes = models.TextField(blank=True, default='')
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-version']

    def __str__(self):
        return f"{self.project.name} — Layout v{self.version}"


class MoodBoard(models.Model):
    """Mood board per area within a project."""

    class BoardStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='moodboards')
    area = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=BoardStatus.choices, default=BoardStatus.PENDING)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.project.name} — {self.area} Mood Board"


class MoodBoardImage(models.Model):
    """Images within a mood board."""
    mood_board = models.ForeignKey(MoodBoard, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='moodboards/%Y/%m/')
    caption = models.CharField(max_length=200, blank=True, default='')
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order']


class PaymentSchedule(models.Model):
    """Payment schedule entries for a project."""

    class Mode(models.TextChoices):
        BANK = 'Bank', 'Bank Transfer'
        CASH = 'Cash', 'Cash'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='payments')
    stage = models.CharField(max_length=10, help_text='P1, P2, P3, etc.')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    mode = models.CharField(max_length=10, choices=Mode.choices, default=Mode.BANK)
    paid = models.BooleanField(default=False)
    paid_date = models.DateField(null=True, blank=True)
    notes = models.CharField(max_length=200, blank=True, default='')

    class Meta:
        ordering = ['stage']

    def __str__(self):
        return f"{self.project.name} — {self.stage}: ₹{self.amount}"


class ServiceVendor(models.Model):
    """Service vendor database."""
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100)
    contact_person = models.CharField(max_length=200, blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    projects_count = models.IntegerField(default=0)
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class ProductVendor(models.Model):
    """Product vendor database."""
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100)
    contact_person = models.CharField(max_length=200, blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    lead_time = models.CharField(max_length=50, blank=True, default='')
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Client(models.Model):
    """Client database (separate from User — for CRM tracking)."""
    name = models.CharField(max_length=200)
    email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    project = models.CharField(max_length=200, blank=True, default='')
    status = models.CharField(max_length=50, default='Active')
    budget = models.CharField(max_length=50, blank=True, default='')
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
