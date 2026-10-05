"""
NICARA — Cabinet calculation engine (parametric bill of materials)

Turns a cabinet *configuration* — template, size, quantity, board thicknesses,
component counts and finish — into priced bill-of-materials rows that drop
straight into an estimate line's breakdown (Basic Component | Detail | Brand |
Model | Qty | Unit | Price | Amount).

Pipeline
    1. materials   exact quantities from the geometry, priced from the
                   catalogue's base components (supplier price sheet)
    2. waste       +10% on the assembly for cutting waste / sheet off-cuts
    3. margin      +35% (the supplier sheet's margin), editable per line

    ┌────────────────────────────────────────────────────────────────────┐
    │  PROVISIONAL FORMULAS                                               │
    │  Every rule, allowance and constant lives in RULES below. They are  │
    │  sensible shop-floor defaults, NOT yet client-verified. Once the   │
    │  formula sheet is signed off with Sriniketh, replace the values /   │
    │  the panel maths in `_panels()` here and bump FORMULA_VERSION —     │
    │  nothing else in the system needs to change.                        │
    └────────────────────────────────────────────────────────────────────┘

Prices are NOT here — they come from the Furniture Catalogue, aligned with the
supplier sheet by `import_supplier_specs` (see catalog/supplier_specs.py).
Every output row carries a plain-English `basis` so each number can be checked
line-by-line against the formula sheet. All geometry is in millimetres.
"""
import math
import re
from decimal import Decimal, ROUND_HALF_UP

FORMULA_VERSION = 'provisional-2026-10b'

MM2_PER_SFT = 92903.04          # 1 sq ft in mm²
MM_PER_FT = 304.8

