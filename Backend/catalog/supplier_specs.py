"""
NICARA — Base components from the supplier price sheet

The client's estimate workbook ("sample template.xlsx" → sheet "Sample
detail") is the source of truth for base raw materials: BWP plywood, hinges,
channels, handles, edge banding, laminates, acrylic, veneer, adhesive, screws.
This module maps that sheet's rows

    Specification | Brand | Model | … | Price | Unit (per …)

onto the Furniture Catalogue (Material → MaterialOption), which stays the one
central store the estimate and the cabinet calculator price from.

    python manage.py import_supplier_specs                       # bundled copy
    python manage.py import_supplier_specs --file "sample template.xlsx"

Imported options are tagged `source="supplier_sheet"`; the calculator prefers
them over older manual entries. When the client-verified sheet arrives, re-run
the import against it — prices update in place.
"""
import re
from decimal import Decimal, ROUND_HALF_UP

SHEET_NAME = 'Sample detail'
PLY_SHEET_SFT = 32              # the sheet prices ply per 8x4 sheet

# Column positions in "Sample detail" (0-based), from its header row.
COL = {'spec': 10, 'brand': 11, 'model': 12, 'price': 18, 'per': 19, 'unit': 17}

_MAKERS = {'hettich', 'hafele', 'ebco', 'godrej', 'greenlam', 'merino', 'austin',
           'century', 'shape', 'fevicol', 'pta', 'nimmi', 'sincore'}


def _money(value):
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def _split_model(model):
    """'Onsys - 0 Crank Soft Close' → ('Onsys', '0 Crank Soft Close')."""
    head, _, tail = (model or '').partition(' - ')
    return head.strip(), tail.strip()


def map_row(spec, brand, model, price, per=''):
    """One sheet row → catalogue option dict, or None if it isn't a base component."""
    spec = (spec or '').strip()
    brand = (brand or '').strip()
    model = (model or '').strip()
    try:
        price = _money(price)
    except Exception:
        return None
    if price <= 0:
        return None

    m = re.match(r'core material\((\d+)\s*mm\s*(bwp|flexible)\s*ply\)', spec, re.I)
    if m:
        thick, kind = int(m.group(1)), m.group(2).lower()
        return {
            'material': 'Plywood', 'unit': 'sft', 'size': '8x4',
            'detail': f'{thick}mm Plywood' if kind == 'bwp' else f'{thick}mm Flexible Plywood',
            'brand': brand, 'model_no': re.sub(r'\s*BWP$', '', model, flags=re.I),
            # Bought by the sheet; stored per sft so BOM quantities (sft) price directly.
            'price': _money(price / PLY_SHEET_SFT),
            'notes': f'Supplier sheet: ₹{price:,.0f} per 8x4 sheet (BWP grade)',
        }

    low = spec.lower()
    if low.startswith('box hinges'):
        head, tail = _split_model(model)
        return {'material': 'Hardware', 'detail': 'Hinge', 'brand': brand, 'model_no': head,
                'size': tail, 'price': price, 'unit': 'set',
                'notes': 'Supplier sheet: per set (hinge + plate)'}
    if low.startswith('draw channels') or low.startswith('drawer channels'):
        head, tail = _split_model(model)
        head = re.sub(r'\s*channels?$', '', head, flags=re.I)
        return {'material': 'Drawer Channel', 'detail': 'Telescopic channel (pair)',
                'brand': brand, 'model_no': head, 'size': tail, 'price': price, 'unit': 'set',
                'notes': 'Supplier sheet: per set = one pair of slides (one drawer)'}
    if low.startswith('handles'):
        if brand.lower() in _MAKERS:
            detail, b, mdl = 'Handle', brand, model
        else:
            detail, b, mdl = brand or 'Handle', '', model
        return {'material': 'Handle', 'detail': detail, 'brand': b, 'model_no': mdl,
                'size': '', 'price': price, 'unit': 'nos', 'notes': 'Supplier sheet'}
    if low.startswith('nails and screws'):
        return {'material': 'Screws', 'detail': 'Nails and screws', 'brand': brand,
                'model_no': model, 'size': '', 'price': price, 'unit': 'box',
                'notes': 'Supplier sheet: per box'}
    if low.startswith('door edges'):
        return {'material': 'Edge Band', 'detail': 'PVC edge band', 'brand': brand,
                'model_no': model, 'size': '', 'price': price, 'unit': 'm',
                'notes': 'Supplier sheet: per metre'}
    if low.startswith('finishing - laminate'):
        if brand.lower() == 'acrylic':
            return {'material': 'Acrylic', 'detail': 'Acrylic sheet', 'brand': '',
                    'model_no': model, 'size': '8x4', 'price': price, 'unit': 'sheet',
                    'notes': 'Supplier sheet: per 8x4 sheet'}
        return {'material': 'Laminate', 'detail': '1mm Laminate', 'brand': brand,
                'model_no': model, 'size': '8x4', 'price': price, 'unit': 'sheet',
                'notes': 'Supplier sheet: per 8x4 sheet'}
    if low.startswith('finishing - veneer'):
        return {'material': 'Veneer', 'detail': 'Veneer sheet', 'brand': brand,
                'model_no': model, 'size': '8x4', 'price': price, 'unit': 'sheet',
                'notes': 'Supplier sheet: per 8x4 sheet'}
    if low.startswith('adhesive(bonding)'):
        return {'material': 'Adhesive', 'detail': 'Bonding adhesive', 'brand': brand,
                'model_no': model, 'size': '', 'price': price, 'unit': 'kg',
                'notes': 'Supplier sheet: per kg'}
    if low.startswith('polishing'):
        unit = (per or '').replace('per', '').strip() or 'rft'
        return {'material': 'Polish', 'detail': f'{brand} polish'.strip(), 'brand': brand,
                'model_no': model, 'size': '', 'price': price, 'unit': unit,
                'notes': f'Supplier sheet: per {unit}'}
    if low.startswith('inner liner'):
        return {'material': 'Inner Liner', 'detail': 'Inner liner', 'brand': brand,
                'model_no': model, 'size': '8x4', 'price': price, 'unit': 'sheet',
                'notes': 'Supplier sheet: per sheet'}
    if low.startswith('accessories') and 'lock' in model.lower():
        return {'material': 'Drawer Lock', 'detail': 'Drawer lock', 'brand': brand,
                'model_no': model, 'size': '', 'price': price, 'unit': 'nos',
                'notes': 'Supplier sheet'}
    return None


