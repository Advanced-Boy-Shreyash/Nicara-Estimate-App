"""
Catalogue data transcribed from Sriniketh's calculation workbook
("Calculations.xlsx" → "Finel Estimate Detailes - V5" + Sheet1), plus the
brands and models of the client's sample estimate ("sample template.xlsx" →
Sample detail) as alternatives to choose from.

    RAW_MATERIALS     → Raw Material Library (category → brand → model + rate)
    SAMPLE_MATERIALS  → more brands/models for the same categories
    BASIC_COMPONENTS  → catalog.BasicComponent (one estimate row type each)
    FURNITURE         → catalog.Furniture + its FurnitureComponents

Spellings are cleaned up ("Hafelle" → Hafele, "Edge bainding" → Edge Banding);
prices are the sheet's, except where noted. Furniture whose component list was
not in the worked sheet is marked ASSUMED — confirm with Sriniketh.
"""

# ── Raw materials ─────────────────────────────────────────────────
# category: (type, product_group, [ (brand, model, unit, rate) ])
RAW_MATERIALS = {
    'Core Material(18mm BWP Ply)': ('Procurement', 'plywood', [('Gurjan', '710 BWP', 'sft', 80)]),
    'Core Material(16mm BWP Ply)': ('Procurement', 'plywood', [('Gurjan', '710 BWP', 'sft', 80)]),
    'Core Material(16mm BWP B Board)': ('Procurement', 'plywood', [('Gurjan', '710 BWP', 'sft', 80)]),
    'Core Material(12mm BWP Ply)': ('Procurement', 'plywood', [('Gurjan', '710 BWP', 'sft', 75)]),
    'Core Material(12mm Flex Ply)': ('Procurement', 'plywood', [('Gurjan', '710 BWP', 'sft', 75)]),
    'Box Hinges': ('Procurement', 'hardware', [('Hafele', '0 Crank', 'sets', 220)]),
    'Draw Channels': ('Procurement', 'hardware', [
        ('Hettich', '12" Soft Close Channels', 'sets', 650),
        ('Hettich', '20" Telescopic Soft Close', 'sets', 750),
    ]),
    'Quadro Channels': ('Procurement', 'hardware', [('Hettich', '12" Soft Close Channels', 'sets', 2200)]),
    'Handles/Knobs': ('Procurement', 'hardware', [
        ('Nimmi', 'Handle (selection)', 'nos', 750),
        ('Nimmi', '1 Ft Handles', 'nos', 1000),      # sheet: ₹2,200, application "Up To 1000"
        ('Nimmi', 'Knobs', 'nos', 150),              # sheet: ₹2,200, application "Up To 150"
        ('Nimmi', 'Gola Profile 18mm', 'lengths', 650),
    ]),
    'Draw Locks': ('Procurement', 'hardware', [('Godrej', 'Nuovo 22mm', 'nos', 580)]),
    'Accessories': ('Procurement', 'hardware', [
        ('Nimmi', 'Hanger Pipe - NWHP004', 'nos', 1250),
        ('Nimmi', 'Brackets for Hanger Pipe', 'sets', 220),
    ]),
    'Kitchen Accessories': ('Procurement', 'kitchen_accessories', [
        ('Hafele', '150mm x 500mm Tandem Basket', 'nos', 3600),
        ('Hafele', '150mm x 500mm Extra Gallery', 'nos', 650),
        ('Hafele', 'Cutlery Tray', 'nos', 650),
        ('Hafele', 'Thali Organizer', 'nos', 650),
    ]),
    'Inner Liner(Fabric)': ('Procurement', 'finishing', [('Abco', 'Suitable Regular Colour', 'sft', 20)]),
    'Finishing - Laminate': ('Procurement', 'finishing', [
        ('', 'Standard Laminate (selection)', 'sft', 120),
        ('', 'White 101 SUD', 'sft', 120),
        ('', 'Wild Pear 403 - SU', 'sft', 150),
        ('', 'APM - 107 Thermal Laminate', 'sft', 100),
    ]),
    'Finishing - Acrylic': ('Procurement', 'finishing', [('', 'Acrylic (selection)', 'sft', 150)]),
    'Finishing - Veneer': ('Procurement', 'finishing', []),     # no price in the sheet yet
    'Profile Doors': ('Procurement', 'finishing', [
        ('', 'Profile Door (selection)', 'sft', 850),
        ('', '25mm Profile Doors', 'sft', 750),
    ]),
    'Edge Banding': ('Procurement', 'finishing', [('E3', '0.8mm x 22mm', 'Mtr', 35)]),
    'Adhesive(Bonding)': ('Procurement', 'other', [
        ('Fevicol', 'Hi - Per', 'kg', 320),
        ('Fevicol', 'Pro Bond', 'kg', 350),
    ]),
    'Adhesive(Support)': ('Procurement', 'other', [('Abro', 'Masking Tape', 'nos', 125)]),
    'Nails and Screws': ('Procurement', 'other', [('PTA', 'Assorted', 'nos', 650)]),
    'Unit Top': ('Procurement', 'other', [
        ('Pacifi', '20mm Quartz', 'sft', 650),
        ('', 'Same as Kitchen (selection)', 'sft', 650),
    ]),
    'Counter Top Fixing': ('Service', 'other', [
        ('', 'Quartz Fixing', 'slab', 12500),
        ('Pacifi', '20mm Fixing', 'slab', 15000),
    ]),
    'Dado Tiles': ('Procurement', 'other', [('Motto', '8 x 4 Wall Tiles', 'sft', 150)]),
    'Dado Tiles Fixing': ('Service', 'other', [('', '8 x 4 Wall Tiles Fixing', 'sft', 100)]),
    'Profile Channel': ('Procurement', 'other', [('Wipro', '8mm Aluminium Profile Channel', 'Mtr', 0)]),
    'Lights': ('Procurement', 'other', [('Wipro', '10mm Concealed Aluminium Profile', 'Mtr', 120)]),
    'Drivers': ('Procurement', 'other', [('Wipro', '5 Amp Driver', 'nos', 950)]),
    'Sink & Tap': ('Procurement', 'other', [('Sinkcora', '18 x 20 x 9 Matt Sink & Pull-out Tap', 'nos', 25000)]),
    'Electrical Work': ('Service', 'other', [('', 'Profile Light Fixing', 'nos', 550)]),
    'Carpentry': ('Service', 'other', [
        ('', 'Box — base units', 'sft', 300),
        ('', 'Box — kitchen', 'sft', 340),
        ('', 'Box — wardrobe', 'sft', 350),
    ]),
    'Premium Emulsion': ('Procurement cum Service', 'other', [('Asian Paints', 'Premium Emulsion', 'sft', 20)]),
    'Design & Concept': ('Service', 'other', [('Nicara', '2D and 3D Renders', 'sft', 38.135)]),
    'Transport & Handling': ('Service', 'other', [('', 'Material transport & shifting labour', 'nos', 20000)]),
    'Debris Management': ('Service', 'other', [('', 'Regular clearance from site to dumping location', 'nos', 15000)]),
    'Deep Cleaning': ('Service', 'other', [('', 'One-time deep cleaning — flooring, vacuum, gum removal', 'nos', 10500)]),
}

