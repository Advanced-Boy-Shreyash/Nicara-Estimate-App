import json
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from catalog.models import (
    BasicComponent, CabinetType, Furniture, FurnitureComponent, ItemType, Room, Zone,
)
from catalog.pricing import size_inches
from library.models import MaterialBrand, MaterialCategory, MaterialItem, ServiceItem
from projects.models import Estimate, EstimateItem, EstimateItemComponent, Project


FIXTURE_PATH = Path(__file__).resolve().parents[2] / 'fixtures' / 'initial_estimate_demo.json'
PROJECT_NAME = 'Initial Estimate Workbook Demo'
ITEM_TYPES = {
    'Spec Purpose': ItemType.SPEC_PURPOSE,
    'Service': ItemType.SERVICE,
    'Procurement': ItemType.PROCUREMENT,
    'Procurement cum Service': ItemType.PROCUREMENT_CUM_SERVICE,
}
TYPE_PRIORITY = {
    'Spec Purpose': 0,
    'Procurement cum Service': 1,
    'Procurement': 2,
    'Service': 3,
}


def decimal_value(value):
    return Decimal(str(value or '0'))


def product_group(name):
    normalized = name.casefold()
    if 'ply' in normalized or 'wood' in normalized:
        return MaterialCategory.ProductGroup.PLYWOOD
    if any(token in normalized for token in ('hinge', 'channel', 'handle', 'screw', 'hardware')):
        return MaterialCategory.ProductGroup.HARDWARE
    if any(token in normalized for token in ('kitchen', 'basket', 'cutlery')):
        return MaterialCategory.ProductGroup.KITCHEN_ACCESSORIES
    if any(token in normalized for token in ('laminate', 'veneer', 'paint', 'polish', 'finish')):
        return MaterialCategory.ProductGroup.FINISHING
    return MaterialCategory.ProductGroup.OTHER


def cabinet_type(name):
    normalized = name.casefold()
    if 'wardrobe' in normalized:
        return CabinetType.WARDROBE_OPENABLE
    if 'tv' in normalized:
        return CabinetType.TV_UNIT
    if 'kitchen' in normalized and any(token in normalized for token in ('base', 'wall', 'loft')):
        return CabinetType.KITCHEN_BASE
    if 'study' in normalized:
        return CabinetType.STUDY
    if 'shoe' in normalized:
        return CabinetType.SHOE_RACK
    if 'pooja' in normalized:
        return CabinetType.POOJA
    return CabinetType.PANEL


