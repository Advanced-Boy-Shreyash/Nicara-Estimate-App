"""
Seed the Items catalogue from the rows currently shown in Initial Estimate.

    python manage.py seed_items          # add missing, leave existing alone
    python manage.py seed_items --reset  # wipe the catalogue first

Every entry mirrors a line from the Sharma Residence / Kapoor Villa initial
estimates in the frontend, keeping the same description, dimensions, unit and
rate so the catalogue lines up with what designers already see.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from items.models import Item, ItemCategory

CATEGORIES = [
    ('Carpentry', '🪚', 'Wardrobes, storage, panelling and loose carpentry', 1),
    ('Modular Kitchen', '🍳', 'Base, wall, tall units and kitchen accessories', 2),
    ('False Ceiling', '🏛️', 'Gypsum, POP and wooden ceiling work', 3),
    ('Furniture', '🛋️', 'Beds, consoles, seating and statement pieces', 4),
    ('Specialty', '🕉️', 'Pooja units, bars, home office and bespoke work', 5),
]

# name, category, room, unit, calc_method, L, B, H, qty, rate, min, max, description
ITEMS = [
    # ── Carpentry ─────────────────────────────────────────────────────────
    ('Wardrobe 8\'x2\'x8\'', 'Carpentry', 'Master Bedroom', 'unit', 'per_unit',
     "8'0\"", "2'0\"", "8'0\"", 1, 145000, 120000, 180000,
     '16mm BWP ply with laminate finish, mirror on one shutter'),
    ('Wardrobe 6\'x2\'x8\'', 'Carpentry', 'Kids Room', 'unit', 'per_unit',
     "6'0\"", "2'0\"", "8'0\"", 1, 115000, 95000, 140000,
     '16mm BWP ply with pastel laminate finish'),
    ('Walk-in Wardrobe', 'Carpentry', 'Master Bedroom Suite', 'unit', 'per_unit',
     "10'0\"", "6'0\"", "9'0\"", 1, 485000, 400000, 600000,
     'BWP ply, Italian walnut veneer, brass handles, LED strips'),
    ('Study Table + Bookshelf', 'Carpentry', 'Master Bedroom', 'unit', 'per_unit',
     "4'0\"", "1'6\"", "2'6\"", 1, 42000, 32000, 55000,
     '16mm BWP ply with veneer finish'),
    ('Study Table + Pinboard', 'Carpentry', 'Kids Room', 'unit', 'per_unit',
     "3'6\"", "1'6\"", "2'6\"", 1, 35000, 28000, 45000,
     '16mm BWP ply with laminate + soft-board panel'),
    ('TV Unit Wall Panel', 'Carpentry', 'Master Bedroom', 'unit', 'per_unit',
     "6'0\"", "1'3\"", "4'0\"", 1, 68000, 55000, 85000,
     'Wall mounted panel with back-lit groove'),
    ('TV Unit Console', 'Carpentry', 'Drawing Room', 'unit', 'per_unit',
     "8'0\"", "1'3\"", "1'0\"", 1, 88000, 70000, 110000,
     'Walnut veneer with concealed cable management'),
    ('Entertainment Wall', 'Carpentry', 'Living Room', 'unit', 'per_unit',
     "16'0\"", "1'6\"", "10'0\"", 1, 420000, 350000, 520000,
     'Veneer + Italian stone cladding, 85" TV recess'),
    ('Shoe Rack Cabinet', 'Carpentry', 'Drawing Room', 'unit', 'per_unit',
     "3'0\"", "1'0\"", "4'0\"", 1, 28000, 22000, 38000,
     '16mm ply with laminate, ventilated design'),
    ('Wardrobe + TV Unit', 'Carpentry', 'Guest Bedroom', 'unit', 'per_unit',
     "8'0\"", "2'0\"", "9'0\"", 1, 140000, 115000, 175000,
     'BWP ply, elegant laminate finish'),
    ('Wardrobe + Study Combo', 'Carpentry', 'Kids Room 2', 'unit', 'per_unit',
     "8'0\"", "2'0\"", "9'0\"", 1, 155000, 125000, 190000,
     'BWP ply, pastel laminate with open shelves'),
    ('Loft Storage', 'Carpentry', 'Kitchen', 'rft', 'running_length',
     "10'0\"", "1'6\"", "1'6\"", 10, 2200, 1800, 2800,
     'Storage loft above cabinets, laminate finish'),

    # ── Modular Kitchen ───────────────────────────────────────────────────
    ('Base Cabinets L-shape', 'Modular Kitchen', 'Kitchen', 'unit', 'per_unit',
     "10'0\"", "2'0\"", "2'10\"", 1, 225000, 180000, 280000,
     'BWR ply with acrylic shutters, soft-close hinges, granite top'),
    ('Wall Cabinets', 'Modular Kitchen', 'Kitchen', 'unit', 'per_unit',
     "10'0\"", "1'0\"", "2'6\"", 1, 135000, 110000, 170000,
     'BWR ply with acrylic + glass shutters'),
    ('Tall Unit with Baskets', 'Modular Kitchen', 'Kitchen', 'unit', 'per_unit',
     "2'6\"", "2'0\"", "7'0\"", 1, 85000, 68000, 105000,
     'BWR ply with pull-out wire baskets'),
    ('Island Kitchen Complete', 'Modular Kitchen', 'Kitchen', 'unit', 'per_unit',
     "14'0\"", "10'0\"", "3'0\"", 1, 680000, 550000, 850000,
     'PU paint, quartz waterfall edge, Hafele fittings'),
    ('Wall + Tall Units', 'Modular Kitchen', 'Kitchen', 'unit', 'per_unit',
     "14'0\"", "1'0\"", "4'0\"", 1, 310000, 250000, 380000,
     'PU paint, handle-less push-to-open, SS internals'),

    # ── False Ceiling ─────────────────────────────────────────────────────
    ('False Ceiling — Gypsum', 'False Ceiling', 'Master Bedroom', 'sft', 'area_lb',
     "14'0\"", "12'0\"", '-', 168, 165, 140, 200,
     'Gypsum false ceiling with cove LED lighting'),
    ('False Ceiling — Peripheral + Centre', 'False Ceiling', 'Drawing Room', 'sft', 'area_lb',
     "18'0\"", "14'0\"", '-', 252, 175, 150, 220,
     'Gypsum peripheral + centre piece with down-lights'),
    ('False Ceiling — Layered with Beams', 'False Ceiling', 'Living Room', 'sft', 'area_lb',
     "24'0\"", "18'0\"", '-', 432, 250, 200, 320,
     'Gypsum layered + teak wood beams, cove lighting'),

    # ── Furniture ─────────────────────────────────────────────────────────
    ('Bed Back Panel', 'Furniture', 'Master Bedroom Suite', 'unit', 'per_unit',
     "12'0\"", "0'6\"", "10'0\"", 1, 165000, 130000, 210000,
     'Veneer + Italian leather upholstery'),
    ('Dressing Table + LED Mirror', 'Furniture', 'Guest Bedroom', 'unit', 'per_unit',
     "3'0\"", "1'6\"", "5'0\"", 1, 45000, 35000, 58000,
     'Veneer finish with integrated LED back-lit mirror'),
    ('Dressing Room', 'Furniture', 'Master Bedroom Suite', 'unit', 'per_unit',
     "8'0\"", "4'0\"", "9'0\"", 1, 210000, 170000, 260000,
     'Full vanity with backlit mirror, veneer finish'),
    ('Custom Bunk + Wardrobe', 'Furniture', 'Kids Room 1', 'unit', 'per_unit',
     "8'0\"", "4'0\"", "9'0\"", 1, 195000, 160000, 240000,
     'BWP ply with colourful laminate, storage steps'),
    ('Foyer Console + Mirror', 'Furniture', 'Entrance', 'unit', 'per_unit',
     "5'0\"", "1'6\"", "3'0\"", 1, 95000, 75000, 120000,
     'Veneer with brass inlay, oval mirror with brass frame'),

    # ── Specialty ─────────────────────────────────────────────────────────
    ('Bar Unit', 'Specialty', 'Living Room', 'unit', 'per_unit',
     "6'0\"", "2'0\"", "3'6\"", 1, 185000, 150000, 230000,
     'Walnut veneer, wine rack, LED lighting, granite top'),
    ('Office Setup', 'Specialty', 'Home Office', 'unit', 'per_unit',
     "12'0\"", "10'0\"", "9'0\"", 1, 320000, 260000, 400000,
     'L-desk + floor-to-ceiling library + visitor seating nook'),
    ('Custom Pooja Unit', 'Specialty', 'Pooja Room', 'unit', 'per_unit',
     "4'0\"", "2'0\"", "7'0\"", 1, 175000, 140000, 220000,
     'Solid teak wood, traditional carving, brass bell'),
]


class Command(BaseCommand):
    help = 'Seed the Items catalogue with the standard estimate line items.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true',
                            help='Delete existing catalogue items before seeding.')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['reset']:
            deleted, _ = Item.objects.all().delete()
            ItemCategory.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Cleared {deleted} existing catalogue rows.'))

        categories = {}
        for name, icon, description, order in CATEGORIES:
            category, _ = ItemCategory.objects.get_or_create(
                name=name,
                defaults={'icon': icon, 'description': description, 'sort_order': order},
            )
            categories[name] = category

        created = updated = 0
        for order, row in enumerate(ITEMS, start=1):
            (name, category_name, room, unit, calc_method,
             length, breadth, height, qty, rate, min_rate, max_rate, description) = row

            item, was_created = Item.objects.get_or_create(
                name=name,
                category=categories[category_name],
                defaults={
                    'description': description,
                    'default_room': room,
                    'unit': unit,
                    'calc_method': calc_method,
                    'default_length': length,
                    'default_breadth': breadth,
                    'default_height': height,
                    'default_qty': qty,
                    'default_rate': rate,
                    'min_rate': min_rate,
                    'max_rate': max_rate,
                    'sort_order': order,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(self.style.SUCCESS(
            f'Categories: {len(categories)} | Items created: {created}, already present: {updated}'
        ))