RULES = {
    # ── Templates: the default configuration when an item is picked without
    #    custom sizes. Dimensions are width (L) × depth (B) × height (H), mm.
    'templates': {
        'base_cabinet': {'label': 'Base Cabinet', 'length': 600, 'depth': 560, 'height': 720,
                         'drawers': 2, 'doors': 1, 'shelves': 1},
        'wall_cabinet': {'label': 'Wall Cabinet', 'length': 600, 'depth': 300, 'height': 720,
                         'drawers': 0, 'doors': 2, 'shelves': 1},
        'drawer_unit': {'label': 'Drawer Unit', 'length': 600, 'depth': 560, 'height': 720,
                        'drawers': 3, 'doors': 0, 'shelves': 0},
        'tall_unit': {'label': 'Tall Unit', 'length': 600, 'depth': 560, 'height': 2100,
                      'drawers': 0, 'doors': 2, 'shelves': 4},
        'wardrobe': {'label': 'Wardrobe', 'length': 1200, 'depth': 600, 'height': 2100,
                     'drawers': 2, 'doors': 2, 'shelves': 4},
    },
    # Item-name keywords → template, for "picked an item, no sizes given".
    'template_keywords': [
        ('drawer', 'drawer_unit'),
        ('wardrobe', 'wardrobe'),
        ('wall unit', 'wall_cabinet'), ('wall cabinet', 'wall_cabinet'),
        ('overhead', 'wall_cabinet'), ('loft', 'wall_cabinet'),
        ('tall', 'tall_unit'),
        ('base unit', 'base_cabinet'), ('cabinet', 'base_cabinet'),
        ('vanity', 'base_cabinet'), ('storage', 'base_cabinet'),
        ('crockery', 'base_cabinet'), ('shoe', 'base_cabinet'),
    ],

    # ── Procurement boards: name → (length mm, width mm). 8x4 = 32 sft, 4x4 = 16 sft.
    'boards': {
        '8x4 ft': (2440, 1220),
        '4x4 ft': (1220, 1220),
        '7x4 ft': (2135, 1220),
        '6x3 ft': (1830, 915),
        '2x1 m': (2000, 1000),
        '1x1 m': (1000, 1000),
    },
    'thicknesses': {
        'carcass': [18, 16, 12, 10],    # sides, top, bottom, shelves
        'shutter': [18, 16, 12],        # doors and drawer fronts
        'back': [8, 6, 10],             # back panel and drawer bottoms
        'drawer_box': [12, 10, 16, 18], # drawer box sides / front / back
    },
    'finishes': {
        'laminate': 'Laminate', 'acrylic': 'Acrylic', 'veneer': 'Veneer',
        'polish': 'Polish', 'none': 'No finish',
    },

    # ── Defaults for a fresh configuration
    'defaults': {
        'quantity': 1,
        'carcass_thickness': 16, 'shutter_thickness': 16, 'back_thickness': 8,
        'drawer_box_thickness': 12, 'board': '8x4 ft', 'finish': 'laminate',
        'ply_brand': 'Austin Lincoln',
        'wastage_pct': 10,      # cutting waste on the final assembly
        'margin_pct': 35,       # as applied throughout the supplier sheet
    },

    # ── Geometry allowances (mm)
    'drawer_front_height': 180,     # each drawer front
    'min_door_height': 150,         # doors need at least this above the drawers
    'drawer_box_height': 140,
    'drawer_box_depth_less': 60,    # box depth = cabinet depth − this
    'slide_clearance_each_side': 13,
    'shelf_setback': 20,            # shelf depth = depth − back − setback

    # ── Hardware scaling
    'slides_per_drawer': 2,
    'slides_per_channel_set': 2,    # the sheet prices channels per set = one pair
    'handles_per_door': 1,
    'handles_per_drawer': 1,
    'hinges_by_door_height': [(900, 2), (1500, 3), (10_000, 4)],  # ≤ height → hinges
    'screws_per_carcass_panel': 8,
    'screws_per_drawer': 16,
    'screws_per_hinge': 4,
    'screws_per_slide': 6,
    'screws_per_box': 100,
    'edge_band_wastage_pct': 5,

    # ── Finish
    'finish_sheet_sft': 32,          # laminate / acrylic / veneer sheet = 8x4
    'adhesive_kg_per_sheet': 1,      # bonding adhesive per sheet of finish area

    # ── Validation limits
    'limits': {'length': (150, 6000), 'depth': (100, 1200), 'height': (150, 3000),
               'count': (0, 20), 'quantity': (1, 500)},

    # ── Fallback rates when the catalogue has no matching option (flagged PROV)
    'fallback_rates': {
        'plywood_sft': {6: 70, 8: 80, 10: 88, 12: 95, 16: 110, 18: 120},
        'Hinge': 260, 'Drawer Channel': 2600, 'Handle': 250, 'Screws': 750,
        'Edge Band': 60, 'Laminate': 3000, 'Acrylic': 4500, 'Veneer': 6000,
        'Adhesive': 290, 'Polish': 220,
    },
    'fallback_units': {
        'Hinge': 'set', 'Drawer Channel': 'set', 'Handle': 'nos', 'Screws': 'box',
        'Edge Band': 'm', 'Laminate': 'sheet', 'Acrylic': 'sheet', 'Veneer': 'sheet',
        'Adhesive': 'kg', 'Polish': 'sft',
    },
}

# Row keys a user may override the quantity of (intermediate / final estimate).
OVERRIDABLE = {'hinge', 'channel', 'handle', 'screws', 'edge_band', 'finish', 'adhesive'}


class ConfigError(ValueError):
    """Raised for a configuration that cannot be calculated."""

    def __init__(self, errors):
        self.errors = errors
        super().__init__('; '.join(f'{k}: {v}' for k, v in errors.items()))


# ════════════════════════════════════════════════════════════════
# Helpers
# ════════════════════════════════════════════════════════════════

def _d(value, places='0.01'):
    return Decimal(str(value)).quantize(Decimal(places), rounding=ROUND_HALF_UP)


