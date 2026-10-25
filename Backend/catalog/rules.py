"""
NICARA — Estimate quantity rules (Sriniketh's calculation sheet)

Turns a furniture's cabinet type, size and options into the quantity of every
estimate row, following "Calculations.xlsx" → Sheet1 (rule book) and Sheet3
(verticals). Every result carries a plain-English `basis` so it can be checked
against the sheet.

    ┌────────────────────────────────────────────────────────────────────┐
    │  All constants live in RULES. Points the sheet leaves ambiguous are │
    │  marked  # FLAG  — they follow the written wording until Sriniketh  │
    │  confirms (see docs/calculation-questions.md).                      │
    └────────────────────────────────────────────────────────────────────┘

All geometry is in inches (sizes are converted from ft+in first, as the video
instructs); areas are reported in sft, lengths in metres.
"""
import math
import re
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP

SQIN_PER_SFT = 144
IN_PER_M = 39.3701

RULES = {
    # "whole number between a and b": 'inclusive_min' = smallest whole number
    # ≥ the lower bound (Sheet1 says "min"; the 7-ft worked wardrobe → 4 doors).
    # 'strict' = smallest whole number > the lower bound (the video's 48" pooja → 3).
    # 'max' = largest whole number ≤ the upper bound (the sample estimate's
    # 8-ft and 9-ft wardrobes → 6 doors).                                # FLAG
    'between_mode': 'inclusive_min',

    # Doors — Sheet1 row 5 (each door between these widths, inches)
    'door_width_openable': (16, 24),
    'door_width_sliding': (30, 42),
    'kitchen_basket_width': 36,          # tandem baskets, 3 ft
    'kitchen_bottle_pullout_width': 10,

    # Drawers — Sheet1 row 4
    'pooja_single_drawer_below': 24,      # pooja < 24" wide → 1 drawer
    'pooja_drawer_width': (12, 24),       # else whole no. between W/24 and W/12
    'study_drawer_width': (12, 24),       # FLAG: rule only given for W < 48"

    # Drawer box — Sheet1 row 7
    'drawer_depth_less': 4,               # drawer depth = cabinet depth − 4"
    'drawer_height': 8,

    # Hinges — Sheet1 row 25: 0–2 ft → 2, +1 per additional 2 ft  # FLAG (sheet: 14 vs rule 24)
    'hinge_base_height': 24,
    'hinge_base_count': 2,
    'hinge_step_height': 24,

    # Sheets
    'sheet_sft': 32,                      # 8x4 ply / laminate sheet
    'ply_round_sft': 32,                  # notes: "multiple of 16 or 32"  # FLAG
    'finish_sheet_sft': 32,

    # Consumables — Sheet1 rows 20, 21
    'adhesive_kg_per_ply_sheet': Decimal('1.5'),
    'tape_m_per_ply_sheet': 25,
    'tape_roll_m': 100,                   # FLAG: sheet prices tape per roll, gives no roll length

    # Kitchen — Sheet1 rows 30, 34
    'unit_top_wastage': Decimal('0.15'),
    'dado_height': 24,
}

# Rule keys a Basic Component can use, with a label for the catalogue UI.
RULE_CHOICES = [
    ('doors', 'Doors — from cabinet width'),
    ('drawers', 'Drawers — from doors / width'),
    ('shelves', 'Shelves — from doors'),
    ('carcass_ply', 'Carcass ply (sides, verticals, top, bottom, shelves, shutters) — sft'),
    ('back_panel_ply', 'Back panel ply (width × height) — sft'),
    ('drawer_box_ply', 'Drawer box ply — sft'),
    ('glass_shelves', 'Glass shelves — sft'),
    ('finish_sheets', 'Finish (laminate / acrylic / veneer) — sft, whole sheets'),
    ('inner_liner', 'Inner liner — sft (ply × 2 − finish sheets)'),
    ('profile_doors', 'Profile doors — door area sft'),
    ('hinges', 'Box hinges — by door height'),
    ('drawer_channels', 'Drawer channels — 1 set per drawer'),
    ('handles', 'Handles — 1 per door'),
    ('knobs', 'Knobs — 1 per drawer'),
    ('drawer_locks', 'Drawer locks — drawers ÷ 2 (wardrobes)'),
    ('adhesive_bonding', 'Adhesive (bonding) — ply sheets × 1.5 kg'),
    ('adhesive_support', 'Adhesive (support / masking tape) — rolls'),
    ('edge_banding', 'Edge banding — door perimeters, metres'),
    ('carpentry', 'Carpentry — width × height sft'),
    ('unit_top', 'Unit / counter top — width × depth + 15%'),
    ('counter_top_fixing', 'Counter top fixing — unit top area sft'),
    ('dado_tiles', 'Dado tiles — width × 2 ft'),
    ('fixed', 'Fixed quantity'),
    ('manual', 'Manual entry'),
]
RULE_KEYS = {key for key, _ in RULE_CHOICES}
SPEC_RULES = ('doors', 'drawers', 'shelves')   # counts a user may override group-wide

