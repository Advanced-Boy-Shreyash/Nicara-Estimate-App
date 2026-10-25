"""
NICARA Component Library — Models

Materials database that designers use to build estimates.
    MaterialCategory  what the material is   (Core Material(16mm BWP Ply), Box Hinges)
    MaterialBrand     who makes it — one master list (Austin, Hettich, Greenlam)
    MaterialItem      a priced model: category + brand + model + rate
Plus separate ServiceItem for labour/service-type entries.

Structure mirrors the "Sample Detail" sheet in sample template.xlsx.
"""
from django.db import models
from django.utils import timezone


class MaterialCategory(models.Model):
    """
    Top-level material categories.
    Examples: 'Core Material(16mm BWP Ply)', 'Box Hinges',
              'Finishing - Laminate', 'Adhesive(Bonding)',
              'Draw Channels', 'Lights', 'Other Decoratives'
    """

    class SpecType(models.TextChoices):
        PROCUREMENT = 'Procurement', 'Procurement'
        SERVICE = 'Service', 'Service'
        SPEC_PURPOSE = 'Spec Purpose', 'Spec Purpose'
        PROC_SERVICE = 'Procurement cum Service', 'Procurement cum Service'

    class ProductGroup(models.TextChoices):
        PLYWOOD = 'plywood', 'Plywood'
        HARDWARE = 'hardware', 'Hardware'
        KITCHEN_ACCESSORIES = 'kitchen_accessories', 'Kitchen Accessories'
        FINISHING = 'finishing', 'Finishing'
        OTHER = 'other', 'Other'

    name = models.CharField(max_length=150, unique=True)
    product_group = models.CharField(
        max_length=30, choices=ProductGroup.choices, default=ProductGroup.OTHER,
        db_index=True,
    )
    type = models.CharField(max_length=30, choices=SpecType.choices, default=SpecType.PROCUREMENT)
    icon = models.CharField(max_length=10, blank=True, default='📦')
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name_plural = 'Material Categories'

    def __str__(self):
        return self.name


class MaterialBrand(models.Model):
    """
    A brand — one master list shared by every category. A raw material links
    to one brand; the Smart Estimate Generator offers brands, then picks that
    brand's model in each row's category.
    Examples: Austin, Hettich, Greenlam, Fevicol
    """
    name = models.CharField(max_length=100, unique=True)
    website = models.URLField(blank=True, default='')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class MaterialItem(models.Model):
    """
    Specific material items/models within a brand.
    Examples: Brand='Hettich' → Model='Onsys - 0 Crank Soft Close'
              Brand='Austin' → Model='Lincoln BWP'
              Brand='Greenlam' → Model='Off white Colour'
    """
    category = models.ForeignKey(
        MaterialCategory, on_delete=models.PROTECT, related_name='materials',
    )
    brand = models.ForeignKey(
        MaterialBrand, on_delete=models.SET_NULL, related_name='items',
        null=True, blank=True,
    )
    model_name = models.CharField(max_length=200, help_text='Product model/variant name')
    description = models.TextField(blank=True, default='')
    # Physical dimensions / specs
    weight = models.CharField(max_length=50, blank=True, default='',
                              help_text='e.g. 2.5 kg, 500g')
    length = models.CharField(max_length=50, blank=True, default='',
                              help_text='e.g. 8ft, 2440mm')
    thickness = models.CharField(max_length=50, blank=True, default='',
                                 help_text='e.g. 16mm, 18mm')
    default_unit = models.CharField(max_length=20, default='nos',
                                     help_text='sheets, sets, nos, sft, kg, rft')
    default_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                       help_text='Default price per unit')
    gst_pct = models.DecimalField(max_digits=5, decimal_places=2, default=18)
    margin_pct = models.DecimalField(max_digits=5, decimal_places=2, default=35)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default='')
    image = models.ImageField(upload_to='library/materials/', blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['model_name']

    def __str__(self):
        brand = f'{self.brand.name} — ' if self.brand_id else ''
        return f'{brand}{self.model_name}'

    @property
    def full_display(self):
        """Full display text: 'Category: Brand Model'"""
        brand = f'{self.brand.name} ' if self.brand_id else ''
        return f'{self.category.name}: {brand}{self.model_name}'


class ServiceItem(models.Model):
    """
    Service-type items (Carpentry, Electrical, Painting, etc.)
    These are labour/service costs, not physical materials.
    """
    name = models.CharField(max_length=200, help_text='e.g. Box Carpentry, Electrical Works')
    category = models.CharField(max_length=100, help_text='e.g. Carpentry, Electrical, Painting')
    sub_type = models.CharField(max_length=100, blank=True, default='',
                                 help_text='e.g. Box, Panel, False Ceiling')
    description = models.TextField(blank=True, default='')
    default_unit = models.CharField(max_length=20, default='sft')
    default_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    gst_pct = models.DecimalField(max_digits=5, decimal_places=2, default=18)
    margin_pct = models.DecimalField(max_digits=5, decimal_places=2, default=35)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['category', 'name']

    def __str__(self):
        return f"{self.category} — {self.name}"
