"""
NICARA — Module registry for IAM.

One list, used by three things so they can never drift apart:

  * `PagePermission.page_id` choices (what an admin can grant)
  * the `HasModulePermission` DRF class (what the API enforces)
  * `/api/auth/iam/modules/` (what the frontend renders and filters the nav by)

Levels are ordered: none < view < edit < full.
"""

# (id, label, group, icon)
MODULES = [
    # Main
    ('dashboard',        'Dashboard',              'Main',             '📊'),
    ('projects',         'Projects',               'Main',             '📁'),

    # Project phases — these gate the sub-tabs inside a project
    ('clientreq',        'Client Requirements',    'Project Phases',   '📋'),
    ('furniture',        'Furniture Layout',       'Project Phases',   '🛋️'),
    ('moodboard',        'Mood Board',             'Project Phases',   '🎨'),
    ('initial',          'Initial Estimate',       'Project Phases',   '📊'),
    ('booking',          'Booking Form',           'Project Phases',   '📝'),
    ('design',           'Design',                 'Project Phases',   '✏️'),
    ('final',            'Final Estimate',         'Project Phases',   '📝'),
    ('pm',               'Project Management',     'Project Phases',   '⚙️'),
    ('handover',         'Handover',               'Project Phases',   '🏠'),

    # Tasks
    ('tasks',            'Tasks',                  'Tasks',            '✅'),

    # Vendors
    ('vendors_material', 'Material Suppliers',     'Vendors',          '🏭'),
    ('vendors_contract', 'Contractors',            'Vendors',          '👷'),

    # Customers
    ('leads',            'Leads',                  'Customers',        '🎯'),
    ('clients',          'Clients',                'Customers',        '👤'),

    # Finance
    ('finance',          'Finance',                'Finance',          '💳'),

    # Catalogue
    ('catalog',          'Furniture Catalogue',    'Catalogue',        '🗂️'),
    ('items',            'Items Catalogue',        'Catalogue',        '📦'),
    ('library',          'Material Library',       'Catalogue',        '🪵'),

    # Admin
    ('users',            'User Management',        'Admin',            '👥'),
    ('iam',              'IAM Settings',           'Admin',            '🔐'),
    ('masters',          'Stage & Site Masters',   'Admin',            '🏗️'),
]

MODULE_CHOICES = [(m[0], m[1]) for m in MODULES]
MODULE_IDS = {m[0] for m in MODULES}

LEVELS = ['none', 'view', 'edit', 'full']
LEVEL_RANK = {level: index for index, level in enumerate(LEVELS)}


def satisfies(held: str, required: str) -> bool:
    """True when `held` is at least as permissive as `required`."""
    return LEVEL_RANK.get(held or 'none', 0) >= LEVEL_RANK.get(required or 'view', 1)


def modules_payload():
    """Grouped module list for the IAM matrix UI."""
    grouped = {}
    for module_id, label, group, icon in MODULES:
        grouped.setdefault(group, []).append(
            {'id': module_id, 'label': label, 'icon': icon}
        )
    return [{'group': group, 'modules': mods} for group, mods in grouped.items()]


# ── Role templates ──────────────────────────────────────────
# Starting points an admin can apply, then fine-tune per user.

def _all(level):
    return {module_id: level for module_id in MODULE_IDS}


ROLE_TEMPLATES = {
    'admin': _all('full'),
    'designer': {
        **_all('none'),
        'dashboard': 'view', 'projects': 'edit',
        'clientreq': 'view', 'furniture': 'full', 'moodboard': 'full',
        'initial': 'edit', 'design': 'full', 'final': 'view',
        'booking': 'view', 'pm': 'view', 'handover': 'view',
        'tasks': 'edit', 'leads': 'edit', 'clients': 'view',
        'vendors_material': 'view', 'vendors_contract': 'view',
        'catalog': 'edit', 'items': 'view', 'library': 'view',
    },
    'supervisor': {
        **_all('none'),
        'dashboard': 'view', 'projects': 'view',
        'furniture': 'view', 'initial': 'view', 'design': 'view', 'final': 'view',
        'pm': 'full', 'handover': 'full', 'tasks': 'full',
        'vendors_material': 'view', 'vendors_contract': 'edit',
        'catalog': 'view', 'items': 'view', 'library': 'view',
    },
    'client': {
        **_all('none'),
        'clientreq': 'view', 'furniture': 'view', 'moodboard': 'view',
        'initial': 'view', 'design': 'view', 'final': 'view',
        'booking': 'view', 'handover': 'view',
    },
}


def template_for(role: str):
    """Default permission map for a role (falls back to no access)."""
    return dict(ROLE_TEMPLATES.get(role, _all('none')))
