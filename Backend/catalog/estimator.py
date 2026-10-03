"""
NICARA — Cabinet calculation engine (parametric bill of materials)

Turns a cabinet *configuration* — template, size, board thicknesses and
component counts — into priced bill-of-materials rows that drop straight into
an estimate line's breakdown (Basic Component | Detail | Brand | Model | Qty |
Unit | Price | Amount).

    ┌────────────────────────────────────────────────────────────────────┐
    │  PROVISIONAL FORMULAS                                               │
    │  Every rule, allowance and constant lives in RULES below. They are  │
    │  sensible shop-floor defaults, NOT yet client-verified. Once the   │
    │  formula sheet is signed off with Sriniketh, replace the values /   │
    │  the panel maths in `_panels()` here and bump FORMULA_VERSION —     │
    │  nothing else in the system needs to change.                        │
    └────────────────────────────────────────────────────────────────────┘

Every output row carries a plain-English `basis` ("3 drawers × 2 slides") so
each number can be checked line-by-line against the Excel sheet.

All geometry is in millimetres internally.
"""
import math
import re
from decimal import Decimal, ROUND_HALF_UP

FORMULA_VERSION = 'provisional-2026-10'

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

    # ── Boards (what plywood is bought in): name → (length mm, width mm)
    'boards': {
        '8x4 ft': (2440, 1220),
        '7x4 ft': (2135, 1220),
        '6x3 ft': (1830, 915),
        '2x1 m': (2000, 1000),
        '1x1 m': (1000, 1000),
    },
    'thicknesses': {
        'carcass': [18, 16, 12],    # sides, top, bottom, shelves
        'shutter': [18, 16],        # doors and drawer fronts
        'back': [8, 6],             # back panel and drawer bottoms
        'drawer_box': [12, 16, 18], # drawer box sides / front / back
    },
    'finishes': ['laminate', 'acrylic', 'none'],

    # ── Defaults for a fresh configuration
    'defaults': {
        'carcass_thickness': 18, 'shutter_thickness': 18, 'back_thickness': 8,
        'drawer_box_thickness': 12, 'board': '8x4 ft', 'finish': 'laminate',
        'wastage_pct': 10, 'ply_brand': 'Austin Lincoln',
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
    'handles_per_door': 1,
    'handles_per_drawer': 1,
    'hinges_by_door_height': [(900, 2), (1500, 3), (10_000, 4)],  # ≤ height → hinges
    'screws_per_carcass_panel': 8,
    'screws_per_drawer': 16,
    'screws_per_hinge': 4,
    'screws_per_slide': 6,
    'edge_band_wastage_pct': 5,

    # ── Finish
    'finish_sheet_sft': 32,          # laminate / acrylic sheet = 8x4
    'finish_wastage_pct': 10,
    'adhesive_sft_per_pack': 60,     # 1 pack covers this much finish area

    # ── Validation limits (mm / counts)
    'limits': {'length': (150, 6000), 'depth': (100, 1200), 'height': (150, 3000),
               'count': (0, 20)},

    # ── Fallback rates when the catalogue has no matching option
    'fallback_rates': {
        'plywood_sft': 90, 'Drawer Channel': 260, 'Handle': 180, 'Screws': 1,
        'Edge Band': 12, 'Hinge': 45, 'Laminate': 1450, 'Acrylic': 3200, 'Adhesive': 550,
    },
}


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


# ════════════════════════════════════════════════════════════════
# Configuration
# ════════════════════════════════════════════════════════════════

