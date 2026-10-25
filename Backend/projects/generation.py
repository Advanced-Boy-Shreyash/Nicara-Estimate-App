"""
Initial Estimate generation — furniture + size → the calculation sheet's rows.

Each furniture piece becomes a *group* of estimate rows sharing a group_key:
Spec Purpose rows (Doors, Drawers, Shelves), Procurement rows (ply, liner,
adhesive, …) and Service rows (carpentry, fixing). Quantities come from
catalog/rules.py; brand, model and rate from the Raw Material Library.

Doors, Drawers and Shelves are priced per piece: their material (shutter ply,
laminate, hinges, handles; drawer boxes, channels, knobs; shelf boards, lining)
is stored as the row's component breakdown, and taken out of the material rows.

    create_group()         add one furniture piece to an estimate
    recalculate_group()    re-run the rules after a size / option / count change —
                           typed-over quantities and chosen brands are kept
    set_spec_count()       a Doors/Drawers/Shelves edit cascades through its group
    generate_from_design() create or refresh a group for every design requirement
"""
import uuid
from decimal import Decimal

from django.db import transaction

from catalog import rules
from catalog.pricing import application_text, breakdown, size_inches

from .models import EstimateItem, EstimateItemComponent


def _dims(width, height, depth):
    w_ft, w_in = rules.ft_in(width)
    h_ft, h_in = rules.ft_in(height)
    d_ft, d_in = rules.ft_in(depth)
    return {
        'width_ft': w_ft, 'width_in': w_in, 'height_ft': h_ft, 'height_in': h_in,
        'depth_ft': d_ft, 'depth_in': d_in,
        'length': rules.fmt_in(width) if width else '',
        'breadth': rules.fmt_in(depth) if depth else '',
        'height': rules.fmt_in(height) if height else '',
    }


def row_size(row):
    """A row's size in inches, from its ft/in columns."""
    return (rules.to_inches(row.width_ft, row.width_in),
            rules.to_inches(row.height_ft, row.height_in),
            rules.to_inches(row.depth_ft, row.depth_in))


def write_parts(row, parts):
    """Replace a Doors/Drawers/Shelves row's breakdown with `parts` (from
    catalog.pricing.breakdown). A brand/model or price already chosen for a
    part (matched by its basic component) is kept."""
    kept = {c.basic_component: c for c in row.components.all()}
    row.components.all().delete()
    new = []
    for sno, part in enumerate(parts, start=1):
        name = part['basic_component'].name
        old = kept.get(name)
        if old is not None and (old.library_material_item_id or old.price):
            material, brand, model, price = old.library_material_item, old.brand, old.model, old.price
        else:
            material, brand, model, price = part['raw_material'], part['brand'], part['model'], part['rate']
        qty = part['qty']
        new.append(EstimateItemComponent(
            estimate_item=row, sno=sno, basic_component=name, detail=part['detail'][:150],
            brand=brand, model=model, qty=qty, unit=part['unit'], price=price,
            amount=rules.d2(qty * price), library_material_item=material,
        ))
    EstimateItemComponent.objects.bulk_create(new)
    row.recompute_amount()


def group_rows(estimate, group_key):
    return list(EstimateItem.objects.filter(estimate=estimate, group_key=group_key)
                .select_related('furniture', 'basic_component').order_by('sno', 'id'))


@transaction.atomic
def create_group(estimate, furniture, width, height, depth, *, options=None, area='', zone='',
                 item_name='', design_requirement=None):
    """Add one furniture piece; returns (rows, calculation)."""
    options = dict(options or {})
    rows, calc = breakdown(furniture, width, height, depth, options)
    key = uuid.uuid4().hex
    dims = _dims(width, height, depth)
    created = [
        _new_row(estimate, key, furniture, r, dims, options, area=area, zone=zone,
                 item_name=item_name or furniture.name, design_requirement=design_requirement)
        for r in rows
    ]
    return created, calc


def _new_row(estimate, key, furniture, r, dims, options, *, area, zone, item_name, design_requirement, sno=0):
    row = EstimateItem.objects.create(
        estimate=estimate, group_key=key, design_requirement=design_requirement, sno=sno,
        furniture=furniture, basic_component=r['basic_component'], raw_material=r['raw_material'],
        area=area, zone=zone, item=item_name, **dims,
        item_type=r['item_type'], specification=r['specification'],
        brand=r['brand'], model_name=r['model'], application=r['application'],
        qty=r['qty'], calculated_qty=r['qty'], unit=r['unit'],
        rate=r['rate'], price_unit=r['price_unit'],
        margin_pct=furniture.margin_pct, gst_pct=r['gst_pct'],
        quantity_rule=r['quantity_rule'], calc_basis=r['basis'][:500],
        flag=r['needs_input'], config=options,
    )
    if r['parts']:
        write_parts(row, r['parts'])
    return row