# Brands and models from the sample estimate, priced in the rows' units:
# a sheet price is per 8x4 sheet, so ÷ 32 for per sft; ₹55/rft = ₹180.45/m.
SAMPLE_MATERIALS = {
    'Core Material(18mm BWP Ply)': [('Austin', 'Lincoln BWP', 'sft', 100)],
    'Core Material(16mm BWP Ply)': [('Austin', 'Lincoln BWP', 'sft', 110)],          # ₹3,520 / sheet
    'Core Material(16mm BWP B Board)': [('Austin', 'Lincoln BWP', 'sft', 110)],
    'Core Material(12mm BWP Ply)': [('Austin', 'Lincoln BWP', 'sft', 95)],           # ₹3,040 / sheet
    'Box Hinges': [('Hettich', 'Onsys - 0 Crank Soft Close', 'sets', 260),
                   ('Hettich', 'Onsys - 8 Crank Soft Close', 'sets', 260)],
    'Draw Channels': [('Hettich', 'Quadro - 18" Soft Close', 'sets', 2600),
                      ('Hettich', 'Quadro - 12"', 'sets', 2600)],
    'Handles/Knobs': [('', 'Handles - INR 1000 per piece', 'nos', 1200),
                      ('', 'Foldable Handles - INR 200 per piece', 'nos', 250),
                      ('', 'Knobs - INR 250 per piece', 'nos', 250),
                      ('Ebco', 'Aluminium Cabinet Edge - Silver', 'nos', 1250),
                      ('Ebco', 'Matt Black - Gola Profile', 'nos', 1250)],
    'Draw Locks': [('Godrej', 'Nuovo - Draw locks 25mm', 'nos', 650)],
    'Accessories': [('', 'Tower Bolts', 'nos', 120)],
    'Kitchen Accessories': [('Hettich', 'Architech 4" Tandem Basket', 'nos', 3650),
                            ('Hettich', 'Cutlery Tray', 'nos', 850),
                            ('Hettich', 'Thali Tray', 'nos', 850)],
    'Inner Liner(Fabric)': [('Fabric', '0.8mm thick', 'sft', 14.06)],                # ₹450 / sheet
    'Finishing - Laminate': [('Greenlam', 'Grey Colour', 'sft', 109.38),            # ₹3,500 / sheet
                             ('Greenlam', 'Off White Colour', 'sft', 109.38),
                             ('Greenlam', 'Wooden Laminate', 'sft', 109.38),
                             ('Greenlam', 'White', 'sft', 93.75),                   # ₹3,000 / sheet
                             ('Thermo Laminate', 'Off White', 'sft', 171.88)],      # ₹5,500 / sheet
    'Finishing - Acrylic': [('', 'RM 6104 Fern', 'sft', 140.63)],                  # ₹4,500 / sheet
    'Finishing - Veneer': [('', 'Veneer (selection)', 'sft', 187.5)],               # ₹6,000 / sheet
    'Edge Banding': [('Shape', 'PVC 22mm x 2mm', 'Mtr', 60)],
    'Lights': [('Alt', 'Profile Light', 'Mtr', 180.45)],                            # ₹55 / rft
    'Drivers': [('Alt', '5 Amp Driver With Sensors', 'nos', 1500)],
}