def parse_dimension(text):
    """
    Designer-written size → mm. Accepts 8'0", 8', 2'6", 30", 600mm, 60cm,
    1.2m. A bare number ≤ 20 is read as feet (how the sheets are written),
    anything larger as mm. Returns None when nothing parses.
    """
    if text is None:
        return None
    s = str(text).strip().lower().replace('’', "'").replace('”', '"').replace("''", '"')
    if not s or s in {'-', '—'}:
        return None
    m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*'\s*(?:(\d+(?:\.\d+)?)\s*\"?)?", s)
    if m:
        return float(m.group(1)) * MM_PER_FT + float(m.group(2) or 0) * 25.4
    m = re.fullmatch(r'(\d+(?:\.\d+)?)\s*"', s)
    if m:
        return float(m.group(1)) * 25.4
    m = re.fullmatch(r'(\d+(?:\.\d+)?)\s*(mm|cm|m|ft|in)?', s)
    if m:
        n, unit = float(m.group(1)), m.group(2)
        factor = {'mm': 1, 'cm': 10, 'm': 1000, 'ft': MM_PER_FT, 'in': 25.4}.get(unit)
        if factor:
            return n * factor
        return n * MM_PER_FT if n <= 20 else n
    return None


def format_ft_in(mm):
    """mm → designer notation, e.g. 2438 → 8'0\"."""
    total_in = round(mm / 25.4)
    return f"{total_in // 12}'{total_in % 12}\""


def guess_template(name):
    """Pick a template from an item name, or None if it isn't a cabinet."""
    n = (name or '').lower()
    for keyword, template in RULES['template_keywords']:
        if keyword in n:
            return template
    return None


def _hinges_for(door_height):
    for max_h, count in RULES['hinges_by_door_height']:
        if door_height <= max_h:
            return count
    return RULES['hinges_by_door_height'][-1][1]


def _board_sft(board):
    length, width = RULES['boards'][board]
    return length * width / MM2_PER_SFT


def _size_sft(size):
    """'8x4' → 32 (sheet area in sft); unknown → the standard 32."""
    m = re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*', size or '')
    return float(m.group(1)) * float(m.group(2)) if m else RULES['finish_sheet_sft']


# ════════════════════════════════════════════════════════════════
# Configuration
# ════════════════════════════════════════════════════════════════

