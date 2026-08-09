"""
NICARA CRM — Leads and Clients.

    Lead    an enquiry moving through the pre-sales pipeline
    Client  a person/company you have actually done business with
    Note    timestamped activity log against either

A Lead that is won converts into a Client plus a Project, and keeps a link to
both so the pipeline history survives the conversion.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


class Client(models.Model):
    """A customer record. Projects point back here once a lead is won."""

    class ClientType(models.TextChoices):
        INDIVIDUAL = 'individual', 'Individual'
        COMPANY = 'company', 'Company'

    code = models.CharField(max_length=20, unique=True, blank=True)
    name = models.CharField(max_length=200)
    client_type = models.CharField(
        max_length=20, choices=ClientType.choices, default=ClientType.INDIVIDUAL
    )
    company_name = models.CharField(max_length=200, blank=True, default='')

    email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    alt_phone = models.CharField(max_length=20, blank=True, default='')

    address = models.TextField(blank=True, default='')
    city = models.CharField(max_length=100, blank=True, default='')
    state = models.CharField(max_length=100, blank=True, default='')
    pincode = models.CharField(max_length=10, blank=True, default='')

    gst_number = models.CharField(max_length=15, blank=True, default='')
    pan_number = models.CharField(max_length=10, blank=True, default='')

    notes = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_clients'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = self._generate_code()
        super().save(*args, **kwargs)

    def _generate_code(self):
        stem = slugify(self.name).replace('-', '').upper()[:6] or 'CLIENT'
        base = f'CL-{stem}'
        code, n = base, 1
        while Client.objects.filter(code=code).exclude(pk=self.pk).exists():
            n += 1
            code = f'{base}{n}'
        return code


class Lead(models.Model):
    """
    A sales enquiry. Stages mirror the pre-sales flow in the layout sheet:
    Furniture Layout → Mood Board → Initial Estimate → Decision → Booking.
    """

    class Stage(models.TextChoices):
        NEW = 'new', 'New Enquiry'
        CONTACTED = 'contacted', 'Contacted'
        FURNITURE_LAYOUT = 'furniture_layout', 'Furniture Layout'
        MOOD_BOARD = 'mood_board', 'Mood Board'
        INITIAL_ESTIMATE = 'initial_estimate', 'Initial Estimate'
        DECISION = 'decision', 'Lead Decision'
        REVISION = 'revision', 'Revision'
        BOOKING = 'booking', 'Booking Form & Advance'
        WON = 'won', 'Won — Converted'
        LOST = 'lost', 'Closed Lost'

    class Source(models.TextChoices):
        REFERRAL = 'referral', 'Referral'
        WEBSITE = 'website', 'Website'
        WALK_IN = 'walk_in', 'Walk-in'
        SOCIAL = 'social', 'Social Media'
        BUILDER = 'builder', 'Builder / Developer'
        EXHIBITION = 'exhibition', 'Exhibition'
        OTHER = 'other', 'Other'

    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'

    code = models.CharField(max_length=20, unique=True, blank=True)

    # Enquiry details
    name = models.CharField(max_length=200, help_text='Contact person')
    email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')

    # What they want
    project_name = models.CharField(max_length=200, blank=True, default='')
    developer = models.CharField(max_length=200, blank=True, default='')
    unit_no = models.CharField(max_length=50, blank=True, default='')
    city = models.CharField(max_length=100, blank=True, default='')
    state = models.CharField(max_length=100, blank=True, default='')
    property_type = models.CharField(max_length=40, blank=True, default='')
    area = models.CharField(max_length=50, blank=True, default='')
    requirement = models.TextField(blank=True, default='')
    estimated_budget = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)

    # Pipeline
    stage = models.CharField(max_length=30, choices=Stage.choices, default=Stage.NEW, db_index=True)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.OTHER)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='owned_leads', help_text='Designer handling this lead'
    )
    next_follow_up = models.DateField(null=True, blank=True)
    lost_reason = models.CharField(max_length=300, blank=True, default='')

    # Set when the lead is won
    converted_client = models.ForeignKey(
        Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='source_leads'
    )
    converted_project = models.ForeignKey(
        'projects.Project', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='source_leads'
    )
    converted_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_leads'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['stage', 'created_at'])]

    def __str__(self):
        return f'{self.code or "LEAD"} — {self.name}'

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = self._generate_code()
        super().save(*args, **kwargs)

    def _generate_code(self):
        year = timezone.now().year
        seq = Lead.objects.filter(code__startswith=f'LD-{year}-').count() + 1
        code = f'LD-{year}-{seq:04d}'
        while Lead.objects.filter(code=code).exists():
            seq += 1
            code = f'LD-{year}-{seq:04d}'
        return code

    @property
    def is_open(self):
        return self.stage not in (self.Stage.WON, self.Stage.LOST)


class CrmNote(models.Model):
    """Activity log entry against a lead or a client."""

    class Kind(models.TextChoices):
        NOTE = 'note', 'Note'
        CALL = 'call', 'Call'
        MEETING = 'meeting', 'Meeting'
        EMAIL = 'email', 'Email'
        SITE_VISIT = 'site_visit', 'Site Visit'
        STAGE_CHANGE = 'stage_change', 'Stage Change'

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, null=True, blank=True, related_name='notes')
    client = models.ForeignKey(Client, on_delete=models.CASCADE, null=True, blank=True, related_name='crm_notes')

    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.NOTE)
    body = models.TextField()
    follow_up_on = models.DateField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='crm_notes'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        target = self.lead or self.client
        return f'{self.get_kind_display()} on {target}'
