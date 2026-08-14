"""
NICARA Catalogue — the room → furniture → material specification library.

This is the master data the team maintains so estimates can be built from a
consistent palette instead of free-typing every line. The hierarchy, in plain
language:

    A Room has Zones.                     Kitchen → East Wall, Island, …
    On a Zone you place Furniture.        Wardrobe, Kitchen Base Unit, …
    Furniture is built from Parts.        Cabinet, Panel, Shutter, Light, Paint
    Each Part uses Materials.             Plywood, Hardware, Laminate, …
    Each Material has priced Options.     18mm Plywood · Austin Lincoln · ₹100/sft

Model map (clear name ← the vague spreadsheet column it replaces):

    Room            ← "Rooms"
    Zone            ← "Sub category in rooms"
    Furniture       ← "Item Names"
    FurniturePart   ← "Item Type"
    Material        ← "Basic components"
    MaterialOption  ← "Detail / Brand / Model / Size / Price / Unit"
    PartMaterial    ← the link that says which materials a part is made of
"""
from decimal import Decimal, ROUND_HALF_UP

from django.db import models
from django.utils.text import slugify

MONEY = Decimal('0.01')


def money(value):
    return Decimal(value or 0).quantize(MONEY, rounding=ROUND_HALF_UP)


def make_code(prefix, name, model_cls, field='code', pk=None):
    """A short unique uppercase code, e.g. ROOM-KITCHEN, FURN-WARDROBE."""
    stem = slugify(name).replace('-', '').upper()[:10] or 'X'
    base = f'{prefix}-{stem}'
    code, n = base, 1
    lookup = {field: code}
    qs = model_cls.objects.filter(**lookup)
    if pk:
        qs = qs.exclude(pk=pk)
    while qs.exists():
        n += 1
        code = f'{base}{n}'
        qs = model_cls.objects.filter(**{field: code})
        if pk:
            qs = qs.exclude(pk=pk)
    return code


class TimeStamped(models.Model):
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# ════════════════════════════════════════════════════════════════
# ROOM  ← "Rooms"
# ════════════════════════════════════════════════════════════════

class Room(TimeStamped):
    """A type of room. Kitchen, Master Bedroom, Bedroom 2, …"""
    code = models.CharField(max_length=20, unique=True, blank=True)
    name = models.CharField(max_length=120, unique=True)
    icon = models.CharField(max_length=10, blank=True, default='🏠')
    description = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = make_code('ROOM', self.name, Room, pk=self.pk)
        super().save(*args, **kwargs)


# ════════════════════════════════════════════════════════════════
# ZONE  ← "Sub category in rooms"
# ════════════════════════════════════════════════════════════════

class Zone(TimeStamped):
    """
    A part or area of a room. East Wall, West Wall, Ceiling, Island,
    Walk-in Closet, Balcony, …

    Zones are shared across rooms (an East Wall means the same thing in any
    room), so they live in one flat list rather than being re-created per room.
    """
    code = models.CharField(max_length=20, unique=True, blank=True)
    name = models.CharField(max_length=120, unique=True)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = make_code('ZONE', self.name, Zone, pk=self.pk)
        super().save(*args, **kwargs)


# ════════════════════════════════════════════════════════════════
# MATERIAL  ← "Basic components"
# ════════════════════════════════════════════════════════════════

class Material(TimeStamped):
    """
    A type of material used to build furniture. Plywood, Hardware, Laminate,
    Veneer, Acrylic, Adhesive, Light, Paint, Wallpaper, …

    The actual purchasable products (with brand, model, size and price) are its
    Options.
    """
    code = models.CharField(max_length=20, unique=True, blank=True)
    name = models.CharField(max_length=120, unique=True)
    default_unit = models.CharField(
        max_length=20, default='nos',
        help_text='sft, rft, nos, sheets, kg, litre, set, …'
    )
    icon = models.CharField(max_length=10, blank=True, default='🧱')

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = make_code('MAT', self.name, Material, pk=self.pk)
        super().save(*args, **kwargs)

    @property
    def options_total(self):
        return self.options.filter(is_active=True).count()