def normalize(config=None, hint=None):
    """
    Fill a (possibly partial) configuration from its template and the global
    defaults, then validate. `hint` = {name, length, breadth, height, qty} from
    an estimate line lets an unconfigured line start from a sensible template,
    its own written sizes and its quantity.
    """
    config = dict(config or {})
    hint = hint or {}

    template_key = config.get('template') or guess_template(hint.get('name')) or 'base_cabinet'
    if template_key not in RULES['templates']:
        raise ConfigError({'template': f'Unknown template "{template_key}".'})
    template = RULES['templates'][template_key]

    out = {'template': template_key}
    for key in ('length', 'depth', 'height', 'drawers', 'doors', 'shelves'):
        out[key] = template[key]
    out.update(RULES['defaults'])
    out['overrides'] = {}

    # Sizes / quantity written on the line seed an unconfigured calculation.
    for cfg_key, hint_key in (('length', 'length'), ('depth', 'breadth'), ('height', 'height')):
        mm = parse_dimension(hint.get(hint_key))
        if mm and cfg_key not in config:
            out[cfg_key] = round(mm)
    if 'quantity' not in config:
        try:
            q = int(float(hint.get('qty') or 0))
            if q >= 1:
                out['quantity'] = q
        except (TypeError, ValueError):
            pass

    for key, value in config.items():
        if value is not None and value != '':
            out[key] = value

    errors = {}
    limits = RULES['limits']

    def number(key, cast, lo, hi, msg):
        try:
            out[key] = cast(out[key])
        except (TypeError, ValueError):
            errors[key] = msg
            return
        if not lo <= out[key] <= hi:
            errors[key] = f'Must be between {lo} and {hi}.'

    for key in ('length', 'depth', 'height'):
        number(key, float, *limits[key], 'Must be a number (mm).')
        if key in errors and errors[key].startswith('Must be between'):
            errors[key] = errors[key][:-1] + ' mm.'
    for key in ('drawers', 'doors', 'shelves'):
        number(key, int, *limits['count'], 'Must be a whole number.')
    number('quantity', lambda v: int(float(v)), *limits['quantity'], 'Must be a whole number.')
    number('wastage_pct', float, 0, 50, 'Must be a number.')
    number('margin_pct', float, 0, 100, 'Must be a number.')

    for key, group in (('carcass_thickness', 'carcass'), ('shutter_thickness', 'shutter'),
                       ('back_thickness', 'back'), ('drawer_box_thickness', 'drawer_box')):
        try:
            out[key] = int(out[key])
        except (TypeError, ValueError):
            errors[key] = 'Pick a thickness.'
            continue
        if out[key] not in RULES['thicknesses'][group]:
            errors[key] = f'Choose one of {RULES["thicknesses"][group]} mm.'
    if out['board'] not in RULES['boards']:
        errors['board'] = f'Choose one of {list(RULES["boards"])}.'
    if out['finish'] not in RULES['finishes']:
        errors['finish'] = f'Choose one of {list(RULES["finishes"])}.'

    overrides = {}
    for key, value in (out.get('overrides') or {}).items():
        if value is None or value == '':
            continue
        if key not in OVERRIDABLE:
            errors['overrides'] = f'"{key}" cannot be overridden.'
            continue
        try:
            value = float(value)
        except (TypeError, ValueError):
            errors['overrides'] = f'Override for {key} must be a number.'
            continue
        if value < 0:
            errors['overrides'] = f'Override for {key} cannot be negative.'
            continue
        overrides[key] = value
    out['overrides'] = overrides

    if not errors:
        drawer_zone = out['drawers'] * RULES['drawer_front_height']
        if drawer_zone > out['height']:
            errors['drawers'] = (f'{out["drawers"]} drawers × {RULES["drawer_front_height"]}mm '
                                 f'fronts exceed the {out["height"]:.0f}mm height.')
        elif out['doors'] and out['height'] - drawer_zone < RULES['min_door_height']:
            errors['doors'] = (f'Only {out["height"] - drawer_zone:.0f}mm left above the drawers '
                               f'— doors need {RULES["min_door_height"]}mm. Remove doors or drawers.')
    if errors:
        raise ConfigError(errors)
    return out


# ════════════════════════════════════════════════════════════════
# Geometry → quantities
# ════════════════════════════════════════════════════════════════

def _panels(c):
    """Every cut panel of ONE unit as (group, thickness, count, length, width, label)."""
    L, D, H = c['length'], c['depth'], c['height']
    t, s, b, tb = (c['carcass_thickness'], c['shutter_thickness'],
                   c['back_thickness'], c['drawer_box_thickness'])
    inner_w = L - 2 * t
    panels = [
        ('Carcass', t, 2, H, D, 'sides'),
        ('Carcass', t, 2, inner_w, D, 'top + bottom'),
    ]
    if c['shelves']:
        shelf_d = D - b - RULES['shelf_setback']
        panels.append(('Carcass', t, c['shelves'], inner_w, shelf_d, 'shelves'))
    panels.append(('Back', b, 1, L, H, 'back panel'))

    drawer_zone = c['drawers'] * RULES['drawer_front_height']
    door_zone = H - drawer_zone
    if c['doors'] and door_zone > 0:
        panels.append(('Shutter', s, c['doors'], L / c['doors'], door_zone, 'doors'))
    if c['drawers']:
        panels.append(('Shutter', s, c['drawers'], L, RULES['drawer_front_height'], 'drawer fronts'))
        box_w = inner_w - 2 * RULES['slide_clearance_each_side']
        box_d = D - RULES['drawer_box_depth_less']
        box_h = RULES['drawer_box_height']
        panels += [
            ('Drawer Box', tb, 2 * c['drawers'], box_d, box_h, 'drawer sides'),
            ('Drawer Box', tb, 2 * c['drawers'], box_w - 2 * tb, box_h, 'drawer front + back'),
            ('Drawer Box', b, c['drawers'], box_w, box_d, 'drawer bottoms'),
        ]
    return panels, door_zone