@transaction.atomic
def recalculate_group(estimate, group_key, *, width=None, height=None, depth=None, options=None,
                      area=None, zone=None, item_name=None):
    """
    Re-run the rules for a group. Sizes/options not given keep their current
    values. Rows whose quantity was typed over keep it (their calculated value
    and basis still refresh); fixed-quantity rows are left alone. Doors /
    Drawers / Shelves rebuild their per-piece breakdown; a material row whose
    whole quantity now sits in those pieces is removed, and one that gets a
    quantity back (e.g. a visible side to laminate) is added again.
    """
    rows = group_rows(estimate, group_key)
    if not rows:
        raise LookupError('No rows in that group.')
    first = rows[0]
    cur_w, cur_h, cur_d = row_size(first)
    width = cur_w if width is None else width
    height = cur_h if height is None else height
    depth = cur_d if depth is None else depth
    current = dict(first.config or {})
    if options is None:
        options = current
    else:
        options = dict(options)
        # Changing shelves/handles/size must not silently drop typed
        # door/drawer/shelf counts; send "overrides": {} to clear them.
        if 'overrides' not in options and current.get('overrides'):
            options['overrides'] = current['overrides']
    furniture = first.furniture
    dims = _dims(width, height, depth)
    plan, calc, linked = {}, None, set()
    if furniture is not None:
        planned, calc = breakdown(furniture, width, height, depth, options)
        plan = {r['basic_component'].id: r for r in planned}
        linked = set(furniture.components.values_list('basic_component_id', flat=True))

    seen, kept = set(), []
    for row in rows:
        r = plan.get(row.basic_component_id)
        if (r is None and row.basic_component_id in linked and row.quantity_rule != 'fixed'
                and not row.qty_overridden):
            row.delete()            # its whole quantity is now inside the doors / drawers / shelves
            continue
        for field, value in dims.items():
            setattr(row, field, value)
        row.config = options
        if area is not None:
            row.area = area
        if zone is not None:
            row.zone = zone
        if item_name is not None:
            row.item = item_name
        if r is not None:
            seen.add(row.basic_component_id)
            if row.quantity_rule != 'fixed':
                row.calculated_qty, row.calc_basis = r['qty'], r['basis'][:500]
                if not row.qty_overridden:
                    row.qty = r['qty']
                    row.flag = r['needs_input']
            if row.item_type == 'Spec Purpose':
                row.application = application_text(row.quantity_rule, row.qty, options)
        row.save()
        if r is not None and row.item_type == 'Spec Purpose':
            write_parts(row, r['parts'])
        kept.append(row)

    if calc is not None:
        sno = max((r.sno for r in kept), default=0)
        for bc_id, r in plan.items():
            if bc_id in seen or r['quantity_rule'] not in calc.shares:
                continue
            kept.append(_new_row(estimate, group_key, furniture, r, dims, options,
                                 area=kept[0].area if kept else first.area,
                                 zone=kept[0].zone if kept else first.zone,
                                 item_name=kept[0].item if kept else first.item,
                                 design_requirement=first.design_requirement, sno=sno))
    return kept, calc


def set_spec_count(estimate, row, count):
    """Doors / Drawers / Shelves typed in → stored as a group override, so
    channels, hinges, ply, locks, … follow the new count."""
    options = dict(row.config or {})
    overrides = dict(options.get('overrides') or {})
    if count is None:
        overrides.pop(row.quantity_rule, None)
    else:
        overrides[row.quantity_rule] = int(count)
    options['overrides'] = overrides
    return recalculate_group(estimate, row.group_key, options=options)


def reset_row_qty(estimate, row):
    """Undo a typed-over quantity (or a door/drawer/shelf count override)."""
    if row.quantity_rule in rules.SPEC_RULES and row.group_key:
        return set_spec_count(estimate, row, None)
    row.qty_overridden = False
    if row.calculated_qty is not None:
        row.qty = row.calculated_qty
    row.save()
    return [row], None


def requirement_size(dr):
    """A design requirement's size in inches; blanks fall back to the furniture defaults."""
    f = dr.furniture
    return size_inches(dr.length or f.default_length, dr.height or f.default_height,
                       dr.breadth or f.default_breadth)


@transaction.atomic
def generate_from_design(estimate):
    """
    Create a group for every design requirement linked to a furniture, or —
    when the estimate already has one for it — refresh it to the requirement's
    current size and options (follows size edits, keeps price/brand choices).
    """
    created, updated, skipped = 0, 0, []
    requirements = (estimate.project.design_requirements
                    .select_related('furniture').order_by('sort_order', 'id'))
    for dr in requirements:
        if not dr.furniture_id:
            if dr.unit.strip():
                skipped.append(dr.unit)
            continue
        width, height, depth = requirement_size(dr)
        name = dr.unit.strip() or dr.furniture.name
        key = (EstimateItem.objects.filter(estimate=estimate, design_requirement=dr)
               .exclude(group_key='').values_list('group_key', flat=True).first())
        if key:
            recalculate_group(estimate, key, width=width, height=height, depth=depth,
                              options=dr.options or {}, area=dr.room, zone=dr.zone, item_name=name)
            updated += 1
        else:
            create_group(estimate, dr.furniture, width, height, depth, options=dr.options or {},
                         area=dr.room, zone=dr.zone, item_name=name, design_requirement=dr)
            created += 1
    return {'created': created, 'updated': updated, 'skipped': skipped}


def qty_is_override(row, new_qty):
    """True when a typed quantity differs from what the rules calculated."""
    if row.calculated_qty is None:
        return False
    return Decimal(str(new_qty)).quantize(Decimal('0.01')) != row.calculated_qty
