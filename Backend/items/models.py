"""
NICARA Items — Master catalogue

The single place where "what can we sell" is defined. An estimate line is
either created from an Item (carrying its defaults) or typed free-hand.

    ItemCategory ──< Item ──< ItemComponent ──> library.MaterialItem
                                            └─> library.ServiceItem

`ItemComponent` is the bill of materials that will eventually drive rate
build-up (ply + laminate + hardware + labour → cost → margin → rate). The
structure is in place now; the costing engine is deliberately not — rates are
entered directly on the Item until that lands.
"""
from decimal import Decimal

from django.db import models
from django.utils import timezone
from django.utils.text import slugify


class ItemCategory(models.Model):
    """Top-level grouping: Carpentry, False Ceiling, Modular Kitchen, …"""

    name = models.CharField(max_length=120, unique=True)
    code = models.CharField(max_length=20, unique=True, blank=True)
    icon = models.CharField(max_length=10, blank=True, default='📦')
    description = models.TextField(blank=True, default='')
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name_plural = 'Item Categories'

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = slugify(self.name).replace('-', '').upper()[:10] or 'CAT'
        super().save(*args, **kwargs)


class Item(models.Model):
    """
    A sellable line item — "Wardrobe", "False Ceiling", "Base Cabinets".

    Dimensions are stored as free text ("8'0\"") to match how designers write
    them on site; `qty` on an estimate line stays numeric and is what actually
    multiplies against the rate.
    """

    class Unit(models.TextChoices):
        UNIT = 'unit', 'Unit'
        NOS = 'nos', 'Nos'
        SFT = 'sft', 'Sq. Ft.'
        RFT = 'rft', 'Running Ft.'
        SQM = 'sqm', 'Sq. Metre'
        SET = 'set', 'Set'
        LOT = 'lot', 'Lot'
        LUMPSUM = 'lumpsum', 'Lump Sum'

    class CalcMethod(models.TextChoices):
        """How quantity is arrived at once the costing engine is switched on."""
        PER_UNIT = 'per_unit', 'Per Unit (qty × rate)'
        AREA_LB = 'area_lb', 'Area — Length × Breadth'
        AREA_LH = 'area_lh', 'Area — Length × Height'
        RUNNING_LENGTH = 'running_length', 'Running Length'
        LUMPSUM = 'lumpsum', 'Lump Sum'

    code = models.CharField(max_length=30, unique=True, blank=True,
                            help_text='Auto-generated, e.g. CARP-WARDROBE')
    name = models.CharField(max_length=200)
    category = models.ForeignKey(ItemCategory, on_delete=models.PROTECT, related_name='items')
    description = models.TextField(blank=True, default='',
                                   help_text='Default spec text copied onto estimate lines')

    # Where this item usually applies — a hint for the estimate builder.
    default_room = models.CharField(max_length=100, blank=True, default='')

    # Defaults copied onto a new estimate line
    unit = models.CharField(max_length=20, choices=Unit.choices, default=Unit.UNIT)
    calc_method = models.CharField(max_length=20, choices=CalcMethod.choices,
                                   default=CalcMethod.PER_UNIT)
    default_length = models.CharField(max_length=20, blank=True, default='')
    default_breadth = models.CharField(max_length=20, blank=True, default='')
    default_height = models.CharField(max_length=20, blank=True, default='')
    default_qty = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    default_rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Guard rails for the designer entering a rate
    min_rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    max_rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    gst_pct = models.DecimalField(max_digits=5, decimal_places=2, default=18)
    margin_pct = models.DecimalField(max_digits=5, decimal_places=2, default=35)

    image = models.ImageField(upload_to='items/', blank=True, null=True)
    notes = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category__sort_order', 'sort_order', 'name']
        indexes = [models.Index(fields=['category', 'is_active'])]

    def __str__(self):
        return f"{self.name} ({self.category.name})"

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = self._generate_code()
        super().save(*args, **kwargs)

    def _generate_code(self):
        prefix = (self.category.code or 'ITM')[:4].upper()
        stem = slugify(self.name).replace('-', '').upper()[:12] or 'ITEM'
        base = f'{prefix}-{stem}'
        code, n = base, 1
        while Item.objects.filter(code=code).exclude(pk=self.pk).exists():
            n += 1
            code = f'{base}{n}'
        return code

    # ── Costing (structure only until the engine lands) ──────
    @property
    def component_cost(self):
        """Sum of the BOM lines — the raw cost before margin."""
        return sum((c.line_cost for c in self.components.all()), Decimal('0'))

    @property
    def suggested_rate(self):
        """Component cost uplifted by the margin. 0 when no BOM is defined."""
        cost = self.component_cost
        if not cost:
            return Decimal('0')
        margin = self.margin_pct or Decimal('0')
        return cost * (Decimal('1') + margin / Decimal('100'))

    def as_estimate_line(self, **overrides):
        """Field dict for creating an EstimateItem from this catalogue entry."""
        line = {
            'catalog_item': self,
            'area': self.default_room,
            'item': self.name,
            'description': self.description,
            'length': self.default_length,
            'breadth': self.default_breadth,
            'height': self.default_height,
            'qty': self.default_qty,
            'unit': self.unit,
            'rate': self.default_rate,
            'gst_pct': self.gst_pct,
        }
        line.update(overrides)
        return line


class ItemComponent(models.Model):
    """
    One line of an item's bill of materials.

    Points at either a library MaterialItem or a library ServiceItem — never
    both. `qty_per_unit` is per one unit of the parent item.
    """

    class ComponentType(models.TextChoices):
        MATERIAL = 'material', 'Material'
        SERVICE = 'service', 'Service / Labour'

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='components')
    component_type = models.CharField(max_length=20, choices=ComponentType.choices,
                                      default=ComponentType.MATERIAL)
    material_item = models.ForeignKey(
        'library.MaterialItem', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='used_in_items'
    )
    service_item = models.ForeignKey(
        'library.ServiceItem', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='used_in_items'
    )
    label = models.CharField(max_length=200, blank=True, default='',
                             help_text='Free-text name when no library record is linked')
    qty_per_unit = models.DecimalField(max_digits=10, decimal_places=3, default=1)
    unit = models.CharField(max_length=20, default='nos')
    rate_override = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text='Leave blank to use the linked library rate'
    )
    wastage_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    notes = models.CharField(max_length=300, blank=True, default='')
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f"{self.item.name} ← {self.display_name}"

    @property
    def display_name(self):
        if self.material_item_id:
            return str(self.material_item)
        if self.service_item_id:
            return str(self.service_item)
        return self.label or 'Unnamed component'

    @property
    def effective_rate(self):
        if self.rate_override is not None:
            return self.rate_override
        if self.material_item_id:
            return self.material_item.default_rate
        if self.service_item_id:
            return self.service_item.default_rate
        return Decimal('0')

    @property
    def line_cost(self):
        # Decimal throughout — `or 0` would hand back an int for Decimal('0.00')
        # and the subsequent division would silently produce a float.
        qty = self.qty_per_unit or Decimal('0')
        wastage = self.wastage_pct or Decimal('0')
        return qty * (Decimal('1') + wastage / Decimal('100')) * self.effective_rate