def quantities(c):
    """Raw material requirements for `quantity` units, before pricing."""
    n = c['quantity']
    panels, door_zone = _panels(c)
    board_sft = _board_sft(c['board'])

    by_thickness = {}
    for group, thick, count, a, b, label in panels:
        entry = by_thickness.setdefault(thick, {'mm2': 0.0, 'parts': []})
        entry['mm2'] += count * a * b * n
        entry['parts'].append(f'{count}× {label}')
    plywood = {}
    for thick, entry in sorted(by_thickness.items(), reverse=True):
        sft = entry['mm2'] / MM2_PER_SFT
        plywood[thick] = {
            'net_sft': sft,
            # Whole sheets to procure; the off-cut loss is costed by the waste row.
            'sheets': math.ceil(sft / board_sft - 1e-9) if sft else 0,
            'parts': entry['parts'],
        }

    hinges_each = _hinges_for(door_zone) if c['doors'] else 0
    hinges = c['doors'] * hinges_each * n
    slides = c['drawers'] * RULES['slides_per_drawer'] * n
    handles = (c['doors'] * RULES['handles_per_door'] + c['drawers'] * RULES['handles_per_drawer']) * n
    carcass_panels = 4 + c['shelves']
    screws = (carcass_panels * RULES['screws_per_carcass_panel']
              + c['drawers'] * RULES['screws_per_drawer']
              + c['doors'] * hinges_each * RULES['screws_per_hinge']
              + c['drawers'] * RULES['slides_per_drawer'] * RULES['screws_per_slide']) * n

    L, H = c['length'], c['height']
    inner_w = L - 2 * c['carcass_thickness']
    carcass_edges = 2 * H + 2 * inner_w + c['shelves'] * inner_w
    shutter_edges = 0.0
    if c['doors'] and door_zone > 0:
        shutter_edges += c['doors'] * 2 * (L / c['doors'] + door_zone)
    if c['drawers']:
        shutter_edges += c['drawers'] * 2 * (L + RULES['drawer_front_height'])
    edge_mm = (carcass_edges + shutter_edges) * n * (1 + RULES['edge_band_wastage_pct'] / 100)

    shutter_sft = sum(cnt * a * b for g, _, cnt, a, b, _ in panels if g == 'Shutter') * n / MM2_PER_SFT

    return {
        'board_sft': board_sft, 'plywood': plywood,
        'door_height': door_zone if c['doors'] else 0, 'hinges_per_door': hinges_each,
        'hinges': hinges, 'slides': slides, 'handles': handles, 'screws': screws,
        'carcass_panels': carcass_panels, 'edge_mm': edge_mm, 'shutter_sft': shutter_sft,
    }


# ════════════════════════════════════════════════════════════════
# Pricing — reads the Furniture Catalogue (supplier sheet base components)
# ════════════════════════════════════════════════════════════════

def _option(material_name, *, detail=None, detail_startswith=None, brand_model=None,
            option_id=None, units=None):
    """
    Best catalogue option: an explicit id, else the preferred brand, else the
    cheapest supplier-sheet row, else the cheapest active row.
    """
    from catalog.models import Material, MaterialOption

    if option_id:
        opt = MaterialOption.objects.select_related('material').filter(pk=option_id, is_active=True).first()
        if opt and (not units or opt.unit.lower() in units):
            return opt.material, opt
    material = Material.objects.filter(name__iexact=material_name).first()
    if not material:
        return None, None
    qs = material.options.filter(is_active=True)
    if detail:
        qs = qs.filter(detail__iexact=detail)
    if detail_startswith:
        qs = qs.filter(detail__istartswith=detail_startswith)
    candidates = [o for o in qs.order_by('price') if not units or o.unit.lower() in units]
    if brand_model:
        preferred = [o for o in candidates
                     if f'{o.brand} {o.model_no}'.strip().lower() == brand_model.lower()]
        if preferred:
            return material, preferred[0]
    supplier = [o for o in candidates if o.source == MaterialOption.Source.SUPPLIER_SHEET]
    pick = (supplier or candidates or [None])[0]
    return material, pick