def _key(spec):
    return (spec['material'].lower(), spec['detail'].lower(), spec['brand'].lower(),
            spec['model_no'].lower(), spec['size'].lower())


def parse_workbook(path, sheet=SHEET_NAME):
    """Read the supplier sheet → de-duplicated option dicts (later rows win)."""
    import openpyxl

    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    if sheet not in wb.sheetnames:
        raise ValueError(f'Sheet "{sheet}" not found in {path} (have: {wb.sheetnames}).')
    found = {}
    for row in wb[sheet].iter_rows(min_row=2, values_only=True):
        if not row or len(row) <= COL['per']:
            continue
        spec = map_row(row[COL['spec']], row[COL['brand']], row[COL['model']],
                       row[COL['price']], row[COL['per']] or row[COL['unit']])
        if spec:
            found[_key(spec)] = spec
    return list(found.values())


# Options I seeded as stand-ins before the supplier sheet was available —
# retired (not deleted) on import so the calculator can't pick them.
PLACEHOLDERS = [
    ('Drawer Channel', 'Telescopic Channel 450mm'),
    ('Handle', 'Profile Handle 160mm'),
    ('Screws', 'Wood Screw 25mm'),
    ('Edge Band', 'PVC Edge Band 2mm'),
    ('Plywood', '16mm Plywood', 'Gold'),
    ('Plywood', '12mm Plywood', 'Gold'),
    ('Plywood', '6mm Plywood', 'Lincoln'),
]


def import_specs(specs, *, dry_run=False):
    """Upsert option dicts into the catalogue. Returns (created, updated, retired)."""
    from catalog.models import Material, MaterialOption

    created = updated = retired = 0
    for spec in specs:
        material = Material.objects.filter(name__iexact=spec['material']).first()
        if not material:
            if dry_run:
                created += 1
                continue
            material = Material.objects.create(name=spec['material'], default_unit=spec['unit'])
        match = MaterialOption.objects.filter(
            material=material, detail__iexact=spec['detail'], brand__iexact=spec['brand'],
            model_no__iexact=spec['model_no'], size__iexact=spec['size'],
        ).first()
        fields = {'price': spec['price'], 'unit': spec['unit'], 'notes': spec['notes'],
                  'source': MaterialOption.Source.SUPPLIER_SHEET, 'is_active': True}
        if match:
            updated += 1
            if not dry_run:
                for k, v in fields.items():
                    setattr(match, k, v)
                match.save()
        else:
            created += 1
            if not dry_run:
                MaterialOption.objects.create(
                    material=material, detail=spec['detail'], brand=spec['brand'],
                    model_no=spec['model_no'], size=spec['size'], **fields)

    for entry in PLACEHOLDERS:
        qs = MaterialOption.objects.filter(material__name=entry[0], detail=entry[1], is_active=True,
                                           source=MaterialOption.Source.MANUAL)
        if len(entry) > 2:
            qs = qs.filter(model_no=entry[2])
        retired += qs.count()
        if not dry_run:
            qs.update(is_active=False)
    return created, updated, retired