class MaterialOption(TimeStamped):
    """
    A specific purchasable material — one row of the spreadsheet's detail block.

    e.g.  detail="18mm Plywood"  brand="Austin"  model_no="Lincoln"
          size="8x4"  price=100  unit="sft"
    """
    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name='options')
    detail = models.CharField(max_length=200, help_text='e.g. 18mm Plywood')
    brand = models.CharField(max_length=120, blank=True, default='')
    model_no = models.CharField(max_length=120, blank=True, default='')
    size = models.CharField(max_length=60, blank=True, default='', help_text='e.g. 8x4')
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit = models.CharField(max_length=20, default='nos')
    notes = models.CharField(max_length=300, blank=True, default='')

    # Optional bridge to the existing Material Library, for teams that also
    # keep priced materials there. Never required.
    library_item = models.ForeignKey(
        'library.MaterialItem', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='catalog_options'
    )

    class Meta:
        ordering = ['sort_order', 'brand', 'detail']

    def __str__(self):
        bits = [b for b in [self.detail, self.brand, self.model_no, self.size] if b]
        return ' · '.join(bits) or f'Option #{self.pk}'

    @property
    def label(self):
        return str(self)


# ════════════════════════════════════════════════════════════════
# FURNITURE  ← "Item Names"
# ════════════════════════════════════════════════════════════════

class Furniture(TimeStamped):
    """
    A product installed in a room. Wardrobe, TV Unit, Kitchen Base Unit, Bed, …

    `rooms` scopes where it appears — Kitchen Base Unit is linked to Kitchen so
    it only shows there. Leaving `rooms` empty makes it available everywhere
    (Paint, Lights, False Ceiling apply to any room).
    """
    code = models.CharField(max_length=20, unique=True, blank=True)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, default='')
    rooms = models.ManyToManyField(Room, blank=True, related_name='furniture')

    default_unit = models.CharField(max_length=20, default='nos')
    default_length = models.CharField(max_length=20, blank=True, default='')
    default_breadth = models.CharField(max_length=20, blank=True, default='')
    default_height = models.CharField(max_length=20, blank=True, default='')

    # A quick sell rate when the BOM roll-up is not used yet.
    base_rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gst_pct = models.DecimalField(max_digits=5, decimal_places=2, default=18)
    margin_pct = models.DecimalField(max_digits=5, decimal_places=2, default=35)

    image = models.ImageField(upload_to='catalog/furniture/', blank=True, null=True)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = make_code('FURN', self.name, Furniture, pk=self.pk)
        super().save(*args, **kwargs)

    @property
    def parts_total(self):
        return self.parts.filter(is_active=True).count()

    @property
    def material_cost(self):
        """Roll up the cost of every part's materials, before margin."""
        return money(sum((p.material_cost for p in self.parts.all()), Decimal('0')))

    @property
    def suggested_rate(self):
        """Material cost uplifted by the margin; 0 until a BOM is defined."""
        cost = self.material_cost
        if not cost:
            return Decimal('0.00')
        return money(cost * (Decimal('1') + (self.margin_pct or 0) / Decimal('100')))


class FurniturePart(TimeStamped):
    """
    A build element of a furniture. Cabinet, Shutter, Panel, Ledge, Loft,
    Light, Paint — the spreadsheet's "Item Type".
    """
    furniture = models.ForeignKey(Furniture, on_delete=models.CASCADE, related_name='parts')
    name = models.CharField(max_length=150)
    notes = models.CharField(max_length=300, blank=True, default='')

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f'{self.furniture.name} — {self.name}'

    @property
    def material_cost(self):
        return money(sum((m.line_cost for m in self.materials.all()), Decimal('0')))


class PartMaterial(TimeStamped):
    """
    Which material a part is built from, and how much of it.

    Links a FurniturePart to a Material, optionally pinning a default
    MaterialOption (the specific brand/model) and the quantity used per unit of
    furniture, so a cost can be rolled up.
    """
    part = models.ForeignKey(FurniturePart, on_delete=models.CASCADE, related_name='materials')
    material = models.ForeignKey(Material, on_delete=models.PROTECT, related_name='used_in_parts')
    default_option = models.ForeignKey(
        MaterialOption, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pinned_in_parts',
        help_text='Which specific option to price against; defaults to the cheapest active one.'
    )
    qty_per_unit = models.DecimalField(max_digits=10, decimal_places=3, default=1)
    unit = models.CharField(max_length=20, blank=True, default='')
    wastage_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    notes = models.CharField(max_length=300, blank=True, default='')

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.part.name} ← {self.material.name}'

    @property
    def effective_option(self):
        if self.default_option_id:
            return self.default_option
        return self.material.options.filter(is_active=True).order_by('price').first()

    @property
    def unit_price(self):
        option = self.effective_option
        return option.price if option else Decimal('0')

    @property
    def line_cost(self):
        qty = (self.qty_per_unit or Decimal('0'))
        wastage = self.wastage_pct or Decimal('0')
        return money(qty * (Decimal('1') + wastage / Decimal('100')) * self.unit_price)