def _row(key, component, detail, material, option, qty, unit, price, basis, source=None):
    qty_d = _d(qty)
    price_d = _d(price)
    return {
        'key': key,
        'basic_component': component,
        'detail': detail,
        'brand': option.brand if option else '',
        'model': option.model_no if option else '',
        'qty': qty_d,
        'unit': unit,
        'price': price_d,
        'amount': _d(qty_d * price_d),
        'catalog_material': material.pk if material else None,
        'catalog_option': option.pk if option else None,
        'source': source or ('catalogue' if option else 'provisional'),
        'basis': basis,
        'overridden': False,
    }


def _fallback(name):
    return Decimal(str(RULES['fallback_rates'][name])), RULES['fallback_units'][name]


def calculate(config=None, hint=None):
    """
    Normalise → quantities → priced material rows → waste → margin. Returns
    {config, rows, subtotal, waste, margin, total, per_unit, quantities,
     warnings, formula_version}.
    """
    c = normalize(config, hint)
    q = quantities(c)
    n = c['quantity']
    units_note = f' for {n} units' if n > 1 else ''
    sel = c.get('options') or {}
    rows = []

    # ── Plywood: exact area, priced per sft (supplier sheet price ÷ sheet area)
    for thick, p in q['plywood'].items():
        material, option = _option('Plywood', detail=f'{thick}mm Plywood', brand_model=c['ply_brand'])
        if option:
            per_sft = option.price if option.unit.lower() == 'sft' else option.price / Decimal(str(_size_sft(option.size)))
        else:
            per_sft = Decimal(str(RULES['fallback_rates']['plywood_sft'].get(thick, 100)))
        rows.append(_row(
            f'ply_{thick}', 'Plywood', f'{thick}mm BWP Plywood', material, option,
            p['net_sft'], 'sft', per_sft,
            f"{', '.join(p['parts'])}{units_note} = {p['net_sft']:.2f} sft exact "
            f"→ procure {p['sheets']} sheet(s) of {c['board']} ({q['board_sft']:.0f} sft)",
        ))

    # ── Hardware
    if q['hinges']:
        material, option = _option('Hardware', detail_startswith='Hinge', option_id=sel.get('hinge'))
        price, unit = (option.price, option.unit) if option else _fallback('Hinge')
        rows.append(_row('hinge', 'Hinge', 'Soft-close box hinge', material, option, q['hinges'], unit, price,
                         f"{c['doors']} door(s) × {q['hinges_per_door']} hinges"
                         f" (door height {q['door_height']:.0f}mm){units_note}"))
    if q['slides']:
        material, option = _option('Drawer Channel', option_id=sel.get('channel'))
        price, unit = (option.price, option.unit) if option else _fallback('Drawer Channel')
        per_set = RULES['slides_per_channel_set'] if unit.lower() in ('set', 'pair') else 1
        rows.append(_row('channel', 'Drawer Channel', 'Telescopic channel', material, option,
                         q['slides'] / per_set, unit, price,
                         f"{c['drawers']} drawer(s) × {RULES['slides_per_drawer']} slides{units_note} "
                         f"= {q['slides']} slides" + (f" = {q['slides'] // per_set} set(s) of {per_set}" if per_set > 1 else '')))
    if q['handles']:
        material, option = _option('Handle', option_id=sel.get('handle'))
        price, unit = (option.price, option.unit) if option else _fallback('Handle')
        rows.append(_row('handle', 'Handle', option.detail if option else 'Cabinet handle', material, option,
                         q['handles'], unit, price,
                         f"{c['doors']} door(s) + {c['drawers']} drawer(s), 1 each{units_note}"))
    material, option = _option('Screws')
    price, unit = (option.price, option.unit) if option else _fallback('Screws')
    per_box = RULES['screws_per_box'] if unit.lower() == 'box' else 1
    rows.append(_row('screws', 'Screws', 'Nails and screws', material, option, q['screws'] / per_box, unit, price,
                     f"({q['carcass_panels']} panels × {RULES['screws_per_carcass_panel']}"
                     f" + {c['drawers']} drawers × {RULES['screws_per_drawer']}"
                     f" + hinges × {RULES['screws_per_hinge']} + slides × {RULES['screws_per_slide']}){units_note}"
                     f" = {q['screws']} screws" + (f" ÷ {per_box} per box" if per_box > 1 else '')))
    material, option = _option('Edge Band')
    price, unit = (option.price, option.unit) if option else _fallback('Edge Band')
    edge_qty = q['edge_mm'] / (1000 if unit.lower() in ('m', 'mtr', 'metre') else MM_PER_FT)
    rows.append(_row('edge_band', 'Edge Band', 'PVC edge band 22×2mm', material, option, edge_qty, unit, price,
                     f"exposed carcass + shutter edges{units_note} + {RULES['edge_band_wastage_pct']}% wastage"))

    # ── Finish on the shutters (exterior face)
    finish = c['finish']
    if finish != 'none' and q['shutter_sft']:
        name = RULES['finishes'][finish]
        area = q['shutter_sft']
        if finish == 'polish':
            material, option = _option('Polish', option_id=sel.get('finish'), units={'sft'})
            price, unit = (option.price, option.unit) if option else _fallback('Polish')
            rows.append(_row('finish', 'Polish', option.detail if option else 'Melamine / PU polish',
                             material, option, area, 'sft', price,
                             f"{area:.2f} sft shutter faces{units_note}"
                             + ('' if option else ' — per-sft polish rate not in the supplier sheet')))
        else:
            material, option = _option(name, option_id=sel.get('finish'))
            price, unit = (option.price, option.unit) if option else _fallback(name)
            if unit.lower() == 'sft':
                qty, basis = area, f"{area:.2f} sft shutter faces{units_note}"
            else:
                sheet = _size_sft(option.size) if option else RULES['finish_sheet_sft']
                qty = area / sheet
                basis = (f"{area:.2f} sft shutters{units_note} ÷ {sheet:.0f} sft/sheet "
                         f"= {qty:.2f} sheet (procure {math.ceil(qty - 1e-9)})")
            rows.append(_row('finish', name, f'{name} on shutters', material, option, qty, unit, price, basis))
            material, option = _option('Adhesive')
            price, unit = (option.price, option.unit) if option else _fallback('Adhesive')
            kg = area / RULES['finish_sheet_sft'] * RULES['adhesive_kg_per_sheet']
            rows.append(_row('adhesive', 'Adhesive', 'Bonding adhesive', material, option, kg, unit, price,
                             f"{RULES['adhesive_kg_per_sheet']} kg per {RULES['finish_sheet_sft']} sft of finish"))

    # ── User overrides of component quantities (intermediate / final estimate)
    for row in rows:
        if row['key'] in c['overrides']:
            row['calculated_qty'] = row['qty']
            row['qty'] = _d(c['overrides'][row['key']])
            row['amount'] = _d(row['qty'] * row['price'])
            row['overridden'] = True
            row['basis'] = f"quantity overridden (calculated {row['calculated_qty']}) — " + row['basis']

    subtotal = sum((r['amount'] for r in rows), Decimal('0'))

    # ── Cutting waste on the final assembly
    waste = _d(subtotal * Decimal(str(c['wastage_pct'])) / 100)
    if waste:
        rows.append(_row('waste', 'Cutting Waste', f"{c['wastage_pct']:g}% on the assembly", None, None,
                         1, 'lot', waste,
                         f"{c['wastage_pct']:g}% of ₹{subtotal:,.2f} materials — cutting waste and "
                         f"off-cuts from standard sheets", source='calculated'))

    # ── Margin (the supplier sheet applies 35% to every procurement line)
    margin = _d((subtotal + waste) * Decimal(str(c['margin_pct'])) / 100)
    if margin:
        rows.append(_row('margin', 'Margin', f"{c['margin_pct']:g}% margin", None, None,
                         1, 'lot', margin,
                         f"{c['margin_pct']:g}% of ₹{subtotal + waste:,.2f} (materials + waste)",
                         source='calculated'))

    total = subtotal + waste + margin
    warnings = []
    provisional = sorted({r['basic_component'] for r in rows if r['source'] == 'provisional'})
    if provisional:
        warnings.append(f"No supplier-sheet price for {', '.join(provisional)} — provisional rate used.")
    if c['doors'] == 0 and c['drawers'] == 0:
        warnings.append('Open cabinet — no doors or drawers.')
    if c['overrides']:
        warnings.append(f"{len(c['overrides'])} quantity override(s) in place — they don't follow size or count changes.")

    serial_q = {
        'plywood': {f'{k}mm': {'net_sft': round(v['net_sft'], 2), 'sheets': v['sheets']}
                    for k, v in q['plywood'].items()},
        'hinges': q['hinges'], 'slides': q['slides'], 'handles': q['handles'],
        'screws': q['screws'], 'edge_band_m': round(q['edge_mm'] / 1000, 2),
        'shutter_sft': round(q['shutter_sft'], 2), 'board': c['board'],
        'board_sft': round(q['board_sft'], 1), 'quantity': n,
    }
    return {
        'config': c, 'rows': rows, 'subtotal': _d(subtotal), 'waste': waste, 'margin': margin,
        'total': _d(total), 'per_unit': _d(total / n), 'quantities': serial_q,
        'warnings': warnings, 'formula_version': FORMULA_VERSION,
    }


