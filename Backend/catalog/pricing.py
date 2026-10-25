"""
Turn a furniture + size into its estimate rows (shared by the catalogue preview
and Initial Estimate generation).

    price_for(component, material)   → which raw material prices a row, and its rate
    breakdown(furniture, W, H, D, …) → one dict per furniture component, with
                                       quantity (from catalog/rules.py), rate and basis
"""
from decimal import Decimal

from . import rules


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


def breakdown(furniture, width, height, depth, options=None):
    """
    Rows for one furniture piece, in component order:
        {component, basic_component, item_type, specification, brand, model,
         raw_material, qty, unit, rate, price_unit, gst_pct, quantity_rule,
         basis, needs_input, application}
    plus the rules summary (counts, warnings).
    """
    calc = rules.compute(furniture.cabinet_type, width, height, depth, options)
    rows = []
    components = (furniture.components.filter(is_active=True)
                  .select_related('basic_component__library_category',
                                  'default_material__brand', 'default_material__category'))
    for fc in components:
        bc = fc.basic_component
        qty, basis, needs = calc.quantity(bc.quantity_rule, fc.fixed_qty, bc.default_qty)
        spec = bc.item_type == 'Spec Purpose'
        material, rate = (None, Decimal('0')) if spec else price_for(bc, fc.default_material)
        rows.append({
            'component': fc,
            'basic_component': bc,
            'item_type': bc.item_type,
            'specification': bc.name,
            'brand': material.brand.name if material and material.brand_id else '',
            'model': material.model_name if material else '',
            'raw_material': material,
            'qty': qty,
            'unit': bc.unit,
            'rate': Decimal(rate),
            'price_unit': bc.price_unit,
            'gst_pct': bc.gst_pct,
            'quantity_rule': bc.quantity_rule if fc.fixed_qty is None else 'fixed',
            'basis': basis,
            'needs_input': needs,
            'application': fc.application or (application_text(bc.quantity_rule, qty, options) if spec else ''),
        })
    return rows, calc