def normalize(config=None, hint=None):
    """
    Fill a (possibly partial) configuration from its template and the global
    defaults, then validate. `hint` = {name, length, breadth, height} from an
    estimate line lets an unconfigured line start from a sensible template and
    its own written sizes.
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

    # Sizes written on the line override the template (only when unconfigured).
    for cfg_key, hint_key in (('length', 'length'), ('depth', 'breadth'), ('height', 'height')):
        mm = parse_dimension(hint.get(hint_key))
        if mm and cfg_key not in config:
            out[cfg_key] = round(mm)

    for key, value in config.items():
        if value is not None and value != '':
            out[key] = value

    errors = {}
    lo_hi = RULES['limits']
    for key in ('length', 'depth', 'height'):
        try:
            out[key] = float(out[key])
        except (TypeError, ValueError):
            errors[key] = 'Must be a number (mm).'
            continue
        lo, hi = lo_hi[key]
        if not lo <= out[key] <= hi:
            errors[key] = f'Must be between {lo} and {hi} mm.'
    for key in ('drawers', 'doors', 'shelves'):
        try:
            out[key] = int(out[key])
        except (TypeError, ValueError):
            errors[key] = 'Must be a whole number.'
            continue
        lo, hi = lo_hi['count']
        if not lo <= out[key] <= hi:
            errors[key] = f'Must be between {lo} and {hi}.'
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
        errors['finish'] = f'Choose one of {RULES["finishes"]}.'
    try:
        out['wastage_pct'] = float(out['wastage_pct'])
        if not 0 <= out['wastage_pct'] <= 50:
            errors['wastage_pct'] = 'Must be between 0 and 50.'
    except (TypeError, ValueError):
        errors['wastage_pct'] = 'Must be a number.'

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
    """Every cut panel as (group, thickness, count, length, width, label)."""
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
    """Raw material requirements before pricing."""
    panels, door_zone = _panels(c)
    board_l, board_w = RULES['boards'][c['board']]
    board_sft = board_l * board_w / MM2_PER_SFT
    waste = 1 + c['wastage_pct'] / 100

    by_thickness = {}
    for group, thick, count, a, b, label in panels:
        entry = by_thickness.setdefault(thick, {'mm2': 0.0, 'parts': []})
        entry['mm2'] += count * a * b
        entry['parts'].append(f'{count}× {label}')
    plywood = {}
    for thick, entry in sorted(by_thickness.items(), reverse=True):
        sft = entry['mm2'] / MM2_PER_SFT
        plywood[thick] = {
            'net_sft': sft,
            'gross_sft': sft * waste,
            'sheets': math.ceil(sft * waste / board_sft) if sft else 0,
            'parts': entry['parts'],
        }

    door_h = door_zone if c['doors'] else 0
    hinges_each = _hinges_for(door_h) if c['doors'] else 0
    hinges = c['doors'] * hinges_each
    slides = c['drawers'] * RULES['slides_per_drawer']
    handles = c['doors'] * RULES['handles_per_door'] + c['drawers'] * RULES['handles_per_drawer']
    carcass_panels = 4 + c['shelves']
    screws = (carcass_panels * RULES['screws_per_carcass_panel']
              + c['drawers'] * RULES['screws_per_drawer']
              + hinges * RULES['screws_per_hinge']
              + slides * RULES['screws_per_slide'])

    L, H = c['length'], c['height']
    inner_w = L - 2 * c['carcass_thickness']
    carcass_edges = 2 * H + 2 * inner_w + c['shelves'] * inner_w
    shutter_edges = 0.0
    if c['doors'] and door_zone > 0:
        shutter_edges += c['doors'] * 2 * (L / c['doors'] + door_zone)
    if c['drawers']:
        shutter_edges += c['drawers'] * 2 * (L + RULES['drawer_front_height'])
    edge_rft = (carcass_edges + shutter_edges) / MM_PER_FT * (1 + RULES['edge_band_wastage_pct'] / 100)

    shutter_area = sum(n * a * b for g, _, n, a, b, _ in panels if g == 'Shutter') / MM2_PER_SFT
    finish_sheets = 0
    if c['finish'] != 'none' and shutter_area:
        finish_sheets = math.ceil(shutter_area * (1 + RULES['finish_wastage_pct'] / 100)
                                  / RULES['finish_sheet_sft'])
    adhesive = math.ceil(shutter_area / RULES['adhesive_sft_per_pack']) if finish_sheets else 0

    return {
        'board_sft': board_sft, 'plywood': plywood,
        'door_height': door_h, 'hinges_per_door': hinges_each, 'hinges': hinges,
        'slides': slides, 'handles': handles, 'screws': screws,
        'carcass_panels': carcass_panels, 'edge_band_rft': edge_rft,
        'shutter_sft': shutter_area, 'finish_sheets': finish_sheets, 'adhesive_packs': adhesive,
    }


# ════════════════════════════════════════════════════════════════
# Pricing — reads the Furniture Catalogue
# ════════════════════════════════════════════════════════════════

def _option(material_name, detail_startswith=None, brand_model=None, option_id=None):
    """Best catalogue option: an explicit id, else the preferred brand, else the cheapest."""
    from catalog.models import Material, MaterialOption

    if option_id:
        opt = MaterialOption.objects.select_related('material').filter(pk=option_id).first()
        if opt:
            return opt.material, opt
    material = Material.objects.filter(name__iexact=material_name).first()
    if not material:
        return None, None
    qs = material.options.filter(is_active=True)
    if detail_startswith:
        qs = qs.filter(detail__istartswith=detail_startswith)
    if brand_model:
        preferred = [o for o in qs if f'{o.brand} {o.model_no}'.strip().lower() == brand_model.lower()]
        if preferred:
            return material, preferred[0]
    return material, qs.order_by('price').first()


def _row(component, detail, material, option, qty, unit, fallback_key, basis):
    price = option.price if option else Decimal(str(RULES['fallback_rates'][fallback_key]))
    qty_d = _d(qty)
    return {
        'basic_component': component,
        'detail': detail,
        'brand': option.brand if option else '',
        'model': option.model_no if option else '',
        'qty': qty_d,
        'unit': unit,
        'price': _d(price),
        'amount': _d(qty_d * price),
        'catalog_material': material.pk if material else None,
        'catalog_option': option.pk if option else None,
        'source': 'catalogue' if option else 'provisional',
        'basis': basis,
    }


def calculate(config=None, hint=None):
    """
    Normalise → quantities → priced rows. Returns
    {config, rows, total, quantities, warnings, formula_version}.
    """
    c = normalize(config, hint)
    q = quantities(c)
    rows = []
    sel = c.get('options') or {}

    for thick, p in q['plywood'].items():
        material, option = _option('Plywood', f'{thick}mm', c['ply_brand'])
        rows.append(_row(
            'Plywood', f'{thick}mm BWP Plywood', material, option, p['gross_sft'], 'sft', 'plywood_sft',
            f"{', '.join(p['parts'])} = {p['net_sft']:.2f} sft + {c['wastage_pct']:g}% wastage "
            f"(≈ {p['sheets']} sheet(s) of {c['board']})",
        ))

    if q['hinges']:
        material, option = _option('Hardware', 'Hinge', option_id=sel.get('hinge'))
        rows.append(_row('Hinge', 'Soft-close hinge', material, option, q['hinges'], 'nos', 'Hinge',
                         f"{c['doors']} door(s) × {q['hinges_per_door']} hinges "
                         f"(door height {q['door_height']:.0f}mm)"))
    if q['slides']:
        material, option = _option('Drawer Channel', option_id=sel.get('channel'))
        rows.append(_row('Drawer Channel', 'Telescopic slide', material, option, q['slides'], 'nos',
                         'Drawer Channel',
                         f"{c['drawers']} drawer(s) × {RULES['slides_per_drawer']} slides"))
    if q['handles']:
        material, option = _option('Handle', option_id=sel.get('handle'))
        rows.append(_row('Handle', 'Cabinet handle', material, option, q['handles'], 'nos', 'Handle',
                         f"{c['doors']} door(s) + {c['drawers']} drawer(s), 1 each"))
    material, option = _option('Screws')
    rows.append(_row('Screws', 'Fastening screws', material, option, q['screws'], 'nos', 'Screws',
                     f"{q['carcass_panels']} carcass panels × {RULES['screws_per_carcass_panel']}"
                     f" + {c['drawers']} drawers × {RULES['screws_per_drawer']}"
                     f" + {q['hinges']} hinges × {RULES['screws_per_hinge']}"
                     f" + {q['slides']} slides × {RULES['screws_per_slide']}"))
    material, option = _option('Edge Band')
    rows.append(_row('Edge Band', '2mm PVC edge band', material, option, q['edge_band_rft'], 'rft',
                     'Edge Band',
                     f"exposed carcass + shutter edges + {RULES['edge_band_wastage_pct']}% wastage"))
    if q['finish_sheets']:
        finish_name = 'Laminate' if c['finish'] == 'laminate' else 'Acrylic'
        material, option = _option(finish_name, option_id=sel.get('finish'))
        rows.append(_row(finish_name, f'{finish_name} on shutters', material, option,
                         q['finish_sheets'], 'sheet', finish_name,
                         f"{q['shutter_sft']:.2f} sft shutters + {RULES['finish_wastage_pct']}% "
                         f"÷ {RULES['finish_sheet_sft']} sft/sheet"))
        material, option = _option('Adhesive')
        rows.append(_row('Adhesive', 'Finish adhesive', material, option, q['adhesive_packs'], 'nos',
                         'Adhesive',
                         f"1 pack per {RULES['adhesive_sft_per_pack']} sft of finish"))

    warnings = []
    provisional = sorted({r['basic_component'] for r in rows if r['source'] == 'provisional'})
    if provisional:
        warnings.append(f"No catalogue price for {', '.join(provisional)} — provisional rate used.")
    if c['doors'] == 0 and c['drawers'] == 0:
        warnings.append('Open cabinet — no doors or drawers.')

    total = sum((r['amount'] for r in rows), Decimal('0'))
    serial_q = {
        'plywood': {f'{k}mm': {'net_sft': round(v['net_sft'], 2), 'gross_sft': round(v['gross_sft'], 2),
                               'sheets': v['sheets']} for k, v in q['plywood'].items()},
        'hinges': q['hinges'], 'slides': q['slides'], 'handles': q['handles'],
        'screws': q['screws'], 'edge_band_rft': round(q['edge_band_rft'], 2),
        'finish_sheets': q['finish_sheets'], 'board': c['board'],
    }
    return {
        'config': c, 'rows': rows, 'total': _d(total), 'quantities': serial_q,
        'warnings': warnings, 'formula_version': FORMULA_VERSION,
    }


def meta():
    """Choice lists for the configurator UI."""
    from catalog.models import MaterialOption

    def options_for(material):
        return [{'id': o.id, 'label': f'{o.brand} {o.model_no} — {o.detail} (₹{o.price})'.strip()}
                for o in MaterialOption.objects.filter(material__name=material, is_active=True)]

    ply_brands = sorted({f'{o.brand} {o.model_no}'.strip()
                         for o in MaterialOption.objects.filter(material__name='Plywood', is_active=True)})
    hinges = [o for o in options_for('Hardware') if 'Hinge' in o['label']]
    return {
        'formula_version': FORMULA_VERSION,
        'templates': [{'key': k, **v} for k, v in RULES['templates'].items()],
        'thicknesses': RULES['thicknesses'],
        'boards': list(RULES['boards']),
        'finishes': RULES['finishes'],
        'defaults': RULES['defaults'],
        'ply_brands': ply_brands,
        'hinges': hinges,
        'channels': options_for('Drawer Channel'),
        'handles': options_for('Handle'),
        'laminates': options_for('Laminate'),
        'acrylics': options_for('Acrylic'),
    }
