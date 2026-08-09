"""
NICARA — DRF permission classes backed by the IAM matrix.

Attach a module to a view and the matrix is enforced for real:

    class ItemListCreateView(generics.ListCreateAPIView):
        permission_classes = [HasModulePermission]
        module = 'items'

Read methods need `view`; writes need `edit`; destructive routes can ask for
`full` via `required_write_level`.
"""
from rest_framework import permissions

from .modules import satisfies

SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')


def user_permission_map(user):
    """{module_id: level} for a user. Admins implicitly hold everything."""
    if not user or not user.is_authenticated:
        return {}
    if user.is_admin:
        from .modules import MODULE_IDS
        return {module_id: 'full' for module_id in MODULE_IDS}
    return {p.page_id: p.level for p in user.page_permissions.all()}


def user_level(user, module):
    """The level a user holds on one module."""
    if not user or not user.is_authenticated:
        return 'none'
    if user.is_admin:
        return 'full'
    entry = user.page_permissions.filter(page_id=module).first()
    return entry.level if entry else 'none'


class HasModulePermission(permissions.BasePermission):
    """
    Enforces the IAM matrix for the module named on the view.

    A view without a `module` attribute falls back to "authenticated only",
    so nothing silently becomes public if someone forgets to set it.
    """
    message = 'You do not have permission to access this module.'

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        module = getattr(view, 'module', None)
        if not module:
            return True

        required = (
            getattr(view, 'required_read_level', 'view')
            if request.method in SAFE_METHODS
            else getattr(view, 'required_write_level', 'edit')
        )

        held = user_level(request.user, module)
        if not satisfies(held, required):
            self.message = (
                f"'{module}' requires {required} access; you have "
                f"{held or 'none'}."
            )
            return False
        return True


class IsAdminOrHasIAM(permissions.BasePermission):
    """
    Who may configure permissions: an admin, or anyone explicitly granted
    full access to the `iam` module — that is the "whosoever has this
    permission" case.
    """
    message = 'Only an administrator, or a user granted IAM access, can do this.'

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return user.is_admin or satisfies(user_level(user, 'iam'), 'full')


class IsAdminOrHasUsers(permissions.BasePermission):
    """Admin, or a user granted full access to the `users` module."""
    message = 'Only an administrator, or a user granted User Management access, can do this.'

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return user.is_admin or satisfies(user_level(user, 'users'), 'full')
