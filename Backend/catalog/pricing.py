"""
Turn a furniture + size into its estimate rows (shared by the catalogue preview
and Initial Estimate generation).

    price_for(component, material)   → which raw material prices a row, and its rate
    breakdown(furniture, W, H, D, …) → one dict per furniture component, with
                                       quantity (from catalog/rules.py), rate and basis
"""
from decimal import Decimal, ROUND_HALF_UP

from . import rules

# Units that are counted or bought whole; a scaled quantity keeps that grain.
SHEET_UNITS = {'sheet', 'sheets'}
MEASURED_UNITS = {'sft', 'rft', 'sqm', 'm', 'mtr', 'feet', 'ft', 'litre'}


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


def scaled_quantity(component, width, height):
    """
    A furniture row's fixed quantity at another size → (qty, basis), or None
    when it doesn't scale. The quantity is what the furniture needs at its
    default size; it grows with the front area (ply, liner, laminate, carpentry)
    or the width (edging, lights). Sheets stay in quarter sheets and whole
    counts stay whole.
    """
    base = component.fixed_qty
    if base is None or not component.scaling or not base:
        return None
    furniture = component.furniture
    w0, h0, _ = size_inches(furniture.default_length, furniture.default_height, '')
    if component.scaling == 'area':
        if not (w0 and h0 and width and height):
            return None
        ratio = (width * height) / (w0 * h0)
        how = f"{rules.fmt_in(width)} × {rules.fmt_in(height)} against {rules.fmt_in(w0)} × {rules.fmt_in(h0)}"
    else:
        if not (w0 and width):
            return None
        ratio = width / w0
        how = f"width {rules.fmt_in(width)} against {rules.fmt_in(w0)}"
    if abs(ratio - 1) < 1e-9:
        return None
    unit = component.row_unit.strip().lower()
    if unit in SHEET_UNITS:
        step = Decimal('0.25')
    elif unit not in MEASURED_UNITS and base == base.to_integral_value():
        step = Decimal('1')
    else:
        step = Decimal('0.01')
    raw = base * Decimal(str(ratio))
    qty = max((raw / step).quantize(Decimal('1'), rounding=ROUND_HALF_UP) * step, step)
    return qty, f"{base.normalize():f} at the standard size × {ratio:.2f} ({how}) = {raw:.2f} → {qty.normalize():f}"


def breakdown(furniture, width, height, depth, options=None):
    """
    Rows for one furniture piece, in component order:
        {component, basic_component, item_type, specification, brand, model,
         raw_material, qty, unit, rate, price_unit, gst_pct, margin_pct,
         quantity_rule, basis, needs_input, application}
    plus the rules summary (counts, warnings).
    """
    calc = rules.compute(furniture.cabinet_type, width, height, depth, options)
    rows = []
    components = (furniture.components.filter(is_active=True)
                  .select_related('furniture', 'basic_component__library_category',
                                  'default_material__brand', 'default_material__category'))
    for fc in components:
        bc = fc.basic_component
        qty, basis, needs = calc.quantity(bc.quantity_rule, fc.fixed_qty, bc.default_qty)
        rule = bc.quantity_rule if fc.fixed_qty is None else 'fixed'
        scaled = scaled_quantity(fc, width, height)
        if scaled is not None:
            (qty, basis), rule = scaled, 'scaled'
        item_type = fc.row_type
        spec = item_type == 'Spec Purpose'
        # Counts (Doors, Shelves …) carry no price unless the furniture pins one (Design, per sft).
        material, rate = ((None, Decimal('0')) if spec and fc.default_material_id is None
                          else price_for(bc, fc.default_material))
        if fc.rate is not None:
            rate = fc.rate
            if fc.default_material_id is None:
                material = None     # priced on the furniture itself, not from a raw material
        model = material.model_name if material else ''
        rows.append({
            'component': fc,
            'basic_component': bc,
            'item_type': item_type,
            'specification': bc.name,
            'brand': material.brand.name if material and material.brand_id else '',
            # A material named after its component is a placeholder for "no model".
            'model': '' if model == bc.name else model,
            'raw_material': material,
            'qty': qty,
            'unit': fc.row_unit,
            'rate': Decimal(rate),
            'price_unit': fc.row_price_unit,
            'gst_pct': bc.gst_pct,
            'margin_pct': fc.row_margin_pct,
            'quantity_rule': rule,
            'basis': basis,
            'needs_input': needs,
            'application': fc.application or (application_text(bc.quantity_rule, qty, options) if spec else ''),
        })
    return rows, calc
