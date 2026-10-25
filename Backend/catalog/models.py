"""
NICARA Catalogue — rooms, finished furniture and the basic components they
are estimated from.

The structure follows Sriniketh's estimate sheet:

    A Room has Zones.                       Kitchen → East Wall, Island, …
    Furniture is a finished product         Wardrobe with Openable Shutters,
      of a known cabinet type.              Crockery Unit, Kitchen Base Unit, …
    Furniture lists its Basic Components.   Doors · Draws · Shelves (Spec Purpose)
                                            Core Material(16mm BWP Ply), Box Hinges,
                                            Inner Liner(Fabric), … (Procurement)
                                            Carpentry (Service)
    Each Basic Component draws brand,       Raw Material Library (library app):
      model and price from a Raw Material   category → brand → model + rate
      category, and its quantity from a
      rule in catalog/rules.py.

Model map (clear name ← the spreadsheet column it represents):

    Room               ← "Rooms"
    Zone               ← "Sub category in rooms" (East Wall, …)
    Furniture          ← "Item"  (a complete, built product)
    BasicComponent     ← "Specifications" (K) + "Type" (J) + "Unit" (R)
    FurnitureComponent ← which basic components a furniture is estimated from
"""
from django.db import models
from django.utils.text import slugify


def make_code(prefix, name, model_cls, field='code', pk=None):
    """A short unique uppercase code, e.g. ROOM-KITCHEN, FURN-WARDROBE."""
    stem = slugify(name).replace('-', '').upper()[:10] or 'X'
    base = f'{prefix}-{stem}'
    code, n = base, 1
    qs = model_cls.objects.filter(**{field: code})
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
    A part or area of a room. East Wall, West Wall, Ceiling, Island, …
    Zones are shared across rooms, so they live in one flat list.
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
# BASIC COMPONENT  ← "Specifications" + "Type" + "Unit"
# ════════════════════════════════════════════════════════════════

class ItemType(models.TextChoices):
    """The sheet's Type column (J) — how a row is costed."""
    SPEC_PURPOSE = 'Spec Purpose', 'Spec Purpose'
    PROCUREMENT = 'Procurement', 'Procurement'
    SERVICE = 'Service', 'Service'
    PROCUREMENT_CUM_SERVICE = 'Procurement cum Service', 'Procurement cum Service'


class BasicComponent(TimeStamped):
    """
    One estimate row type: Doors, Draws, Shelves (Spec Purpose — counts only),
    Core Material(16mm BWP Ply), Box Hinges, Finishing Laminate (Procurement),
    Carpentry (Service), …

    `quantity_rule` names the formula in catalog/rules.py that turns a
    furniture's size into this row's quantity. `library_category` is the Raw
    Material family whose brands/models (and rates) can be chosen for it.
    """
    code = models.CharField(max_length=20, unique=True, blank=True)
    name = models.CharField(max_length=150, unique=True,
                            help_text='As on the estimate, e.g. Core Material(16mm BWP Ply)')
    item_type = models.CharField(max_length=30, choices=ItemType.choices,
                                 default=ItemType.PROCUREMENT)
    library_category = models.ForeignKey(
        'library.MaterialCategory', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='basic_components',
        help_text='Raw Material category supplying brand, model and price',
    )
    unit = models.CharField(max_length=20, default='nos', help_text='sft, sets, nos, kg, Mtr, …')
    price_unit = models.CharField(max_length=30, blank=True, default='',
                                  help_text='Shown next to the price, e.g. per sft')
    quantity_rule = models.CharField(max_length=40, default='fixed',
                                     help_text='Formula key in catalog/rules.py')
    default_qty = models.DecimalField(max_digits=10, decimal_places=2, default=1,
                                      help_text='Used by the "fixed" rule, or as a fallback')
    fallback_rate = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                        help_text='Rate when no raw material is linked')
    # The sheet charges no GST on service rows (carpentry, fixing, electrical).
    gst_pct = models.DecimalField(max_digits=5, decimal_places=2, default=18)
    description = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = make_code('BC', self.name, BasicComponent, pk=self.pk)
        super().save(*args, **kwargs)


# ════════════════════════════════════════════════════════════════
# FURNITURE  ← "Item" (a complete, built product)
# ════════════════════════════════════════════════════════════════

class CabinetType(models.TextChoices):
    """Selects which rules (doors, drawers, shelves, …) apply — Sheet1 col. G/K."""
    WARDROBE_OPENABLE = 'wardrobe_openable', 'Wardrobe — openable shutters'
    WARDROBE_SLIDING = 'wardrobe_sliding', 'Wardrobe — sliding shutters'
    LOFT_FRAME = 'loft_frame', 'Loft — frame'
    LOFT_BOX = 'loft_box', 'Loft — full box'
    CROCKERY_BASE = 'crockery_base', 'Crockery unit — base'
    CROCKERY_WALL = 'crockery_wall', 'Crockery unit — wall'
    POOJA = 'pooja', 'Pooja unit'
    STUDY = 'study', 'Study table'
    SHOE_RACK = 'shoe_rack', 'Shoe rack'
    TV_UNIT = 'tv_unit', 'TV unit'
    KITCHEN_BASE = 'kitchen_base', 'Kitchen — base unit'
    KITCHEN_WALL = 'kitchen_wall', 'Kitchen — wall unit'
    PANEL = 'panel', 'Panel / other (no cabinet rules)'


class Furniture(TimeStamped):
    """
    A finished product installed in a room: Wardrobe with Openable Shutters,
    Crockery Unit, Kitchen Base Unit, TV Base Unit, …

    `rooms` scopes where it appears (empty = every room). Its estimate rows
    come from `components`, quantities from the rules of its `cabinet_type`.
    """
    code = models.CharField(max_length=20, unique=True, blank=True)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, default='')
    rooms = models.ManyToManyField(Room, blank=True, related_name='furniture')
    cabinet_type = models.CharField(max_length=30, choices=CabinetType.choices,
                                    default=CabinetType.WARDROBE_OPENABLE)

    # Default size, written the designer's way (8'0", 2'6", 600mm).
    default_length = models.CharField(max_length=20, blank=True, default='',
                                      help_text='Width')
    default_breadth = models.CharField(max_length=20, blank=True, default='',
                                       help_text='Depth')
    default_height = models.CharField(max_length=20, blank=True, default='')
    default_unit = models.CharField(max_length=20, default='nos')

    gst_pct = models.DecimalField(max_digits=5, decimal_places=2, default=18)
    margin_pct = models.DecimalField(max_digits=5, decimal_places=2, default=15)
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
    def components_total(self):
        return self.components.filter(is_active=True).count()


class FurnitureComponent(TimeStamped):
    """
    One basic component a furniture is estimated from, optionally with a
    default raw material (brand/model/price) and a fixed quantity that
    replaces the rule.
    """
    furniture = models.ForeignKey(Furniture, on_delete=models.CASCADE, related_name='components')
    basic_component = models.ForeignKey(BasicComponent, on_delete=models.PROTECT,
                                        related_name='furniture_links')
    default_material = models.ForeignKey(
        'library.MaterialItem', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='furniture_defaults',
        help_text='Brand/model priced by default; else the cheapest in the category',
    )
    fixed_qty = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text='Overrides the quantity rule with a fixed quantity',
    )
    application = models.CharField(max_length=200, blank=True, default='',
                                   help_text='e.g. For drawers, Selection')

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.furniture.name} ← {self.basic_component.name}'
