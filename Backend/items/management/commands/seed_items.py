"""
Seed the Items catalogue — items that are a catalogue furniture link to it.

    python manage.py seed_items          # add missing, leave existing alone
    python manage.py seed_items --reset  # wipe the catalogue first

Each Item's `catalog_furniture` field is set to the matching Furniture record
created by `seed_catalog` (run that first). Adding a linked item to an estimate
adds the furniture's calculation-sheet rows (projects/generation.py), sized from
the item's default dimensions.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import Furniture
from items.models import Item, ItemCategory

CATEGORIES = [
    ('Carpentry', '🪚', 'Wardrobes, storage, panelling and loose carpentry', 1),
    ('Modular Kitchen', '🍳', 'Base, wall, tall units and kitchen accessories', 2),
    ('False Ceiling', '🏛️', 'Gypsum, POP and wooden ceiling work', 3),
    ('Furniture & Furnishing', '🛋️', 'Beds, consoles, seating, dressing and statement pieces', 4),
    ('Specialty', '🕉️', 'Pooja units, bars, home office and bespoke work', 5),
]

# (name, category, furniture_name, room, unit, calc_method,
#  L, B, H, qty, rate, min, max, description)
#
# `furniture_name` must match a Furniture.name from seed_catalog exactly.
# It drives the `catalog_furniture` link.

ITEMS = [
    # ── Carpentry ─────────────────────────────────────────────────────────
    ('Wardrobe', 'Carpentry', 'Wardrobe with Openable Shutters',
     'Master Bedroom', 'unit', 'per_unit',
     "6'0\"", "2'0\"", "8'0\"", 1, 95000, 75000, 150000,
     '16mm BWP ply, 2 doors, 2 drawers, 4 shelves, laminate finish'),

    ('Walk-in Wardrobe', 'Carpentry', 'Wardrobe with Openable Shutters',
     'Master Bedroom', 'unit', 'per_unit',
     "10'0\"", "6'0\"", "9'0\"", 1, 285000, 220000, 400000,
     'BWP ply, Italian walnut veneer, brass handles, LED strips'),

    ('Wardrobe Loft', 'Carpentry', 'Loft (Full Box)',
     'Master Bedroom', 'nos', 'per_unit',
     "6'0\"", "2'0\"", "1'6\"", 1, 18000, 12000, 28000,
     'Storage loft on top of wardrobe, laminate finish'),

    ('TV Unit', 'Carpentry', 'TV Base Unit',
     'Living Room', 'unit', 'per_unit',
     "6'0\"", "1'3\"", "4'0\"", 1, 65000, 50000, 95000,
     'Wall mounted panel with back-lit groove, veneer finish'),

    ('TV Unit Console', 'Carpentry', 'TV Base Unit',
     'Drawing Room', 'unit', 'per_unit',
     "8'0\"", "1'3\"", "1'0\"", 1, 72000, 55000, 100000,
     'Walnut veneer with concealed cable management'),

    ('Study Table', 'Carpentry', 'Study Table',
     'Kids Room', 'unit', 'per_unit',
     "4'0\"", "1'6\"", "2'6\"", 1, 35000, 25000, 50000,
     '16mm BWP ply with laminate finish, 1 drawer'),

    ('Study Table + Bookshelf', 'Carpentry', 'Study Table',
     'Master Bedroom', 'unit', 'per_unit',
     "4'0\"", "1'6\"", "2'6\"", 1, 42000, 32000, 55000,
     '16mm BWP ply with veneer finish and bookshelf above'),

    ('Shoe Rack Cabinet', 'Carpentry', 'Shoe Rack',
     'Drawing Room', 'unit', 'per_unit',
     "3'0\"", "1'0\"", "4'0\"", 1, 28000, 20000, 40000,
     '16mm ply with laminate, ventilated design, 4 shelves'),

    ('Wall Panels', 'Carpentry', 'Wall Panels',
     'Living Room', 'sft', 'area_lh',
     "8'0\"", "—", "8'0\"", 64, 320, 250, 450,
     'Decorative veneer wall panelling per sft'),

    ('Bookshelf', 'Carpentry', 'Bookshelf',
     'Home Office', 'unit', 'per_unit',
     "3'0\"", "1'0\"", "6'0\"", 1, 32000, 22000, 45000,
     'Open bookshelf with 5 shelves, laminate finish'),

    ('Crockery Unit', 'Carpentry', 'Crockery Unit',
     'Dining Room', 'unit', 'per_unit',
     "4'0\"", "1'6\"", "7'0\"", 1, 75000, 55000, 100000,
     'Display unit with glass doors, 2 drawers, 3 shelves'),

    # ── Modular Kitchen ───────────────────────────────────────────────────
    ('Kitchen Base Unit', 'Modular Kitchen', 'Kitchen — L-type Base & Loft',
     'Kitchen', 'unit', 'per_unit',
     "10'0\"", "2'0\"", "2'10\"", 1, 165000, 130000, 225000,
     'BWR ply with acrylic shutters, soft-close hinges, 4 doors, 2 drawers'),

    ('Kitchen Wall Unit', 'Modular Kitchen', 'Kitchen Wall Unit',
     'Kitchen', 'unit', 'per_unit',
     "10'0\"", "1'0\"", "2'6\"", 1, 105000, 80000, 145000,
     'BWR ply with acrylic shutters, 4 doors, 2 shelves'),

    ('Kitchen Tall Unit', 'Modular Kitchen', 'Kitchen Tall Unit',
     'Kitchen', 'unit', 'per_unit',
     "2'6\"", "2'0\"", "7'0\"", 1, 72000, 55000, 95000,
     'BWR ply with pull-out baskets, 2 doors, 5 shelves'),

    ('Kitchen Loft', 'Modular Kitchen', 'Loft (Full Box)',
     'Kitchen', 'nos', 'per_unit',
     "10'0\"", "1'6\"", "1'6\"", 1, 32000, 22000, 45000,
     'Storage above cabinets, laminate finish, 4 doors'),

    # ── False Ceiling ─────────────────────────────────────────────────────
    ('False Ceiling — Gypsum', 'False Ceiling', 'False Ceiling',
     'Master Bedroom', 'sft', 'area_lb',
     "14'0\"", "12'0\"", "—", 168, 165, 140, 200,
     'Gypsum false ceiling with cove LED lighting'),

    ('False Ceiling — Peripheral + Centre', 'False Ceiling', 'False Ceiling',
     'Drawing Room', 'sft', 'area_lb',
     "18'0\"", "14'0\"", "—", 252, 175, 150, 220,
     'Gypsum peripheral + centre piece with down-lights'),

    ('False Ceiling — Layered with Beams', 'False Ceiling', 'False Ceiling',
     'Living Room', 'sft', 'area_lb',
     "24'0\"", "18'0\"", "—", 432, 250, 200, 320,
     'Gypsum layered + teak wood beams, cove lighting'),

    # ── Furniture & Furnishing ────────────────────────────────────────────
    ('Dressing Table + LED Mirror', 'Furniture & Furnishing', 'Dressing Table',
     'Master Bedroom', 'unit', 'per_unit',
     "3'0\"", "1'6\"", "5'0\"", 1, 45000, 35000, 60000,
     'Veneer finish with integrated LED back-lit mirror, 2 drawers'),

    ('Bed Headboard', 'Furniture & Furnishing', 'Bed Headboard',
     'Master Bedroom', 'unit', 'per_unit',
     "5'0\"", "0'4\"", "4'0\"", 1, 42000, 30000, 60000,
     'Veneer finish headboard with side tables'),

    ('Console Table', 'Furniture & Furnishing', 'Console Table',
     'Entrance', 'unit', 'per_unit',
     "5'0\"", "1'6\"", "3'0\"", 1, 55000, 40000, 75000,
     'Veneer with brass inlay, 1 drawer, 1 shelf'),

    # ── Specialty ─────────────────────────────────────────────────────────
    ('Bar Unit', 'Specialty', 'Bar Unit',
     'Living Room', 'unit', 'per_unit',
     "6'0\"", "2'0\"", "3'6\"", 1, 95000, 75000, 135000,
     'Walnut veneer, wine rack, LED lighting, granite top, 1 drawer'),

    ('Pooja Unit', 'Specialty', 'Pooja Unit',
     'Pooja Room', 'unit', 'per_unit',
     "4'0\"", "2'0\"", "7'0\"", 1, 85000, 65000, 120000,
     'Teak veneer finish, 2 doors, 1 drawer, traditional design'),

    ('Office Desk', 'Specialty', 'Study Table',
     'Home Office', 'unit', 'per_unit',
     "5'0\"", "2'6\"", "2'6\"", 1, 52000, 38000, 70000,
     'L-desk with cable management, 1 drawer, laminate finish'),
]


class Command(BaseCommand):
    help = 'Seed the Items catalogue with furniture-linked estimate line items.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true',
                            help='Delete existing catalogue items before seeding.')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['reset']:
            deleted, _ = Item.objects.all().delete()
            ItemCategory.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Cleared {deleted} existing catalogue rows.'))

        # ── Categories ───────────────────────────────────────
        categories = {}
        for name, icon, description, order in CATEGORIES:
            category, _ = ItemCategory.objects.get_or_create(
                name=name,
                defaults={'icon': icon, 'description': description, 'sort_order': order},
            )
            categories[name] = category

        # ── Pre-load Furniture records for linking ───────────
        furniture_map = {f.name: f for f in Furniture.objects.all()}

        created = updated = linked = 0
        for order, row in enumerate(ITEMS, start=1):
            (name, category_name, furniture_name, room, unit, calc_method,
             length, breadth, height, qty, rate, min_rate, max_rate, description) = row

            catalog_furniture = furniture_map.get(furniture_name)

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
                    'catalog_furniture': catalog_furniture,
                },
            )
            if was_created:
                created += 1
                if catalog_furniture:
                    linked += 1
            else:
                # Update the furniture link on existing items too
                if catalog_furniture and item.catalog_furniture_id != catalog_furniture.pk:
                    item.catalog_furniture = catalog_furniture
                    item.save(update_fields=['catalog_furniture'])
                    linked += 1
                updated += 1

        self.stdout.write(self.style.SUCCESS(
            f'Categories: {len(categories)} | '
            f'Items created: {created}, already present: {updated} | '
            f'Furniture links: {linked}'
        ))