def meta():
    """Choice lists for the configurator UI."""
    from catalog.models import MaterialOption

    def options_for(material, **filters):
        qs = MaterialOption.objects.filter(material__name=material, is_active=True, **filters)
        return [{'id': o.id, 'unit': o.unit,
                 'label': ' '.join(x for x in [o.brand, o.model_no, '—', o.detail, o.size] if x)
                          + f' (₹{o.price:,.0f}/{o.unit})',
                 'supplier_sheet': o.source == MaterialOption.Source.SUPPLIER_SHEET}
                for o in qs.order_by('-source', 'price')]

    ply_brands = sorted({f'{o.brand} {o.model_no}'.strip()
                         for o in MaterialOption.objects.filter(material__name='Plywood', is_active=True)})
    return {
        'formula_version': FORMULA_VERSION,
        'templates': [{'key': k, **v} for k, v in RULES['templates'].items()],
        'thicknesses': RULES['thicknesses'],
        'boards': [{'key': k, 'sft': round(_board_sft(k), 1)} for k in RULES['boards']],
        'finishes': [{'key': k, 'label': v} for k, v in RULES['finishes'].items()],
        'defaults': RULES['defaults'],
        'overridable': sorted(OVERRIDABLE),
        'ply_brands': ply_brands,
        'hinges': options_for('Hardware', detail__istartswith='Hinge'),
        'channels': options_for('Drawer Channel'),
        'handles': options_for('Handle'),
        'finish_options': {
            'laminate': options_for('Laminate'),
            'acrylic': options_for('Acrylic'),
            'veneer': options_for('Veneer'),
            'polish': options_for('Polish', unit='sft'),
        },
    }
