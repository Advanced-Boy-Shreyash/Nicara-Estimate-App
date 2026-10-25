"""
Turn a furniture + size into its estimate rows (shared by the catalogue preview
and Initial Estimate generation).

    price_for(component, material)   → which raw material prices a row, and its rate
    breakdown(furniture, W, H, D, …) → one dict per furniture component, with
                                       quantity (from catalog/rules.py), rate and basis

Doors, Drawers and Shelves are priced per piece: each carries the material it
is made of (shutter ply, laminate, liner, edge band, hinges, handle; drawer box,
channel, knob; shelf board, lining) as `parts`. Those quantities are taken out
of the material rows, so nothing is counted twice — a material row keeps only
what is left (the carcass), and a row with nothing left is not shown.
"""
from decimal import Decimal, ROUND_HALF_UP

from . import rules

TWO = Decimal('0.01')
PIECES = {'doors': 'Doors', 'drawers': 'Drawers', 'shelves': 'Shelves'}


def price_for(basic_component, default_material=None):
    """(raw material or None, rate). Pinned material, else the cheapest active
    model in the component's raw-material category, else its fallback rate."""
    if default_material is not None and default_material.is_active:
        return default_material, default_material.default_rate
    category = basic_component.library_category
    if category is not None:
        material = category.materials.filter(is_active=True).order_by('default_rate', 'id').first()
        if material is not None:
            return material, material.default_rate
    return None, basic_component.fallback_rate


def size_inches(width='', height='', depth=''):
    """Designer-written sizes (8'0", 600mm, …) → inches (0 when blank)."""
    return tuple(rules.parse_inches(v) or 0.0 for v in (width, height, depth))


def application_text(rule, qty, options):
    """The sheet's Application column for Spec Purpose rows: 'Ply - 8 nos'."""
    n = int(qty)
    if rule == 'shelves':
        return f"{'Glass' if (options or {}).get('shelf_type') == 'glass' else 'Ply'} - {n} nos"
    if rule == 'doors':
        return f'Ply - {n} nos'
    if rule == 'drawers':
        return f'{n} nos'
    return ''


def _d(value):
    return Decimal(str(value)).quantize(TWO, rounding=ROUND_HALF_UP)


def _material_fields(material, rate):
    return {
        'raw_material': material,
        'brand': material.brand.name if material and material.brand_id else '',
        'model': material.model_name if material else '',
        'rate': Decimal(rate),
    }


def breakdown(furniture, width, height, depth, options=None):
    """
    Rows for one furniture piece, in component order:
        {component, basic_component, item_type, specification, brand, model,
         raw_material, qty, unit, rate, amount, price_unit, gst_pct,
         quantity_rule, basis, needs_input, application, parts}
    plus the rules summary (counts, warnings). Spec Purpose rows carry
    `parts` (their per-piece materials); `rate` is then the cost of one piece.
    """
    calc = rules.compute(furniture.cabinet_type, width, height, depth, options)
    components = list(furniture.components.filter(is_active=True)
                      .select_related('basic_component__library_category',
                                      'default_material__brand', 'default_material__category'))

    def rule_of(fc):
        return fc.basic_component.quantity_rule if fc.fixed_qty is None else 'fixed'

    # Pieces this furniture is estimated with (a Doors row present, with doors > 0).
    pieces = {rule_of(fc) for fc in components
              if fc.basic_component.item_type == 'Spec Purpose' and rule_of(fc) in PIECES
              and calc.counts.get(rule_of(fc))}

    # The first component of each shared rule supplies the pieces' material;
    # repeats (e.g. laminate + acrylic both on finish_sheets) stay as they are.
    feeders = {}
    for fc in components:
        r = rule_of(fc)
        if r in calc.shares and r not in feeders and fc.basic_component.item_type != 'Spec Purpose':
            feeders[r] = fc

    parts = {piece: [] for piece in pieces}
    left = {}   # feeder component id → (qty left on the row, note)
    for r, fc in feeders.items():
        share = calc.shares[r]
        total_weight = share.get('_total') or 0
        qty, basis, _ = calc.quantity(r)
        given = {p: share.get(p, 0) for p in pieces if share.get(p)}
        if not given or not total_weight or qty <= 0:
            continue
        material, rate = price_for(fc.basic_component, fc.default_material)
        moved = Decimal('0')
        for piece, weight in given.items():
            piece_qty = _d(qty * Decimal(str(weight / total_weight)))
            moved += piece_qty
            parts[piece].append({
                'basic_component': fc.basic_component,
                'detail': calc.part_notes.get((r, piece), ''),
                'qty': piece_qty, 'unit': fc.basic_component.unit,
                'rule': r, **_material_fields(material, rate),
            })
        rest = max(Decimal('0'), qty - moved)
        where = ', '.join(f'{PIECES[p].lower()} {_d(qty * Decimal(str(w / total_weight)))}' for p, w in given.items())
        left[fc.id] = (rest, f'{basis} — {where} priced in the piece rows; {rest} left here')

    rows = []
    for fc in components:
        bc = fc.basic_component
        rule = rule_of(fc)
        qty, basis, needs = calc.quantity(bc.quantity_rule, fc.fixed_qty, bc.default_qty)
        spec = bc.item_type == 'Spec Purpose'
        if fc.id in left:
            qty, basis = left[fc.id]
            if qty <= 0:
                continue            # everything went into the doors / drawers / shelves
        row = {
            'component': fc, 'basic_component': bc, 'item_type': bc.item_type,
            'specification': bc.name, 'qty': qty, 'unit': bc.unit,
            'price_unit': bc.price_unit, 'gst_pct': bc.gst_pct, 'quantity_rule': rule,
            'basis': basis, 'needs_input': needs,
            'application': fc.application or (application_text(bc.quantity_rule, qty, options) if spec else ''),
            'parts': [],
        }
        if spec:
            row.update(_material_fields(None, 0))
            row['parts'] = parts.get(rule, [])
            cost = sum((p['qty'] * p['rate'] for p in row['parts']), Decimal('0'))
            row['amount'] = _d(cost)
            row['rate'] = _d(cost / qty) if qty else Decimal('0')
            if row['parts']:
                row['basis'] = f"{basis} — 1 {PIECES[rule].lower()[:-1] if rule != 'shelves' else 'shelf'} = " + \
                    ' + '.join(f"{p['basic_component'].name} {_d(p['qty'] / qty)} {p['unit']}" for p in row['parts'])
        else:
            material, rate = price_for(bc, fc.default_material)
            row.update(_material_fields(material, rate))
            row['amount'] = _d(qty * row['rate'])
        rows.append(row)
    return rows, calc
