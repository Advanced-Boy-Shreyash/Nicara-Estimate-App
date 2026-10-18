"""
Seed the furniture catalogue with comprehensive bill-of-materials data.

Every furniture item is broken into realistic parts (Cabinet, Shutter, Drawer)
and each part lists exact raw materials with quantities that reflect real-world
interior construction. This drives the Initial Estimate's auto-calculation.

    python manage.py seed_catalog
    python manage.py seed_catalog --reset
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import (
    Furniture, FurniturePart, Material, MaterialOption, PartMaterial, Room, Zone,
)

# ── Rooms ───────────────────────────────────────────────────

ROOMS = [
    ('Master Bedroom', '🛏️'),
    ('Kitchen', '🍳'),
    ('Bedroom 2', '🛏️'),
    ('Bedroom 3', '🛏️'),
    ('Living Room', '🛋️'),
    ('Drawing Room', '🛋️'),
    ('Kids Room', '🧒'),
    ('Guest Bedroom', '🛏️'),
    ('Pooja Room', '🕉️'),
    ('Home Office', '💼'),
    ('Entrance', '🚪'),
    ('Bathroom', '🚿'),
    ('Dining Room', '🍽️'),
]

ZONES = [
    'East Wall', 'West Wall', 'North Wall', 'South Wall',
    'Ceiling', 'Floor', 'Island', 'Walk-in Closet', 'Balcony',
    'Window Side', 'Entry Side',
]

# ── Materials & Options ─────────────────────────────────────
# material_name → (default_unit, icon, [ (detail, brand, model, size, price, unit, source) ])
# source: 'manual' or 'supplier_sheet'

MATERIALS = {
    'Plywood': ('sft', '🪵', [
        ('18mm BWP Plywood', 'Austin', 'Lincoln', '8x4', 120, 'sft', 'supplier_sheet'),
        ('16mm BWP Plywood', 'Austin', 'Lincoln', '8x4', 110, 'sft', 'supplier_sheet'),
        ('12mm BWP Plywood', 'Austin', 'Lincoln', '8x4', 95, 'sft', 'supplier_sheet'),
        ('8mm BWP Plywood', 'Austin', 'Lincoln', '8x4', 80, 'sft', 'supplier_sheet'),
        ('18mm BWP Plywood', 'Century', 'Club Prime', '8x4', 130, 'sft', 'manual'),
        ('16mm BWP Plywood', 'Century', 'Club Prime', '8x4', 118, 'sft', 'manual'),
        ('18mm BWP Plywood', 'Greenply', 'Green Club', '8x4', 115, 'sft', 'manual'),
        ('16mm MR Plywood', 'Greenply', 'Green Club MR', '8x4', 85, 'sft', 'manual'),
    ]),
    'Hardware': ('nos', '🔩', [
        ('Hinge — Soft Close', 'Hettich', 'Sensys 8645i', '—', 260, 'set', 'supplier_sheet'),
        ('Hinge — Standard', 'Hettich', 'Onsys 0-Crank', '—', 180, 'set', 'supplier_sheet'),
        ('Hinge — Soft Close', 'Hafele', 'Metalla SM', '—', 220, 'set', 'manual'),
    ]),
    'Drawer Channel': ('set', '🗄️', [
        ('Telescopic Channel 18"', 'Hettich', 'Quadro V6 18"', '18"', 2600, 'set', 'supplier_sheet'),
        ('Telescopic Channel 20"', 'Hettich', 'Quadro V6 20"', '20"', 2800, 'set', 'supplier_sheet'),
        ('Telescopic Channel 18" Soft Close', 'Hettich', 'Actro 5D 18"', '18"', 4200, 'set', 'supplier_sheet'),
        ('Telescopic Channel 18"', 'Hafele', 'MX Standard 18"', '18"', 2200, 'set', 'manual'),
        ('Tandem Drawer System', 'Hettich', 'ArciTech 18"', '18"', 5500, 'set', 'manual'),
    ]),
    'Handle': ('nos', '🚪', [
        ('Cabinet Handle 6"', 'Hettich', 'ProDecor 160mm', '6"', 250, 'nos', 'supplier_sheet'),
        ('Cabinet Handle 8"', 'Hettich', 'ProDecor 200mm', '8"', 320, 'nos', 'supplier_sheet'),
        ('Profile Handle', 'Hafele', 'Aluminum Profile', '—', 450, 'nos', 'manual'),
        ('Knob Handle', 'Hettich', 'ProDecor Knob', '—', 150, 'nos', 'manual'),
    ]),
    'Screws': ('box', '🔧', [
        ('Wood Screws Assorted', 'Superfast', 'SS CSK', '4x30mm', 750, 'box', 'supplier_sheet'),
        ('Wood Screws Assorted', 'Grip', 'Premium CSK', '4x30mm', 650, 'box', 'manual'),
    ]),
    'Edge Band': ('m', '📏', [
        ('PVC Edge Band 22x0.8mm', 'Rehau', 'Standard', '50m roll', 60, 'm', 'supplier_sheet'),
        ('PVC Edge Band 22x2mm', 'Rehau', 'Premium', '50m roll', 90, 'm', 'supplier_sheet'),
        ('ABS Edge Band 22x1mm', 'Edgetech', 'Standard', '50m roll', 45, 'm', 'manual'),
    ]),
    'Laminate': ('sheet', '🎨', [
        ('1mm Laminate', 'Greenlam', 'Suede Finish', '8x4', 3000, 'sheet', 'supplier_sheet'),
        ('1mm Laminate', 'Greenlam', 'Matt Finish', '8x4', 2800, 'sheet', 'supplier_sheet'),
        ('1mm Laminate', 'Merino', 'Matte White', '8x4', 3200, 'sheet', 'supplier_sheet'),
        ('0.8mm Laminate', 'Greenlam', 'Standard', '8x4', 2200, 'sheet', 'manual'),
        ('1mm Laminate', 'Merino', 'Wood Grain', '8x4', 3400, 'sheet', 'manual'),
    ]),
    'Acrylic': ('sheet', '✨', [
        ('Acrylic Sheet Hi-Gloss', 'Merino', 'Hi-Gloss White', '8x4', 4500, 'sheet', 'supplier_sheet'),
        ('Acrylic Sheet Hi-Gloss', 'Rehau', 'Champagne Gloss', '8x4', 5200, 'sheet', 'manual'),
        ('Acrylic Sheet Matt', 'Merino', 'Silk Matt', '8x4', 4800, 'sheet', 'manual'),
    ]),
    'Veneer': ('sft', '🌳', [
        ('Natural Veneer', 'Century', 'Teak', '8x4', 180, 'sft', 'supplier_sheet'),
        ('Natural Veneer', 'Century', 'Walnut', '8x4', 220, 'sft', 'manual'),
        ('Engineered Veneer', 'Decowood', 'American Oak', '8x4', 160, 'sft', 'manual'),
    ]),
    'Adhesive': ('kg', '🧴', [
        ('Fevicol SH', 'Pidilite', 'SH', '5kg', 290, 'kg', 'supplier_sheet'),
        ('Fevicol Marine', 'Pidilite', 'Marine', '5kg', 380, 'kg', 'manual'),
    ]),
    'Paint': ('sft', '🖌️', [
        ('Emulsion Paint', 'Asian Paints', 'Royale', '—', 22, 'sft', 'supplier_sheet'),
        ('PU Polish', 'Asian Paints', 'WoodTech', '—', 220, 'sft', 'manual'),
    ]),
    'Polish': ('sft', '💎', [
        ('Melamine Polish', 'Asian Paints', 'WoodTech Melamine', '—', 180, 'sft', 'supplier_sheet'),
        ('PU Polish', 'Asian Paints', 'WoodTech PU', '—', 220, 'sft', 'manual'),
    ]),
    'Light': ('nos', '💡', [
        ('Profile Light LED', 'Philips', 'Cove Strip 1m', '1m', 320, 'nos', 'supplier_sheet'),
        ('Downlight LED', 'Philips', '9W Astra Slim', '—', 450, 'nos', 'manual'),
    ]),
    'Glass': ('sft', '🪟', [
        ('Toughened Glass 8mm', 'Saint Gobain', 'Clear', '—', 180, 'sft', 'manual'),
        ('Mirror 4mm', 'Modiguard', 'Silver', '—', 120, 'sft', 'manual'),
    ]),
    'Gypsum Board': ('sft', '🏗️', [
        ('Gypsum Board 12.5mm', 'Gyproc', 'Saint Gobain', '8x4', 45, 'sft', 'supplier_sheet'),
        ('Gypsum Board 12.5mm', 'USG Boral', 'Standard', '8x4', 42, 'sft', 'manual'),
    ]),
    'Cement Board': ('sft', '🧱', [
        ('Cement Board 6mm', 'Everest', 'Standard', '8x4', 35, 'sft', 'manual'),
    ]),
}

# ── Furniture with detailed BOM ─────────────────────────────
# Structure:
#   (name, room_names, default_unit, default_L, default_B, default_H,
#    defaults: {drawers, doors, shelves},
#    parts: { part_name: [(material, qty_per_unit, unit, wastage_pct)] })
#
# Quantities are per-unit of the furniture item and represent realistic
# amounts for a standard-sized piece. The estimator engine can override
# these with exact geometry when L/B/H are given.

FURNITURE = [
    # ────────────────────────────────────────────────────────────
    # WARDROBE — 2 doors, 2 drawers, 4 shelves, 6'x2'x8'
    # ────────────────────────────────────────────────────────────
    ('Wardrobe', ['Master Bedroom', 'Bedroom 2', 'Bedroom 3', 'Kids Room', 'Guest Bedroom'],
     'nos', "6'0\"", "2'0\"", "8'0\"",
     {'drawers': 2, 'doors': 2, 'shelves': 4},
     {
         'Carcass (Sides + Top + Bottom)': [
             ('Plywood', 48, 'sft', 8),      # 2 sides (2x8=16 each) + top/bottom (6x2=12 each)
             ('Edge Band', 12, 'm', 5),       # exposed front edges
             ('Screws', 1, 'box', 0),         # assembly screws
             ('Adhesive', 0.5, 'kg', 0),
         ],
         'Back Panel': [
             ('Plywood', 48, 'sft', 5),       # 6'x8' = 48 sft, 8mm ply
         ],
         'Shelves': [
             ('Plywood', 48, 'sft', 8),       # 4 shelves × (6x2) = 48 sft
             ('Edge Band', 8, 'm', 5),
         ],
         'Doors / Shutters': [
             ('Plywood', 32, 'sft', 8),       # 2 doors × (3x8) = 48 sft → ~32 sft 16mm
             ('Hardware', 4, 'nos', 0),        # 2 hinges per door × 2 doors
             ('Handle', 2, 'nos', 0),          # 1 handle per door
             ('Laminate', 2, 'sheet', 5),      # 2 sheets for 2 door faces
             ('Adhesive', 1, 'kg', 0),
         ],
         'Drawers': [
             ('Plywood', 16, 'sft', 8),       # 2 drawers: front + back + sides + bottom
             ('Drawer Channel', 2, 'set', 0),  # 1 pair telescopic channel per drawer
             ('Handle', 2, 'nos', 0),          # 1 handle per drawer
             ('Screws', 0.5, 'box', 0),
         ],
     }),

    # ────────────────────────────────────────────────────────────
    # TV UNIT — 2 doors, 0 drawers, 2 shelves, 6'x1'3"x4'
    # ────────────────────────────────────────────────────────────
    ('TV Unit', ['Master Bedroom', 'Living Room', 'Drawing Room', 'Guest Bedroom'],
     'nos', "6'0\"", "1'3\"", "4'0\"",
     {'drawers': 0, 'doors': 2, 'shelves': 2},
     {
         'Carcass': [
             ('Plywood', 24, 'sft', 8),
             ('Edge Band', 8, 'm', 5),
             ('Screws', 0.5, 'box', 0),
             ('Adhesive', 0.3, 'kg', 0),
         ],
         'Back Panel': [
             ('Plywood', 24, 'sft', 5),       # 6'x4' = 24 sft, 8mm
         ],
         'Shelves': [
             ('Plywood', 15, 'sft', 8),       # 2 shelves
             ('Edge Band', 4, 'm', 5),
         ],
         'Doors / Shutters': [
             ('Plywood', 12, 'sft', 8),
             ('Hardware', 4, 'nos', 0),        # 2 per door × 2
             ('Handle', 2, 'nos', 0),
             ('Laminate', 1, 'sheet', 5),
             ('Adhesive', 0.5, 'kg', 0),
         ],
         'Wall Panel': [
             ('Plywood', 18, 'sft', 8),       # decorative back panel
             ('Veneer', 18, 'sft', 5),         # veneer finish on panel
         ],
     }),

    # ────────────────────────────────────────────────────────────
    # STUDY TABLE — 1 drawer, 0 doors, 1 shelf, 4'x1'6"x2'6"
    # ────────────────────────────────────────────────────────────
    ('Study Table', ['Bedroom 2', 'Bedroom 3', 'Kids Room', 'Home Office'],
     'nos', "4'0\"", "1'6\"", "2'6\"",
     {'drawers': 1, 'doors': 0, 'shelves': 1},
     {
         'Carcass': [
             ('Plywood', 18, 'sft', 8),
             ('Edge Band', 6, 'm', 5),
             ('Screws', 0.5, 'box', 0),
             ('Adhesive', 0.3, 'kg', 0),
         ],
         'Table Top': [
             ('Plywood', 6, 'sft', 8),        # 4'x1.5' top
             ('Laminate', 0.5, 'sheet', 5),
             ('Edge Band', 3.5, 'm', 5),
         ],
         'Drawers': [
             ('Plywood', 6, 'sft', 8),
             ('Drawer Channel', 1, 'set', 0),
             ('Handle', 1, 'nos', 0),
             ('Screws', 0.3, 'box', 0),
         ],
         'Shelf': [
             ('Plywood', 6, 'sft', 8),
             ('Edge Band', 2, 'm', 5),
         ],
     }),

    # ────────────────────────────────────────────────────────────
    # SHOE RACK — 2 doors, 0 drawers, 4 shelves, 3'x1'x4'
    # ────────────────────────────────────────────────────────────
    ('Shoe Rack', ['Drawing Room', 'Entrance', 'Living Room'],
     'nos', "3'0\"", "1'0\"", "4'0\"",
     {'drawers': 0, 'doors': 2, 'shelves': 4},
     {
         'Carcass': [
             ('Plywood', 18, 'sft', 8),
             ('Edge Band', 6, 'm', 5),
             ('Screws', 0.5, 'box', 0),
             ('Adhesive', 0.2, 'kg', 0),
         ],
         'Back Panel': [
             ('Plywood', 12, 'sft', 5),
         ],
         'Shelves': [
             ('Plywood', 12, 'sft', 8),       # 4 shelves × 3 sft
             ('Edge Band', 4, 'm', 5),
         ],
         'Doors / Shutters': [
             ('Plywood', 12, 'sft', 8),
             ('Hardware', 4, 'nos', 0),
             ('Handle', 2, 'nos', 0),
             ('Laminate', 1, 'sheet', 5),
             ('Adhesive', 0.5, 'kg', 0),
         ],
     }),

    # ────────────────────────────────────────────────────────────
    # KITCHEN BASE UNIT — 2 doors, 2 drawers, 1 shelf, 10'x2'x2'10"
    # ────────────────────────────────────────────────────────────
    ('Kitchen Base Unit', ['Kitchen'],
     'nos', "10'0\"", "2'0\"", "2'10\"",
     {'drawers': 2, 'doors': 4, 'shelves': 2},
     {
         'Carcass': [
             ('Plywood', 60, 'sft', 8),
             ('Edge Band', 16, 'm', 5),
             ('Screws', 1.5, 'box', 0),
             ('Adhesive', 0.8, 'kg', 0),
         ],
         'Back Panel': [
             ('Plywood', 28, 'sft', 5),
         ],
         'Shelves': [
             ('Plywood', 20, 'sft', 8),
             ('Edge Band', 6, 'm', 5),
         ],
         'Doors / Shutters': [
             ('Plywood', 28, 'sft', 8),
             ('Hardware', 8, 'nos', 0),        # 2 per door × 4
             ('Handle', 4, 'nos', 0),
             ('Acrylic', 2, 'sheet', 5),       # acrylic finish for kitchen
             ('Adhesive', 1, 'kg', 0),
         ],
         'Drawers': [
             ('Plywood', 16, 'sft', 8),
             ('Drawer Channel', 2, 'set', 0),
             ('Handle', 2, 'nos', 0),
             ('Screws', 0.5, 'box', 0),
         ],
     }),

    # ────────────────────────────────────────────────────────────
    # KITCHEN WALL UNIT — 2 doors, 0 drawers, 2 shelves, 10'x1'x2'6"
    # ────────────────────────────────────────────────────────────
    ('Kitchen Wall Unit', ['Kitchen'],
     'nos', "10'0\"", "1'0\"", "2'6\"",
     {'drawers': 0, 'doors': 4, 'shelves': 2},
     {
         'Carcass': [
             ('Plywood', 38, 'sft', 8),
             ('Edge Band', 10, 'm', 5),
             ('Screws', 1, 'box', 0),
             ('Adhesive', 0.5, 'kg', 0),
         ],
         'Back Panel': [
             ('Plywood', 25, 'sft', 5),
         ],
         'Shelves': [
             ('Plywood', 20, 'sft', 8),
             ('Edge Band', 6, 'm', 5),
         ],
         'Doors / Shutters': [
             ('Plywood', 25, 'sft', 8),
             ('Hardware', 8, 'nos', 0),
             ('Handle', 4, 'nos', 0),
             ('Acrylic', 2, 'sheet', 5),
             ('Adhesive', 1, 'kg', 0),
         ],
     }),

    # ────────────────────────────────────────────────────────────
    # KITCHEN TALL UNIT — 2 doors, 0 drawers, 5 shelves, 2'6"x2'x7'
    # ────────────────────────────────────────────────────────────
    ('Kitchen Tall Unit', ['Kitchen'],
     'nos', "2'6\"", "2'0\"", "7'0\"",
     {'drawers': 0, 'doors': 2, 'shelves': 5},
     {
         'Carcass': [
             ('Plywood', 42, 'sft', 8),
             ('Edge Band', 10, 'm', 5),
             ('Screws', 1, 'box', 0),
             ('Adhesive', 0.5, 'kg', 0),
         ],
         'Back Panel': [
             ('Plywood', 17, 'sft', 5),
         ],
         'Shelves': [
             ('Plywood', 25, 'sft', 8),       # 5 shelves
             ('Edge Band', 8, 'm', 5),
         ],
         'Doors / Shutters': [
             ('Plywood', 17, 'sft', 8),
             ('Hardware', 6, 'nos', 0),        # 3 per door × 2 (tall)
             ('Handle', 2, 'nos', 0),
             ('Acrylic', 1, 'sheet', 5),
             ('Adhesive', 0.5, 'kg', 0),
         ],
     }),

    # ────────────────────────────────────────────────────────────
    # KITCHEN LOFT — 0 doors, 0 drawers, 0 shelves + hinged flap, 10'x1'6"x1'6"
    # ────────────────────────────────────────────────────────────
    ('Kitchen Loft', ['Kitchen'],
     'nos', "10'0\"", "1'6\"", "1'6\"",
     {'drawers': 0, 'doors': 4, 'shelves': 0},
     {
         'Carcass': [
             ('Plywood', 22, 'sft', 8),
             ('Edge Band', 8, 'm', 5),
             ('Screws', 0.5, 'box', 0),
             ('Adhesive', 0.3, 'kg', 0),
         ],
         'Back Panel': [
             ('Plywood', 15, 'sft', 5),
         ],
         'Doors / Shutters': [
             ('Plywood', 15, 'sft', 8),
             ('Hardware', 8, 'nos', 0),
             ('Handle', 4, 'nos', 0),
             ('Laminate', 1, 'sheet', 5),
             ('Adhesive', 0.5, 'kg', 0),
         ],
     }),

    # ────────────────────────────────────────────────────────────
    # DRESSING TABLE — 2 drawers, 0 doors, 1 shelf, 3'x1'6"x5'
    # ────────────────────────────────────────────────────────────
    ('Dressing Table', ['Master Bedroom', 'Guest Bedroom'],
     'nos', "3'0\"", "1'6\"", "5'0\"",
     {'drawers': 2, 'doors': 0, 'shelves': 1},
     {
         'Carcass': [
             ('Plywood', 20, 'sft', 8),
             ('Edge Band', 6, 'm', 5),
             ('Screws', 0.5, 'box', 0),
             ('Adhesive', 0.3, 'kg', 0),
         ],
         'Back Panel': [
             ('Plywood', 15, 'sft', 5),
         ],
         'Table Top': [
             ('Plywood', 4.5, 'sft', 8),
             ('Laminate', 0.5, 'sheet', 5),
             ('Edge Band', 3, 'm', 5),
         ],
         'Mirror Panel': [
             ('Glass', 6, 'sft', 0),          # mirror
             ('Plywood', 6, 'sft', 5),         # backing
         ],
         'Drawers': [
             ('Plywood', 8, 'sft', 8),
             ('Drawer Channel', 2, 'set', 0),
             ('Handle', 2, 'nos', 0),
             ('Screws', 0.3, 'box', 0),
         ],
     }),

    # ────────────────────────────────────────────────────────────
    # BED HEADBOARD + SIDE PANELS — 0 doors, 0 drawers, 5'x0'4"x4'
    # ────────────────────────────────────────────────────────────
    ('Bed Headboard', ['Master Bedroom', 'Bedroom 2', 'Bedroom 3'],
     'nos', "5'0\"", "0'4\"", "4'0\"",
     {'drawers': 0, 'doors': 0, 'shelves': 0},
     {
         'Back Panel': [
             ('Plywood', 20, 'sft', 8),
             ('Veneer', 20, 'sft', 5),
             ('Adhesive', 0.5, 'kg', 0),
         ],
         'Side Tables': [
             ('Plywood', 8, 'sft', 8),
             ('Veneer', 8, 'sft', 5),
             ('Edge Band', 4, 'm', 5),
         ],
     }),

    # ────────────────────────────────────────────────────────────
    # WALL PANELS — decorative, no doors/drawers
    # ────────────────────────────────────────────────────────────
    ('Wall Panels', ['Living Room', 'Drawing Room', 'Master Bedroom'],
     'sft', "8'0\"", "—", "8'0\"",
     {'drawers': 0, 'doors': 0, 'shelves': 0},
     {
         'Panel': [
             ('Plywood', 1, 'sft', 8),        # per sft pricing
             ('Veneer', 1, 'sft', 5),
             ('Adhesive', 0.03, 'kg', 0),
         ],
     }),

    # ────────────────────────────────────────────────────────────
    # FALSE CEILING — gypsum based, per sft
    # ────────────────────────────────────────────────────────────
    ('False Ceiling', [],  # available in all rooms
     'sft', "14'0\"", "12'0\"", "—",
     {'drawers': 0, 'doors': 0, 'shelves': 0},
     {
         'Ceiling Structure': [
             ('Gypsum Board', 1, 'sft', 5),    # per sft
             ('Screws', 0.01, 'box', 0),
         ],
         'Lighting': [
             ('Light', 0.1, 'nos', 0),         # ~1 light per 10 sft
         ],
     }),

    # ────────────────────────────────────────────────────────────
    # BAR UNIT — 2 doors, 1 drawer, 2 shelves, 6'x2'x3'6"
    # ────────────────────────────────────────────────────────────
    ('Bar Unit', ['Living Room', 'Drawing Room'],
     'nos', "6'0\"", "2'0\"", "3'6\"",
     {'drawers': 1, 'doors': 2, 'shelves': 2},
     {
         'Carcass': [
             ('Plywood', 28, 'sft', 8),
             ('Edge Band', 8, 'm', 5),
             ('Screws', 0.5, 'box', 0),
             ('Adhesive', 0.3, 'kg', 0),
         ],
         'Back Panel': [
             ('Plywood', 21, 'sft', 5),
         ],
         'Shelves': [
             ('Plywood', 12, 'sft', 8),
             ('Glass', 6, 'sft', 0),           # glass shelves for display
             ('Edge Band', 4, 'm', 5),
         ],
         'Doors / Shutters': [
             ('Plywood', 14, 'sft', 8),
             ('Hardware', 4, 'nos', 0),
             ('Handle', 2, 'nos', 0),
             ('Veneer', 14, 'sft', 5),
             ('Adhesive', 0.5, 'kg', 0),
         ],
         'Drawers': [
             ('Plywood', 6, 'sft', 8),
             ('Drawer Channel', 1, 'set', 0),
             ('Handle', 1, 'nos', 0),
             ('Screws', 0.3, 'box', 0),
         ],
         'Counter Top': [
             ('Plywood', 12, 'sft', 8),
             ('Veneer', 12, 'sft', 5),
             ('Edge Band', 4, 'm', 5),
         ],
     }),

    # ────────────────────────────────────────────────────────────
    # POOJA UNIT — 2 doors, 0 drawers, 2 shelves, 4'x2'x7'
    # ────────────────────────────────────────────────────────────
    ('Pooja Unit', ['Pooja Room'],
     'nos', "4'0\"", "2'0\"", "7'0\"",
     {'drawers': 1, 'doors': 2, 'shelves': 2},
     {
         'Carcass': [
             ('Plywood', 32, 'sft', 8),
             ('Edge Band', 8, 'm', 5),
             ('Screws', 0.5, 'box', 0),
             ('Adhesive', 0.3, 'kg', 0),
         ],
         'Back Panel': [
             ('Plywood', 28, 'sft', 5),
         ],
         'Shelves': [
             ('Plywood', 8, 'sft', 8),
             ('Edge Band', 4, 'm', 5),
         ],
         'Doors / Shutters': [
             ('Plywood', 14, 'sft', 8),
             ('Hardware', 4, 'nos', 0),
             ('Handle', 2, 'nos', 0),
             ('Veneer', 14, 'sft', 5),         # veneer for pooja unit
             ('Adhesive', 0.5, 'kg', 0),
         ],
         'Drawer': [
             ('Plywood', 6, 'sft', 8),
             ('Drawer Channel', 1, 'set', 0),
             ('Handle', 1, 'nos', 0),
         ],
     }),

    # ────────────────────────────────────────────────────────────
    # CROCKERY UNIT — 2 doors (glass), 2 drawers, 3 shelves, 4'x1'6"x7'
    # ────────────────────────────────────────────────────────────
    ('Crockery Unit', ['Dining Room', 'Kitchen', 'Living Room'],
     'nos', "4'0\"", "1'6\"", "7'0\"",
     {'drawers': 2, 'doors': 2, 'shelves': 3},
     {
         'Carcass': [
             ('Plywood', 36, 'sft', 8),
             ('Edge Band', 10, 'm', 5),
             ('Screws', 1, 'box', 0),
             ('Adhesive', 0.4, 'kg', 0),
         ],
         'Back Panel': [
             ('Plywood', 28, 'sft', 5),
         ],
         'Shelves': [
             ('Plywood', 12, 'sft', 8),
             ('Glass', 6, 'sft', 0),           # glass shelf
             ('Edge Band', 6, 'm', 5),
         ],
         'Doors / Shutters': [
             ('Plywood', 14, 'sft', 8),
             ('Glass', 14, 'sft', 0),          # glass doors
             ('Hardware', 4, 'nos', 0),
             ('Handle', 2, 'nos', 0),
             ('Laminate', 1, 'sheet', 5),
             ('Adhesive', 0.5, 'kg', 0),
         ],
         'Drawers': [
             ('Plywood', 10, 'sft', 8),
             ('Drawer Channel', 2, 'set', 0),
             ('Handle', 2, 'nos', 0),
             ('Screws', 0.3, 'box', 0),
         ],
     }),

    # ────────────────────────────────────────────────────────────
    # WARDROBE LOFT — storage on top, 6'x2'x1'6"
    # ────────────────────────────────────────────────────────────
    ('Wardrobe Loft', ['Master Bedroom', 'Bedroom 2', 'Bedroom 3', 'Kids Room'],
     'nos', "6'0\"", "2'0\"", "1'6\"",
     {'drawers': 0, 'doors': 2, 'shelves': 0},
     {
         'Carcass': [
             ('Plywood', 14, 'sft', 8),
             ('Edge Band', 4, 'm', 5),
             ('Screws', 0.3, 'box', 0),
             ('Adhesive', 0.2, 'kg', 0),
         ],
         'Back Panel': [
             ('Plywood', 9, 'sft', 5),
         ],
         'Doors / Shutters': [
             ('Plywood', 9, 'sft', 8),
             ('Hardware', 4, 'nos', 0),
             ('Handle', 2, 'nos', 0),
             ('Laminate', 1, 'sheet', 5),
             ('Adhesive', 0.3, 'kg', 0),
         ],
     }),

    # ────────────────────────────────────────────────────────────
    # CONSOLE TABLE — 1 drawer, 0 doors, 1 shelf, 5'x1'6"x3'
    # ────────────────────────────────────────────────────────────
    ('Console Table', ['Entrance', 'Living Room', 'Drawing Room'],
     'nos', "5'0\"", "1'6\"", "3'0\"",
     {'drawers': 1, 'doors': 0, 'shelves': 1},
     {
         'Carcass': [
             ('Plywood', 16, 'sft', 8),
             ('Edge Band', 6, 'm', 5),
             ('Screws', 0.5, 'box', 0),
             ('Adhesive', 0.2, 'kg', 0),
         ],
         'Table Top': [
             ('Plywood', 7.5, 'sft', 8),
             ('Veneer', 7.5, 'sft', 5),
             ('Edge Band', 4, 'm', 5),
         ],
         'Drawers': [
             ('Plywood', 6, 'sft', 8),
             ('Drawer Channel', 1, 'set', 0),
             ('Handle', 1, 'nos', 0),
         ],
         'Shelf': [
             ('Plywood', 7.5, 'sft', 8),
             ('Veneer', 7.5, 'sft', 5),
         ],
     }),

    # ────────────────────────────────────────────────────────────
    # BOOKSHELF — 0 doors, 0 drawers, 5 shelves, 3'x1'x6'
    # ────────────────────────────────────────────────────────────
    ('Bookshelf', ['Home Office', 'Living Room', 'Bedroom 2', 'Kids Room'],
     'nos', "3'0\"", "1'0\"", "6'0\"",
     {'drawers': 0, 'doors': 0, 'shelves': 5},
     {
         'Carcass': [
             ('Plywood', 24, 'sft', 8),
             ('Edge Band', 8, 'm', 5),
             ('Screws', 0.5, 'box', 0),
             ('Adhesive', 0.3, 'kg', 0),
         ],
         'Back Panel': [
             ('Plywood', 18, 'sft', 5),
         ],
         'Shelves': [
             ('Plywood', 15, 'sft', 8),
             ('Edge Band', 10, 'm', 5),
         ],
     }),
]


class Command(BaseCommand):
    help = 'Seed the furniture catalogue with comprehensive bill-of-materials.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true')
        parser.add_argument('--skip-supplier-specs', action='store_true',
                            help="Don't apply the bundled supplier price sheet.")

    @transaction.atomic
    def handle(self, *args, **options):
        apply_supplier_specs = not options['skip_supplier_specs']
        if options['reset']:
            for model in (PartMaterial, FurniturePart, Furniture, MaterialOption,
                          Material, Zone, Room):
                model.objects.all().delete()
            self.stdout.write(self.style.WARNING('Cleared existing catalogue.'))

        # ── Rooms ────────────────────────────────────────────
        rooms = {}
        for order, (name, icon) in enumerate(ROOMS, start=1):
            rooms[name], _ = Room.objects.get_or_create(
                name=name, defaults={'icon': icon, 'sort_order': order})

        for order, name in enumerate(ZONES, start=1):
            Zone.objects.get_or_create(name=name, defaults={'sort_order': order})

        # ── Materials & Options ──────────────────────────────
        materials = {}
        for order, (name, (unit, icon, option_rows)) in enumerate(MATERIALS.items(), start=1):
            material, _ = Material.objects.get_or_create(
                name=name, defaults={'default_unit': unit, 'icon': icon, 'sort_order': order})
            material.ensure_library_category()
            materials[name] = material
            for o_order, row in enumerate(option_rows, start=1):
                detail, brand, model, size, price, o_unit, source = row
                option, _ = MaterialOption.objects.get_or_create(
                    material=material, detail=detail, brand=brand, model_no=model, size=size,
                    defaults={
                        'price': Decimal(price), 'unit': o_unit,
                        'sort_order': o_order, 'source': source,
                    },
                )
                option.sync_library_item()

        # ── Furniture with BOM ───────────────────────────────
        furniture_made = parts_made = links_made = 0
        for f_order, entry in enumerate(FURNITURE, start=1):
            (name, room_names, unit, def_l, def_b, def_h,
             defaults_config, parts) = entry

            furniture, was_new = Furniture.objects.get_or_create(
                name=name,
                defaults={
                    'default_unit': unit,
                    'default_length': def_l,
                    'default_breadth': def_b,
                    'default_height': def_h,
                    'sort_order': f_order,
                })
            if was_new:
                furniture_made += 1
            if room_names:
                furniture.rooms.set([rooms[r] for r in room_names if r in rooms])

            for p_order, (part_name, mat_list) in enumerate(parts.items(), start=1):
                part, _ = FurniturePart.objects.get_or_create(
                    furniture=furniture, name=part_name,
                    defaults={'sort_order': p_order})
                parts_made += 1
                for m_order, (mat_name, qty, m_unit, wastage) in enumerate(mat_list, start=1):
                    material = materials.get(mat_name)
                    if not material:
                        continue
                    PartMaterial.objects.get_or_create(
                        part=part, material=material,
                        defaults={
                            'qty_per_unit': Decimal(str(qty)), 'unit': m_unit,
                            'wastage_pct': Decimal(str(wastage)), 'sort_order': m_order,
                        },
                    )
                    links_made += 1

        if apply_supplier_specs:
            try:
                from catalog.supplier_specs import import_specs
                from catalog.supplier_specs_data import SUPPLIER_SPECS
                import_specs(SUPPLIER_SPECS)
            except ImportError:
                self.stdout.write(self.style.WARNING(
                    'Supplier specs module not found, skipping.'))

        self.stdout.write(self.style.SUCCESS(
            f'Rooms: {Room.objects.count()} | Zones: {Zone.objects.count()} | '
            f'Materials: {Material.objects.count()} '
            f'({MaterialOption.objects.count()} options) | '
            f'Furniture: {Furniture.objects.count()} | '
            f'Parts: {FurniturePart.objects.count()} | BOM lines: {PartMaterial.objects.count()}'
        ))