# ── Basic components ──────────────────────────────────────────────
# name: (type, raw-material category or None, unit, price_unit, rule, default_qty, gst %)
SP, PR, SV, PS = 'Spec Purpose', 'Procurement', 'Service', 'Procurement cum Service'
BASIC_COMPONENTS = {
    'Doors': (SP, None, 'nos', 'per door', 'doors', 0, 18),
    'Drawers': (SP, None, 'nos', 'per drawer', 'drawers', 0, 18),
    'Shelves': (SP, None, 'nos', 'per shelf', 'shelves', 0, 18),
    'Core Material(18mm BWP Ply)': (PR, 'Core Material(18mm BWP Ply)', 'sft', 'per sft', 'carcass_ply', 0, 18),
    'Core Material(16mm BWP Ply)': (PR, 'Core Material(16mm BWP Ply)', 'sft', 'per sft', 'carcass_ply', 0, 18),
    'Core Material(16mm BWP B Board)': (PR, 'Core Material(16mm BWP B Board)', 'sft', 'per sft', 'back_panel_ply', 0, 18),
    'Core Material(12mm BWP Ply)': (PR, 'Core Material(12mm BWP Ply)', 'sft', 'per sft', 'drawer_box_ply', 0, 18),
    'Core Material(12mm Flex Ply)': (PR, 'Core Material(12mm Flex Ply)', 'sft', 'per sft', 'manual', 0, 18),  # rule "TBD"
    'Glass Shelves': (PS, None, 'sft', 'per sft', 'glass_shelves', 0, 18),
    'Box Hinges': (PR, 'Box Hinges', 'sets', 'per set', 'hinges', 0, 18),
    'Draw Channels': (PR, 'Draw Channels', 'sets', 'per set', 'drawer_channels', 0, 18),
    'Quadro Channels': (PR, 'Quadro Channels', 'sets', 'per set', 'drawer_channels', 0, 18),
    'Handles/Knobs': (PR, 'Handles/Knobs', 'nos', 'per no', 'handles', 0, 18),
    'Knobs': (PR, 'Handles/Knobs', 'nos', 'per no', 'knobs', 0, 18),
    'Draw Locks': (PR, 'Draw Locks', 'nos', 'per no', 'drawer_locks', 0, 18),
    'Hanger Pipe': (PR, 'Accessories', 'nos', 'per no', 'fixed', 1, 18),            # rule ambiguous
    'Hanger Pipe Brackets': (PR, 'Accessories', 'sets', 'per set', 'fixed', 2, 18),
    'Tandem Baskets': (PR, 'Kitchen Accessories', 'nos', 'per no', 'fixed', 3, 18),  # Sheet1: 3 nos
    'Extra Gallery': (PR, 'Kitchen Accessories', 'nos', 'per no', 'fixed', 3, 18),
    'Cutlery Tray': (PR, 'Kitchen Accessories', 'nos', 'per no', 'fixed', 1, 18),
    'Thali Organizer': (PR, 'Kitchen Accessories', 'nos', 'per no', 'fixed', 1, 18),
    'Bottle Pull-out': (PR, 'Kitchen Accessories', 'nos', 'per no', 'fixed', 1, 18),  # no price in sheet
    'Inner Liner(Fabric)': (PR, 'Inner Liner(Fabric)', 'sft', 'per sft', 'inner_liner', 0, 18),
    'Finishing - Laminate': (PR, 'Finishing - Laminate', 'sft', 'per sft', 'finish_sheets', 0, 18),
    'Finishing - Acrylic': (PR, 'Finishing - Acrylic', 'sft', 'per sft', 'finish_sheets', 0, 18),
    'Finishing - Veneer': (PR, 'Finishing - Veneer', 'sft', 'per sft', 'finish_sheets', 0, 18),
    'Profile Doors': (PR, 'Profile Doors', 'sft', 'per sft', 'profile_doors', 0, 18),
    'Edge Banding': (PR, 'Edge Banding', 'Mtr', 'per mtr', 'edge_banding', 0, 18),
    'Adhesive(Bonding)': (PR, 'Adhesive(Bonding)', 'kg', 'per kg', 'adhesive_bonding', 0, 18),
    'Adhesive(Support)': (PR, 'Adhesive(Support)', 'nos', 'per roll', 'adhesive_support', 0, 18),
    'Nails and Screws': (PR, 'Nails and Screws', 'nos', 'per box', 'fixed', 1, 18),
    'Unit Top': (PR, 'Unit Top', 'sft', 'per sft', 'unit_top', 0, 18),
    'Counter Top Fixing': (SV, 'Counter Top Fixing', 'slab', 'per slab', 'fixed', 1, 0),  # sheet: per slab
    'Dado Tiles': (PR, 'Dado Tiles', 'sft', 'per sft', 'dado_tiles', 0, 18),
    'Dado Tiles Fixing': (SV, 'Dado Tiles Fixing', 'sft', 'per sft', 'dado_tiles', 0, 0),
    'Profile Channel': (PR, 'Profile Channel', 'Mtr', 'per mtr', 'manual', 0, 18),
    'Lights': (PR, 'Lights', 'Mtr', 'per mtr', 'manual', 0, 18),                  # "default to be decided"
    'Drivers': (PR, 'Drivers', 'nos', 'per no', 'manual', 0, 18),
    'Sink & Tap': (PR, 'Sink & Tap', 'nos', 'per no', 'fixed', 1, 18),
    'Electrical Work': (SV, 'Electrical Work', 'nos', 'per point', 'manual', 0, 0),
    'Carpentry': (SV, 'Carpentry', 'sft', 'per sft', 'carpentry', 0, 0),
    'Premium Emulsion': (PS, 'Premium Emulsion', 'sft', 'per sft', 'manual', 0, 18),
    'Design & Concept': (SV, 'Design & Concept', 'sft', 'per sft', 'manual', 0, 18),
    'Transport & Handling': (SV, 'Transport & Handling', 'nos', 'per no', 'fixed', 1, 0),
    'Debris Management': (SV, 'Debris Management', 'nos', 'per no', 'fixed', 1, 0),
    'Deep Cleaning': (SV, 'Deep Cleaning', 'nos', 'per no', 'fixed', 1, 0),
}

