"""
Seed the furniture catalogue from the shared "Detailed Components" sheet,
plus enough sensible defaults to make the drill-down demo-ready.

    python manage.py seed_catalog
    python manage.py seed_catalog --reset
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import (
    Furniture, FurniturePart, Material, MaterialOption, PartMaterial, Room, Zone,
)

# ── From the sheet ──────────────────────────────────────────

ROOMS = [
    ('Master Bedroom', '🛏️'), ('Kitchen', '🍳'),
    ('Bedroom 2', '🛏️'), ('Bedroom 3', '🛏️'),
    ('Living Room', '🛋️'), ('Bathroom', '🚿'),
]

ZONES = ['East Wall', 'West Wall', 'North Wall', 'South Wall',
         'Ceiling', 'Floor', 'Island', 'Walk-in Closet', 'Balcony']

# material → default unit → [ (detail, brand, model, size, price, unit) ]
MATERIALS = {
    'Plywood': ('sft', [
        ('18mm Plywood', 'Austin', 'Lincoln', '8x4', 100, 'sft'),
        ('16mm Plywood', 'Austin', 'Lincoln', '8x4', 90, 'sft'),
        ('8mm Plywood', 'Austin', 'Lincoln', '8x4', 60, 'sft'),
        ('18mm Plywood', 'Austin', 'Gold', '8x4', 120, 'sft'),
        ('8mm Plywood', 'Austin', 'Gold', '8x4', 80, 'sft'),
    ]),
    'Hardware': ('nos', [
        ('Hinge', 'Hettich', 'Onsys', '0 crank', 45, 'nos'),
        ('Hinge', 'Hettich', 'Sensys', '8 crank', 120, 'nos'),
    ]),
    'Adhesive': ('litre', [
        ('Fevicol SH', 'Pidilite', 'SH', '5 kg', 550, 'nos'),
    ]),
    'Laminate': ('nos', [
        ('1mm Laminate', 'Greenlam', 'Suede', '8x4', 1450, 'nos'),
    ]),
    'Acrylic': ('nos', [
        ('Acrylic Sheet', 'Merino', 'Hi-Gloss', '8x4', 3200, 'nos'),
    ]),
    'Veneer': ('sft', [
        ('Natural Veneer', 'Century', 'Teak', '8x4', 180, 'sft'),
    ]),
    'Wallpaper': ('sft', [
        ('Textured Wallpaper', 'Nilaya', 'Classic', 'roll', 65, 'sft'),
    ]),
    'Paint': ('sft', [
        ('Emulsion', 'Asian Paints', 'Royale', '—', 22, 'sft'),
    ]),
    'Light': ('nos', [
        ('Profile Light', 'Philips', 'Cove', '1m', 320, 'nos'),
    ]),
}

# furniture → rooms (empty = every room) → parts → [ (material, qty, unit, wastage) ]
FURNITURE = [
    ('Wardrobe', ['Master Bedroom', 'Bedroom 2', 'Bedroom 3'], 'nos', {
        'Cabinet': [('Plywood', 32, 'sft', 8), ('Hardware', 12, 'nos', 0), ('Adhesive', 1, 'litre', 0)],
        'Shutter': [('Plywood', 16, 'sft', 8), ('Laminate', 4, 'nos', 5)],
        'Ledge': [('Plywood', 6, 'sft', 8)],
    }),
    ('TV Unit', ['Master Bedroom', 'Living Room'], 'nos', {
        'Cabinet': [('Plywood', 18, 'sft', 8), ('Hardware', 6, 'nos', 0)],
        'Panel': [('Plywood', 12, 'sft', 8), ('Veneer', 12, 'sft', 5)],
    }),
    ('Study Table', ['Bedroom 2', 'Bedroom 3'], 'nos', {
        'Cabinet': [('Plywood', 14, 'sft', 8), ('Hardware', 4, 'nos', 0)],
    }),
    ('Wall Décor', [], 'nos', {
        'Wallpaper': [('Wallpaper', 40, 'sft', 10)],
    }),
    ('Wall Panels', ['Living Room'], 'nos', {
        'Panel': [('Plywood', 24, 'sft', 8), ('Veneer', 24, 'sft', 5)],
    }),
    ('Kitchen Base Unit', ['Kitchen'], 'nos', {
        'Cabinet': [('Plywood', 40, 'sft', 8), ('Hardware', 18, 'nos', 0)],
        'Shutter': [('Plywood', 20, 'sft', 8), ('Acrylic', 6, 'nos', 5)],
    }),
    ('Kitchen Wall Unit', ['Kitchen'], 'nos', {
        'Cabinet': [('Plywood', 28, 'sft', 8), ('Hardware', 12, 'nos', 0)],
        'Shutter': [('Plywood', 14, 'sft', 8), ('Acrylic', 4, 'nos', 5)],
    }),
    ('Kitchen Loft', ['Kitchen'], 'nos', {
        'Cabinet': [('Plywood', 18, 'sft', 8), ('Laminate', 3, 'nos', 5)],
    }),
    ('Wardrobe Loft', ['Master Bedroom', 'Bedroom 2'], 'nos', {
        'Cabinet': [('Plywood', 14, 'sft', 8), ('Laminate', 2, 'nos', 5)],
    }),
    ('Paint', [], 'sft', {
        'Paint': [('Paint', 1, 'sft', 5)],
    }),
    ('Lights', [], 'nos', {
        'Light': [('Light', 1, 'nos', 0)],
    }),
    ('Bed', ['Master Bedroom', 'Bedroom 2', 'Bedroom 3'], 'nos', {
        'Frame': [('Plywood', 30, 'sft', 8), ('Veneer', 20, 'sft', 5)],
    }),
    ('Sofa', ['Living Room'], 'nos', {
        'Frame': [('Plywood', 22, 'sft', 8)],
    }),
]


class Command(BaseCommand):
    help = 'Seed the furniture catalogue from the shared components sheet.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['reset']:
            for model in (PartMaterial, FurniturePart, Furniture, MaterialOption,
                          Material, Zone, Room):
                model.objects.all().delete()
            self.stdout.write(self.style.WARNING('Cleared existing catalogue.'))

        rooms = {}
        for order, (name, icon) in enumerate(ROOMS, start=1):
            rooms[name], _ = Room.objects.get_or_create(
                name=name, defaults={'icon': icon, 'sort_order': order})

        for order, name in enumerate(ZONES, start=1):
            Zone.objects.get_or_create(name=name, defaults={'sort_order': order})

        materials = {}
        for order, (name, (unit, options)) in enumerate(MATERIALS.items(), start=1):
            material, _ = Material.objects.get_or_create(
                name=name, defaults={'default_unit': unit, 'sort_order': order})
            materials[name] = material
            for o_order, (detail, brand, model, size, price, o_unit) in enumerate(options, start=1):
                MaterialOption.objects.get_or_create(
                    material=material, detail=detail, brand=brand, model_no=model, size=size,
                    defaults={'price': Decimal(price), 'unit': o_unit, 'sort_order': o_order},
                )

        furniture_made = parts_made = links_made = 0
        for f_order, (name, room_names, unit, parts) in enumerate(FURNITURE, start=1):
            furniture, was_new = Furniture.objects.get_or_create(
                name=name, defaults={'default_unit': unit, 'sort_order': f_order})
            if was_new:
                furniture_made += 1
            if room_names:
                furniture.rooms.set([rooms[r] for r in room_names if r in rooms])

            for p_order, (part_name, mats) in enumerate(parts.items(), start=1):
                part, _ = FurniturePart.objects.get_or_create(
                    furniture=furniture, name=part_name, defaults={'sort_order': p_order})
                parts_made += 1
                for m_order, (mat_name, qty, m_unit, wastage) in enumerate(mats, start=1):
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

        self.stdout.write(self.style.SUCCESS(
            f'Rooms: {Room.objects.count()} | Zones: {Zone.objects.count()} | '
            f'Materials: {Material.objects.count()} '
            f'({MaterialOption.objects.count()} options) | '
            f'Furniture: {Furniture.objects.count()} | '
            f'Parts: {FurniturePart.objects.count()} | BOM lines: {PartMaterial.objects.count()}'
        ))