def dimension_parts(value):
    inches = size_inches(value, '', '')[0]
    feet = int(inches // 12)
    return feet, int(round(inches - feet * 12))


class Command(BaseCommand):
    help = 'Seed a workbook-backed demo project, furniture catalogue, and Initial Estimate.'

    @transaction.atomic
    def handle(self, *args, **options):
        try:
            data = json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))
        except FileNotFoundError as error:
            raise CommandError(f'Demo estimate fixture not found: {FIXTURE_PATH}') from error

        items = data.get('items')
        if not isinstance(items, list) or not items:
            raise CommandError('Demo estimate fixture does not contain any estimate items.')

        project, _ = Project.objects.get_or_create(
            name=PROJECT_NAME,
            defaults={
                'client_name': 'Workbook Demo Client',
                'stage': Project.Stage.DESIGN,
                'interior_style': 'Contemporary',
            },
        )
        estimate, _ = Estimate.objects.get_or_create(
            project=project,
            type=Estimate.EstimateType.INITIAL,
            version=1,
            defaults={'title': 'Initial Estimate from Workbook'},
        )

        category_types = {}
        for item_data in items:
            for component in item_data['components']:
                category_types.setdefault(component['basic_component'], set()).add(
                    component['category_type'],
                )
        category_types = {
            name: min(types, key=TYPE_PRIORITY.__getitem__)
            for name, types in category_types.items()
        }

        categories = {}
        for name, category_type in category_types.items():
            categories[name], _ = MaterialCategory.objects.get_or_create(
                name=name[:150],
                defaults={
                    'type': category_type,
                    'product_group': product_group(name),
                },
            )

        materials = {}
        furniture_models = {}
        imported_components = 0

        for item_data in items:
            room = None
            furniture = None
            if item_data.get('catalog_furniture'):
                room, _ = Room.objects.get_or_create(name=item_data['area'][:120])
                furniture, _ = Furniture.objects.get_or_create(
                    name=item_data['item'][:150],
                    defaults={
                        'cabinet_type': cabinet_type(item_data['item']),
                        'default_length': item_data['length'][:20],
                        'default_breadth': item_data['breadth'][:20],
                        'default_height': item_data['height'][:20],
                    },
                )
                furniture.rooms.add(room)
                furniture_models[furniture.pk] = furniture
                if item_data['zone']:
                    Zone.objects.get_or_create(
                        name=item_data['zone'][:120],
                    )

            estimate_item, _ = EstimateItem.objects.update_or_create(
                estimate=estimate,
                sno=item_data['sno'],
                defaults={
                    'area': item_data['area'][:100],
                    'zone': item_data['zone'][:100],
                    'category': item_data['category'][:100],
                    'subcategory': item_data['subcategory'][:100],
                    'item': item_data['item'][:200],
                    'description': item_data['description'],
                    'length': item_data['length'][:20],
                    'breadth': item_data['breadth'][:20],
                    'height': item_data['height'][:20],
                    'width_ft': dimension_parts(item_data['length'])[0],
                    'width_in': dimension_parts(item_data['length'])[1],
                    'height_ft': dimension_parts(item_data['height'])[0],
                    'height_in': dimension_parts(item_data['height'])[1],
                    'depth_ft': dimension_parts(item_data['breadth'])[0],
                    'depth_in': dimension_parts(item_data['breadth'])[1],
                    'item_type': item_data['category'] if item_data['category'] in ITEM_TYPES else '',
                    'specification': item_data['category'][:250],
                    'qty': decimal_value(item_data['qty']),
                    'unit': item_data['unit'][:20],
                    'rate': decimal_value(item_data['rate']),
                    'gst_pct': decimal_value(item_data['gst_pct']),
                    'finishing': item_data['finishing'][:100],
                    'margin_pct': Decimal('0'),
                },
            )

            component_numbers = []
            material_cost = Decimal('0')
            weighted_margin = Decimal('0')
            for component_index, component in enumerate(item_data['components'], start=1):
                basic_name = component['basic_component']
                category = categories[basic_name]
                component_type = component['category_type']
                item_type = ITEM_TYPES[category_types[basic_name]]
                basic_component, _ = BasicComponent.objects.get_or_create(
                    name=basic_name[:150],
                    defaults={
                        'item_type': item_type,
                        'library_category': category,
                        'unit': component['unit'][:20] or 'nos',
                        'price_unit': component['price_unit'][:30],
                        'default_qty': decimal_value(component['quantity']),
                        'fallback_rate': decimal_value(component['price']),
                        'gst_pct': decimal_value(component['gst_pct']),
                    },
                )

                library_item = None
                if component_type in ('Procurement', 'Procurement cum Service'):
                    brand = None
                    if component['brand']:
                        brand, _ = MaterialBrand.objects.get_or_create(
                            name=component['brand'][:100],
                        )
                    model_name = component['model'] or component['detail'] or basic_name
                    library_item, _ = MaterialItem.objects.get_or_create(
                        category=category,
                        brand=brand,
                        model_name=model_name[:200],
                        defaults={
                            'default_unit': component['price_unit'][:20] or component['unit'][:20] or 'nos',
                            'default_rate': decimal_value(component['price']),
                            'gst_pct': decimal_value(component['gst_pct']),
                            'margin_pct': decimal_value(component['margin_pct']),
                        },
                    )
                    materials[(basic_name, component['brand'], model_name)] = library_item

                if component_type in ('Service', 'Procurement cum Service'):
                    ServiceItem.objects.get_or_create(
                        name=basic_name[:200],
                        category=basic_name[:100],
                        sub_type=component['detail'][:100],
                        default_unit=component['price_unit'][:20] or component['unit'][:20] or 'sft',
                        default_rate=decimal_value(component['price']),
                        defaults={
                            'gst_pct': decimal_value(component['gst_pct']),
                            'margin_pct': decimal_value(component['margin_pct']),
                        },
                    )

                component_row, _ = EstimateItemComponent.objects.update_or_create(
                    estimate_item=estimate_item,
                    sno=component_index,
                    defaults={
                        'basic_component': basic_name[:150],
                        'detail': component['detail'][:150],
                        'brand': component['brand'][:120],
                        'model': component['model'][:120],
                        'qty': decimal_value(component['quantity']),
                        'unit': component['unit'][:20],
                        'price': decimal_value(component['price']),
                        'library_material_item': library_item,
                    },
                )
                component_numbers.append(component_index)

                line_cost = component_row.amount
                material_cost += line_cost
                weighted_margin += line_cost * decimal_value(component['margin_pct'])

                if furniture:
                    lookup = {
                        'furniture': furniture,
                        'basic_component': basic_component,
                    }
                    FurnitureComponent.objects.get_or_create(
                        **lookup,
                        defaults={
                            'default_material': library_item,
                            'application': component['detail'][:200],
                        },
                    )

                imported_components += 1

            if component_numbers:
                estimate_item.components.exclude(sno__in=component_numbers).delete()
            estimate_item.margin_pct = (
                weighted_margin / material_cost if material_cost else Decimal('0')
            )
            estimate_item.save(update_fields=['margin_pct', 'cost', 'amount', 'margin_amount',
                                               'referral_amount', 'gst_amount_stored', 'total_amount'])

        EstimateItem.objects.filter(estimate=estimate).exclude(
            sno__in=[item_data['sno'] for item_data in items],
        ).delete()

        kitchen_category, _ = MaterialCategory.objects.get_or_create(
            name='Kitchen Accessories - Sample',
            defaults={
                'product_group': MaterialCategory.ProductGroup.KITCHEN_ACCESSORIES,
                'type': 'Procurement',
                'description': 'Sample kitchen accessory materials for Initial Estimate brand selection.',
            },
        )
        kitchen_brand, _ = MaterialBrand.objects.get_or_create(name='Ebco')
        kitchen_material, _ = MaterialItem.objects.get_or_create(
            category=kitchen_category,
            brand=kitchen_brand,
            model_name='Soft-close Pantry Pullout Basket 450 mm',
            defaults={
                'description': 'Sample pantry pullout basket for kitchen cabinetry.',
                'default_unit': 'nos',
                'default_rate': Decimal('8500.00'),
                'gst_pct': Decimal('18'),
                'margin_pct': Decimal('35'),
            },
        )
        kitchen_component, _ = BasicComponent.objects.get_or_create(
            name='Kitchen Accessories - Pantry Pullout',
            defaults={
                'code': 'SAMPLE-KITCHEN-PULLOUT',
                'item_type': ItemType.PROCUREMENT,
                'library_category': kitchen_category,
                'unit': 'nos',
                'price_unit': 'nos',
                'quantity_rule': 'fixed',
                'default_qty': Decimal('1'),
                'fallback_rate': Decimal('8500.00'),
                'gst_pct': Decimal('18'),
                'description': 'Sample pantry pullout accessory.',
            },
        )
        kitchen_furniture = next(
            (furniture for furniture in furniture_models.values()
             if furniture.name == 'Base Wall and Loft'),
            None,
        )
        if kitchen_furniture:
            FurnitureComponent.objects.get_or_create(
                furniture=kitchen_furniture,
                basic_component=kitchen_component,
                defaults={
                    'default_material': kitchen_material,
                    'fixed_qty': Decimal('1'),
                    'application': 'Kitchen base units',
                },
            )
        materials[(
            kitchen_component.name,
            kitchen_brand.name,
            kitchen_material.model_name,
        )] = kitchen_material

        self.stdout.write(self.style.SUCCESS(
            f'Seeded project {project.name} ({project.public_id}): '
            f'{len(items)} estimate items, {imported_components} breakdown rows, '
            f'{len(furniture_models)} furniture models, {len(materials)} raw material models.'
        ))