# ── Furniture ─────────────────────────────────────────────────────
# Component entry: 'Basic Component'  or  ('Basic Component', {default material model,
#                  fixed qty, application})
def C(name, model=None, qty=None, application=''):
    return (name, {'model': model, 'fixed_qty': qty, 'application': application})


CABINET_CORE = ['Doors', 'Drawers', 'Shelves']
CONSUMABLES = [C('Adhesive(Bonding)', 'Hi - Per'), 'Adhesive(Support)', 'Nails and Screws']

FURNITURE = [
    # (name, cabinet_type, rooms, (W, H, D), components, assumed?)
    ('Wardrobe with Openable Shutters', 'wardrobe_openable',
     ['Master Bedroom', 'Bedroom 2', 'Bedroom 3', 'Kids Room', 'Guest Bedroom'],
     ("7'0\"", "9'6\"", "2'0\""),
     CABINET_CORE + [
         'Core Material(16mm BWP Ply)', 'Core Material(16mm BWP B Board)', 'Core Material(12mm BWP Ply)',
         C('Draw Channels', '20" Telescopic Soft Close'), C('Box Hinges', '0 Crank'),
         'Inner Liner(Fabric)', 'Edge Banding', C('Finishing - Laminate', 'Standard Laminate (selection)'),
         *CONSUMABLES, C('Carpentry', 'Box — wardrobe'),
         C('Handles/Knobs', '1 Ft Handles'), C('Knobs', 'Knobs'), 'Draw Locks',
         C('Hanger Pipe', 'Hanger Pipe - NWHP004'), C('Hanger Pipe Brackets', 'Brackets for Hanger Pipe'),
     ], False),
    ('Wardrobe with Sliding Shutters', 'wardrobe_sliding',
     ['Master Bedroom', 'Bedroom 2', 'Bedroom 3', 'Kids Room', 'Guest Bedroom'],
     ("8'0\"", "9'6\"", "2'0\""),
     CABINET_CORE + [
         'Core Material(16mm BWP Ply)', 'Core Material(16mm BWP B Board)', 'Core Material(12mm BWP Ply)',
         C('Draw Channels', '20" Telescopic Soft Close'),
         'Inner Liner(Fabric)', 'Edge Banding', C('Finishing - Laminate', 'Standard Laminate (selection)'),
         *CONSUMABLES, C('Carpentry', 'Box — wardrobe'),
         C('Handles/Knobs', '1 Ft Handles'), C('Knobs', 'Knobs'), 'Draw Locks',
         C('Hanger Pipe', 'Hanger Pipe - NWHP004'), C('Hanger Pipe Brackets', 'Brackets for Hanger Pipe'),
     ], True),
    ('TV Base Unit', 'tv_unit', ['Living Room', 'Drawing Room', 'Master Bedroom'],
     ("5'6\"", "1'3\"", "1'4\""),
     ['Doors', 'Drawers',
      'Core Material(18mm BWP Ply)', 'Core Material(12mm BWP Ply)',
      C('Draw Channels', '12" Soft Close Channels'), 'Inner Liner(Fabric)',
      C('Finishing - Laminate', 'Wild Pear 403 - SU'), *CONSUMABLES, C('Carpentry', 'Box — base units')],
     False),
    ('Crockery Unit', 'crockery_base', ['Dining Room', 'Kitchen'],
     ("6'0\"", "5'0\"", "1'3\""),
     CABINET_CORE + [
         'Core Material(18mm BWP Ply)', 'Core Material(12mm BWP Ply)',
         C('Core Material(12mm Flex Ply)', qty=32),
         C('Box Hinges', '0 Crank'), 'Quadro Channels', 'Inner Liner(Fabric)',
         'Finishing - Acrylic', C('Finishing - Laminate', 'Standard Laminate (selection)'),
         *CONSUMABLES, 'Profile Doors', C('Carpentry', 'Box — base units'),
         C('Unit Top', 'Same as Kitchen (selection)'), C('Counter Top Fixing', 'Quartz Fixing', qty=0.25),
         C('Handles/Knobs', 'Handle (selection)'),
     ], False),
    ('Kitchen — L-type Base & Loft', 'kitchen_base', ['Kitchen'],
     ("9'10\"", "8'11\"", "2'0\""),
     ['Doors', 'Shelves',
      'Core Material(18mm BWP Ply)', 'Core Material(12mm BWP Ply)', C('Box Hinges', '0 Crank'),
      'Inner Liner(Fabric)', C('Finishing - Laminate', 'APM - 107 Thermal Laminate'),
      C('Adhesive(Bonding)', 'Hi - Per'), 'Adhesive(Support)', C('Nails and Screws', qty=2),
      C('Carpentry', 'Box — kitchen'), C('Profile Doors', '25mm Profile Doors'),
      C('Tandem Baskets', '150mm x 500mm Tandem Basket'), C('Extra Gallery', '150mm x 500mm Extra Gallery'),
      C('Cutlery Tray', 'Cutlery Tray'), C('Thali Organizer', 'Thali Organizer'), 'Bottle Pull-out',
      C('Unit Top', '20mm Quartz'), C('Counter Top Fixing', '20mm Fixing', qty=1),
      C('Handles/Knobs', 'Gola Profile 18mm', qty=2), 'Dado Tiles', 'Dado Tiles Fixing',
      C('Profile Channel', qty=4), C('Lights', qty=4), C('Drivers', qty=2), 'Sink & Tap',
      C('Electrical Work', qty=2)],
     False),
    # ── Cabinet types from Sheet1 without a worked example (ASSUMED) ──
    ('Kitchen Wall Unit', 'kitchen_wall', ['Kitchen'], ("6'0\"", "2'6\"", "1'2\""),
     ['Doors', 'Shelves', 'Core Material(18mm BWP Ply)', C('Box Hinges', '0 Crank'), 'Inner Liner(Fabric)',
      C('Finishing - Laminate', 'APM - 107 Thermal Laminate'), *CONSUMABLES, C('Carpentry', 'Box — kitchen'),
      C('Handles/Knobs', 'Handle (selection)')], True),
    ('Crockery Wall Unit', 'crockery_wall', ['Dining Room', 'Kitchen'], ("4'0\"", "3'0\"", "1'0\""),
     ['Doors', 'Shelves', 'Core Material(18mm BWP Ply)', C('Box Hinges', '0 Crank'), 'Inner Liner(Fabric)',
      C('Finishing - Laminate', 'Standard Laminate (selection)'), *CONSUMABLES,
      C('Carpentry', 'Box — base units'), C('Handles/Knobs', 'Handle (selection)')], True),
    ('Loft (Full Box)', 'loft_box', ['Master Bedroom', 'Bedroom 2', 'Bedroom 3', 'Kids Room', 'Guest Bedroom', 'Kitchen'],
     ("7'0\"", "2'0\"", "2'0\""),
     ['Doors', 'Core Material(16mm BWP Ply)', 'Core Material(16mm BWP B Board)', C('Box Hinges', '0 Crank'),
      'Inner Liner(Fabric)', C('Finishing - Laminate', 'Standard Laminate (selection)'), *CONSUMABLES,
      C('Carpentry', 'Box — wardrobe'), C('Handles/Knobs', 'Handle (selection)')], True),
    ('Pooja Unit', 'pooja', ['Pooja Room', 'Living Room'], ("4'0\"", "5'0\"", "1'6\""),
     CABINET_CORE + ['Core Material(18mm BWP Ply)', 'Core Material(12mm BWP Ply)', C('Box Hinges', '0 Crank'),
                     C('Draw Channels', '12" Soft Close Channels'), 'Inner Liner(Fabric)',
                     C('Finishing - Laminate', 'Standard Laminate (selection)'), *CONSUMABLES,
                     C('Carpentry', 'Box — base units'), C('Handles/Knobs', 'Handle (selection)')], True),
    ('Study Table', 'study', ['Bedroom 2', 'Bedroom 3', 'Kids Room', 'Home Office'], ("4'0\"", "2'6\"", "2'0\""),
     ['Drawers', 'Core Material(18mm BWP Ply)', 'Core Material(12mm BWP Ply)',
      C('Draw Channels', '12" Soft Close Channels'), 'Inner Liner(Fabric)',
      C('Finishing - Laminate', 'Standard Laminate (selection)'), *CONSUMABLES,
      C('Carpentry', 'Box — base units'), C('Knobs', 'Knobs')], True),
    ('Shoe Rack', 'shoe_rack', ['Entrance'], ("3'0\"", "3'6\"", "1'2\""),
     ['Doors', 'Shelves', 'Core Material(18mm BWP Ply)', C('Box Hinges', '0 Crank'), 'Inner Liner(Fabric)',
      C('Finishing - Laminate', 'Standard Laminate (selection)'), *CONSUMABLES,
      C('Carpentry', 'Box — base units'), C('Handles/Knobs', 'Handle (selection)')], True),
    # ── Whole-project lines (no cabinet rules) ──
    ('Design & Concept', 'panel', [], ('', '', ''), [C('Design & Concept', '2D and 3D Renders')], False),
    ('Painting — Premium Emulsion', 'panel', [], ('', '', ''), ['Premium Emulsion'], False),
    ('Transport & Handling', 'panel', [], ('', '', ''), ['Transport & Handling'], False),
    ('Debris Management', 'panel', [], ('', '', ''), ['Debris Management'], False),
    ('Deep Cleaning', 'panel', [], ('', '', ''), ['Deep Cleaning'], False),
]