WARDROBES = {'wardrobe_openable', 'wardrobe_sliding'}


# ════════════════════════════════════════════════════════════════
# Helpers
# ════════════════════════════════════════════════════════════════

def d2(value):
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def whole_between(a, b, mode=None):
    """Sheet1's "whole number between a and b"."""
    mode = mode or RULES['between_mode']
    lo, hi = sorted((float(a), float(b)))
    if mode == 'max':
        n = math.floor(hi + 1e-9)
        return n if n >= lo - 1e-9 else math.ceil(lo - 1e-9)
    if mode == 'strict':
        n = math.floor(lo) + 1
        return n if n <= hi + 1e-9 else math.ceil(lo - 1e-9)
    return math.ceil(lo - 1e-9)


def to_inches(ft=0, inch=0):
    return float(ft or 0) * 12 + float(inch or 0)


def parse_inches(text):
    """Designer-written size → inches: 8'0", 8', 2'6", 30", 600mm, 60cm, 1.2m, 8ft.
    A bare number ≤ 20 is read as feet (how the sheets are written), else inches."""
    if text is None:
        return None
    s = str(text).strip().lower().replace('’', "'").replace('”', '"').replace("''", '"')
    if not s or s in {'-', '—'}:
        return None
    m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*(?:(\d+(?:\.\d+)?)\s*(?:\"|in|inch|inches)?)?", s)
    if m:
        return float(m.group(1)) * 12 + float(m.group(2) or 0)
    m = re.fullmatch(r'(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)', s)
    if m:
        return float(m.group(1))
    m = re.fullmatch(r'(\d+(?:\.\d+)?)\s*(mm|cm|m)', s)
    if m:
        return float(m.group(1)) * {'mm': 1, 'cm': 10, 'm': 1000}[m.group(2)] / 25.4
    m = re.fullmatch(r'(\d+(?:\.\d+)?)', s)
    if m:
        n = float(m.group(1))
        return n * 12 if n <= 20 else n
    return None


def ft_in(inches):
    """inches → (ft, in) ints, e.g. 114 → (9, 6)."""
    total = int(round(inches or 0))
    return total // 12, total % 12


def fmt_in(inches):
    ft, inch = ft_in(inches)
    return f"{ft}'{inch}\""


def _sheets(sft, sheet=None):
    sheet = sheet or RULES['sheet_sft']
    return math.ceil(sft / sheet - 1e-9) if sft > 1e-9 else 0


def _round_up(sft, step):
    return math.ceil(sft / step - 1e-9) * step if sft > 1e-9 else 0


# ════════════════════════════════════════════════════════════════
# Calculation
# ════════════════════════════════════════════════════════════════

@dataclass
class Calculation:
    cabinet_type: str
    width: float
    height: float
    depth: float
    options: dict
    counts: dict = field(default_factory=dict)
    geometry: dict = field(default_factory=dict)
    results: dict = field(default_factory=dict)   # rule → (qty, basis)
    # rule → {'doors'|'drawers'|'shelves': weight, '_total': weight}: how much of
    # a rule's quantity goes into the pieces (door shutters, shelf boards, drawer
    # boxes, hinges …), so Doors / Drawers / Shelves can be priced per piece.
    shares: dict = field(default_factory=dict)
    part_notes: dict = field(default_factory=dict)  # (rule, piece) → short detail
    warnings: list = field(default_factory=list)

    def quantity(self, rule, fixed_qty=None, default_qty=1):
        """(qty Decimal, basis str, needs_input bool) for one basic component."""
        if fixed_qty is not None:
            return d2(fixed_qty), 'fixed quantity for this furniture', False
        if rule == 'fixed':
            return d2(default_qty), 'default quantity', False
        if rule == 'manual':
            return d2(default_qty), 'manual entry — set the quantity', True
        if rule not in self.results:
            return d2(0), f'rule "{rule}" not applicable to {self.cabinet_type}', False
        qty, basis = self.results[rule]
        return d2(qty), basis, False

    def summary(self):
        return {
            'cabinet_type': self.cabinet_type,
            'size_in': {'width': self.width, 'height': self.height, 'depth': self.depth},
            'size': f"{fmt_in(self.width)} × {fmt_in(self.height)} × {fmt_in(self.depth)}",
            'counts': self.counts,
            'geometry': {k: round(v, 2) if isinstance(v, float) else v for k, v in self.geometry.items()},
            'results': {k: {'qty': float(d2(q)), 'basis': b} for k, (q, b) in self.results.items()},
            'warnings': self.warnings,
        }


def compute(cabinet_type, width, height, depth, options=None):
    """
    Size in inches + options →
        {doors, drawers, shelves, verticals} counts and a quantity per rule.

    options: shelf_type ('ply'|'glass'), one_side_visible (bool),
             handleless (bool), overrides {'doors'|'drawers'|'shelves': int}
    """
    o = dict(options or {})
    overrides = {k: int(v) for k, v in (o.get('overrides') or {}).items()
                 if k in SPEC_RULES and v not in (None, '')}
    W, H, D = float(width or 0), float(height or 0), float(depth or 0)
    calc = Calculation(cabinet_type, W, H, D, o)
    R, res, warn = RULES, calc.results, calc.warnings
    if W <= 0 or H <= 0:
        warn.append('Width and height are needed to calculate quantities.')
    if D <= 0 and cabinet_type != 'panel':
        warn.append('Depth is missing — ply and unit-top areas will be understated.')

    # ── Doors (Sheet1 row 5) ───────────────────────────────────
    usable_w = W
    if cabinet_type == 'panel':
        doors, doors_basis = 0, 'no doors on a panel'
    elif cabinet_type == 'kitchen_base':
        usable_w = max(0.0, W - R['kitchen_basket_width'] - R['kitchen_bottle_pullout_width'])
        lo, hi = R['door_width_openable']
        doors = whole_between(usable_w / hi, usable_w / lo) if usable_w else 0
        doors_basis = (f"(width {W:g}\" − basket {R['kitchen_basket_width']}\" − bottle pull-out "
                       f"{R['kitchen_bottle_pullout_width']}\") = {usable_w:g}\"; whole no. between "
                       f"{usable_w:g}/{hi} and {usable_w:g}/{lo}")
    elif cabinet_type == 'wardrobe_sliding':
        lo, hi = R['door_width_sliding']
        doors = max(1, whole_between(W / hi, W / lo)) if W else 0
        doors_basis = f"sliding: whole no. between {W:g}/{hi} and {W:g}/{lo}"
    else:
        lo, hi = R['door_width_openable']
        doors = max(1, whole_between(W / hi, W / lo)) if W else 0
        doors_basis = f"openable: whole no. between {W:g}/{hi} = {W / hi:.2f} and {W:g}/{lo} = {W / lo:.2f}"
    if 'doors' in overrides:
        doors, doors_basis = overrides['doors'], f'set to {overrides["doors"]} (calculated {doors})'
    res['doors'] = (doors, doors_basis)

    # ── Drawers (Sheet1 row 4) ─────────────────────────────────
    if cabinet_type == 'wardrobe_openable':
        drawers, basis = doors, 'openable wardrobe: = no. of doors'
    elif cabinet_type == 'wardrobe_sliding':
        drawers, basis = doors * 2, 'sliding wardrobe: = no. of doors × 2'
    elif cabinet_type == 'pooja':
        if W < R['pooja_single_drawer_below']:
            drawers, basis = 1, f"pooja under {R['pooja_single_drawer_below']}\" wide: 1"
        else:
            lo, hi = R['pooja_drawer_width']
            drawers = whole_between(W / hi, W / lo)
            basis = f"pooja: whole no. between {W:g}/{hi} and {W:g}/{lo}"
    elif cabinet_type == 'study':
        lo, hi = R['study_drawer_width']
        drawers = whole_between(W / hi, W / lo) if W else 0
        basis = f"study: whole no. between {W:g}/{hi} and {W:g}/{lo}"
    elif cabinet_type == 'tv_unit':
        drawers, basis = doors, 'TV unit: = no. of doors (not in Sheet1)'   # FLAG
    else:
        drawers, basis = 0, 'no drawers by default for this cabinet type'
    if 'drawers' in overrides:
        drawers, basis = overrides['drawers'], f'set to {overrides["drawers"]} (calculated {drawers})'
    res['drawers'] = (drawers, basis)

    # ── Shelves (Sheet1 row 6) ─────────────────────────────────
    # Width: Sheet1 writes cabinet width ÷ (doors × 2), which gives a 10½" shelf
    # on a 7-ft wardrobe. A shelf spans one section between verticals, so it is
    # taken as width ÷ sections (sections = verticals − 1).           # FLAG
    verticals = math.ceil(doors / 2 + 1) if doors else 2      # Sheet3: ROUNDUP(doors/2+1)
    sections = max(1, verticals - 1)
    shelf_d = D
    if cabinet_type in ('loft_frame', 'loft_box', 'panel'):
        shelves, shelf_w, basis = 0, 0.0, 'no shelves for this cabinet type'
    elif cabinet_type == 'crockery_wall':
        shelves = doors
        shelf_w = W / sections if doors else 0.0
        basis = f"crockery wall: = no. of doors; width {W:g}/{sections} sections = {shelf_w:.1f}\""
    elif cabinet_type == 'wardrobe_sliding':
        shelves = math.ceil(doors / 2)                                    # FLAG: qty not given
        shelf_w = W / doors if doors else 0.0
        basis = f"sliding: width {W:g}/{doors}; qty doors/2"
    else:
        shelves = math.ceil(doors / 2)
        shelf_w = W / sections if doors else 0.0
        basis = (f"no. of doors/2; width {W:g}/{sections} sections = {shelf_w:.1f}\", "
                 f"depth {shelf_d:g}\"")
    if 'shelves' in overrides:
        shelves, basis = overrides['shelves'], f'set to {overrides["shelves"]} (calculated {shelves})'
    res['shelves'] = (shelves, basis)

    door_w = usable_w / doors if doors else 0.0
    door_h = H
    drawer_w = door_w
    drawer_d = max(0.0, D - R['drawer_depth_less'])
    drawer_h = R['drawer_height']
    calc.counts = {'doors': doors, 'drawers': drawers, 'shelves': shelves, 'verticals': verticals}
    calc.geometry = {'door_width': door_w, 'door_height': door_h, 'shelf_width': shelf_w,
                     'shelf_depth': shelf_d, 'drawer_width': drawer_w, 'drawer_depth': drawer_d,
                     'drawer_height': drawer_h}

    # ── Plywood (Sheet1 rows 7, 8, 16; Sheet3) ─────────────────
    glass = o.get('shelf_type') == 'glass'
    door_area = doors * door_w * door_h
    shelf_area = shelves * shelf_w * shelf_d
    if cabinet_type == 'panel':
        carcass_sqin, carcass_parts = W * H, 'panel width × height'
    else:
        top_bottom = 0 if cabinet_type == 'loft_frame' else 2 * W * D
        carcass_sqin = verticals * H * D + top_bottom + door_area + (0 if glass else shelf_area)
        carcass_parts = (f"{verticals} verticals × {H:g}×{D:g}"
                         + (f" + top/bottom 2×{W:g}×{D:g}" if top_bottom else '')
                         + (f" + {shelves} shelves {shelf_w:.1f}×{shelf_d:g}" if shelf_area and not glass else '')
                         + (f" + {doors} shutters {door_w:.1f}×{door_h:g}" if door_area else ''))
    step = R['ply_round_sft']

    def ply(sqin, parts):
        sft = sqin / SQIN_PER_SFT
        qty = _round_up(sft, step)
        return qty, f"{parts} = {sft:.1f} sft → {qty} sft ({qty // R['sheet_sft'] if step == R['sheet_sft'] else qty / R['sheet_sft']:g} sheet(s))"

    res['carcass_ply'] = ply(carcass_sqin, carcass_parts)
    back_sqin = 0 if cabinet_type in ('loft_frame', 'panel') else W * H
    res['back_panel_ply'] = ply(back_sqin, f"back {W:g}×{H:g}")
    box_sqin = drawers * (2 * drawer_d * drawer_h + 2 * drawer_w * drawer_h + drawer_w * drawer_d)
    res['drawer_box_ply'] = ply(box_sqin, f"{drawers} drawers × (2 sides {drawer_d:g}×{drawer_h} + "
                                          f"front/back {drawer_w:.1f}×{drawer_h} + bottom)")
    res['glass_shelves'] = ((round(shelf_area / SQIN_PER_SFT, 2) if glass else 0),
                            f"{shelves} glass shelves {shelf_w:.1f}×{shelf_d:g}" if glass else 'shelves are ply')
    ply_sheets = sum(res[k][0] for k in ('carcass_ply', 'back_panel_ply', 'drawer_box_ply')) / R['sheet_sft']

    # ── Finish & liner (Sheet1 rows 18, 19, 27, 28, 29) ────────
    side = D * H if o.get('one_side_visible') else 0
    finish_sft = (door_area + side) / SQIN_PER_SFT
    finish_sheets = _sheets(finish_sft, R['finish_sheet_sft'])
    res['finish_sheets'] = (finish_sheets * R['finish_sheet_sft'],
                            f"door area {door_area / SQIN_PER_SFT:.1f} sft"
                            + (f" + visible side {side / SQIN_PER_SFT:.1f} sft" if side else '')
                            + f" ÷ 32 → {finish_sheets} sheet(s)")
    liner_sheets = max(0, math.ceil(ply_sheets * 2 - 1e-9) - finish_sheets)
    res['inner_liner'] = (liner_sheets * R['sheet_sft'],
                          f"ply {ply_sheets:g} sheets × 2 − {finish_sheets} finish sheets = {liner_sheets} sheets")
    res['profile_doors'] = (round(door_area / SQIN_PER_SFT, 2), f"door area {doors} × {door_w:.1f}×{door_h:g}")

    # ── Hardware (Sheet1 rows 17, 25, 26, 32, 40) ──────────────
    if cabinet_type == 'wardrobe_sliding' or not doors:
        hinges, basis = 0, 'no hinges (sliding / no doors)'
    else:
        extra = math.ceil(max(0.0, door_h - R['hinge_base_height']) / R['hinge_step_height'] - 1e-9)
        per_door = R['hinge_base_count'] + extra
        hinges = per_door * doors
        basis = f"door height {door_h:g}\": {R['hinge_base_count']} + {extra} = {per_door} per door × {doors}"
    res['hinges'] = (hinges, basis)
    res['drawer_channels'] = (drawers, f"1 set per drawer × {drawers}")
    handleless = bool(o.get('handleless'))
    res['handles'] = (0 if handleless else doors, 'handleless design' if handleless else f"1 per door × {doors}")
    res['knobs'] = (0 if handleless else drawers, 'handleless design' if handleless else f"1 per drawer × {drawers}")
    locks = drawers // 2 if cabinet_type in WARDROBES else 0
    res['drawer_locks'] = (locks, f"drawers {drawers} ÷ 2" if cabinet_type in WARDROBES else 'wardrobes only')

    # ── Consumables (Sheet1 rows 20, 21, 39) ───────────────────
    kg = Decimal(str(ply_sheets)) * R['adhesive_kg_per_ply_sheet']
    res['adhesive_bonding'] = (kg, f"{ply_sheets:g} ply sheets × {R['adhesive_kg_per_ply_sheet']} kg")
    tape_m = ply_sheets * R['tape_m_per_ply_sheet']
    rolls = math.ceil(tape_m / R['tape_roll_m'] - 1e-9) if tape_m else 0
    res['adhesive_support'] = (rolls, f"{ply_sheets:g} sheets × {R['tape_m_per_ply_sheet']} m = {tape_m:g} m "
                                      f"÷ {R['tape_roll_m']} m/roll")
    edge_in = doors * 2 * (door_w + door_h)
    res['edge_banding'] = (round(edge_in / IN_PER_M, 2),
                           f"{doors} doors × 2 × ({door_w:.1f}\" + {door_h:g}\") = {edge_in:.0f}\"")

    # ── What each piece takes (per-piece pricing) ──────────────
    # Area-based rules are split by area, so the off-cut of the rounded sheets
    # is shared too; the counts (hinges, channels …) go wholly to their piece.
    shelf_ply = 0 if glass else shelf_area
    calc.shares = {
        'carcass_ply': {'doors': door_area, 'shelves': shelf_ply, '_total': carcass_sqin},
        'finish_sheets': {'doors': door_area, '_total': door_area + side},
        # Liner by lined faces: doors one (inner), shelves and drawer boxes
        # both, carcass panels both, back one.
        'inner_liner': {'doors': door_area, 'shelves': 2 * shelf_ply, 'drawers': 2 * box_sqin,
                        '_total': 2 * (carcass_sqin - door_area) + door_area + back_sqin + 2 * box_sqin},
        'drawer_box_ply': {'drawers': box_sqin, '_total': box_sqin},
        'glass_shelves': {'shelves': 1, '_total': 1} if glass else {},
        'edge_banding': {'doors': 1, '_total': 1},
        'hinges': {'doors': 1, '_total': 1},
        'handles': {'doors': 1, '_total': 1},
        'knobs': {'drawers': 1, '_total': 1},
        'drawer_channels': {'drawers': 1, '_total': 1},
    }
    calc.part_notes = {
        ('carcass_ply', 'doors'): f"shutters {door_w:.1f}\" × {door_h:g}\"",
        ('carcass_ply', 'shelves'): f"shelf boards {shelf_w:.1f}\" × {shelf_d:g}\"",
        ('finish_sheets', 'doors'): 'outer face',
        ('inner_liner', 'doors'): 'inner face',
        ('inner_liner', 'shelves'): 'both faces',
        ('inner_liner', 'drawers'): 'box lining',
        ('drawer_box_ply', 'drawers'): f"boxes {drawer_w:.1f}\" × {drawer_d:g}\" × {drawer_h}\"",
        ('glass_shelves', 'shelves'): f"glass {shelf_w:.1f}\" × {shelf_d:g}\"",
        ('edge_banding', 'doors'): 'door edges',
        ('hinges', 'doors'): f"{res['hinges'][0] // doors if doors else 0} per door",
        ('handles', 'doors'): '1 per door',
        ('knobs', 'drawers'): '1 per drawer',
        ('drawer_channels', 'drawers'): '1 set per drawer',
    }

    # ── Service & kitchen (Sheet1 rows 23, 30, 31, 34) ─────────
    res['carpentry'] = (round(W * H / SQIN_PER_SFT, 2), f"width × height {W:g}\" × {H:g}\"")
    top = W * D / SQIN_PER_SFT * float(1 + R['unit_top_wastage'])
    res['unit_top'] = (round(top, 2), f"{W:g}\" × {D:g}\" + {R['unit_top_wastage'] * 100:g}% wastage")
    res['counter_top_fixing'] = (round(top, 2), 'area of unit top')
    res['dado_tiles'] = (round(W * R['dado_height'] / SQIN_PER_SFT, 2),
                         f"{W:g}\" × {R['dado_height']}\" dado height")
    return calc
