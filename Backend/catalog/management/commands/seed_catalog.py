"""
Seed the catalogue from Sriniketh's calculation workbook (catalog/sheet_data.py):

    Rooms & Zones
    Raw Material Library  — category → brand → model + rate (the sheet's prices)
    Basic Components      — one per estimate row type, each with its quantity rule
    Furniture             — finished products and the components they're estimated from

    python manage.py seed_catalog
    python manage.py seed_catalog --reset     # clear catalogue furniture/components first

Idempotent: re-running updates prices, rules and component lists in place.
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import BasicComponent, Furniture, FurnitureComponent, Room, Zone
from catalog.sheet_data import BASIC_COMPONENTS, FURNITURE, RAW_MATERIALS
from library.models import MaterialBrand, MaterialCategory, MaterialItem

ROOMS = [
    ('Master Bedroom', '🛏️'), ('Kitchen', '🍳'), ('Bedroom 2', '🛏️'), ('Bedroom 3', '🛏️'),
    ('Living Room', '🛋️'), ('Drawing Room', '🛋️'), ('Kids Room', '🧒'), ('Guest Bedroom', '🛏️'),
    ('Pooja Room', '🕉️'), ('Home Office', '💼'), ('Entrance', '🚪'), ('Bathroom', '🚿'),
    ('Dining Room', '🍽️'),
]

ZONES = ['East Wall', 'West Wall', 'North Wall', 'South Wall', 'Ceiling', 'Floor',
         'Island', 'Walk-in Closet', 'Balcony', 'Window Side', 'Entry Side']

ASSUMED_NOTE = 'Component list assumed (no worked example in the calculation sheet) — confirm with Sriniketh.'


class Command(BaseCommand):
    help = "Seed rooms, raw materials, basic components and furniture from the calculation sheet."

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true',
                            help='Delete existing furniture and basic components first.')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['reset']:
            FurnitureComponent.objects.all().delete()
            Furniture.objects.all().delete()
            BasicComponent.objects.all().delete()
            self.stdout.write(self.style.WARNING('Cleared furniture and basic components.'))

        rooms = {}
        for order, (name, icon) in enumerate(ROOMS, start=1):
            rooms[name], _ = Room.objects.get_or_create(
                name=name, defaults={'icon': icon, 'sort_order': order})
        for order, name in enumerate(ZONES, start=1):
            Zone.objects.get_or_create(name=name, defaults={'sort_order': order})

        # ── Raw materials ──
        categories, items = {}, {}
        for order, (cat_name, (spec_type, group, rows)) in enumerate(RAW_MATERIALS.items(), start=1):
            category, _ = MaterialCategory.objects.update_or_create(
                name=cat_name,
                defaults={'type': spec_type, 'product_group': group, 'sort_order': order, 'is_active': True},
            )
            categories[cat_name] = category
            for brand_name, model, unit, rate in rows:
                brand = None
                if brand_name:
                    brand, _ = MaterialBrand.objects.get_or_create(category=category, name=brand_name)
                item, _ = MaterialItem.objects.update_or_create(
                    category=category, brand=brand, model_name=model,
                    defaults={'default_unit': unit, 'default_rate': Decimal(str(rate)), 'is_active': True},
                )
                items[(cat_name, model)] = item

        # ── Basic components ──
        components = {}
        for order, (name, spec) in enumerate(BASIC_COMPONENTS.items(), start=1):
            item_type, cat_name, unit, price_unit, rule, default_qty, gst = spec
            components[name], _ = BasicComponent.objects.update_or_create(
                name=name,
                defaults={
                    'item_type': item_type, 'library_category': categories.get(cat_name),
                    'unit': unit, 'price_unit': price_unit, 'quantity_rule': rule,
                    'default_qty': Decimal(str(default_qty)), 'gst_pct': Decimal(str(gst)),
                    'sort_order': order, 'is_active': True,
                },
            )

        # ── Furniture ──
        for order, (name, cabinet_type, room_names, (w, h, d), parts, assumed) in enumerate(FURNITURE, start=1):
            furniture, _ = Furniture.objects.update_or_create(
                name=name,
                defaults={
                    'cabinet_type': cabinet_type, 'default_length': w, 'default_height': h,
                    'default_breadth': d, 'margin_pct': Decimal('15'), 'sort_order': order,
                    'description': ASSUMED_NOTE if assumed else '', 'is_active': True,
                },
            )
            furniture.rooms.set([rooms[r] for r in room_names if r in rooms])
            furniture.components.all().delete()
            for c_order, part in enumerate(parts, start=1):
                bc_name, extra = (part, {}) if isinstance(part, str) else part
                bc = components[bc_name]
                category = bc.library_category.name if bc.library_category_id else None
                default_material = items.get((category, extra.get('model'))) if extra.get('model') else None
                FurnitureComponent.objects.create(
                    furniture=furniture, basic_component=bc, default_material=default_material,
                    fixed_qty=None if extra.get('fixed_qty') is None else Decimal(str(extra['fixed_qty'])),
                    application=extra.get('application', ''), sort_order=c_order,
                )

        self.stdout.write(self.style.SUCCESS(
            f'Rooms: {Room.objects.count()} | Zones: {Zone.objects.count()} | '
            f'Raw material categories: {len(categories)} ({len(items)} models) | '
            f'Basic components: {len(components)} | Furniture: {len(FURNITURE)} '
            f'({FurnitureComponent.objects.count()} component links)'
        ))
