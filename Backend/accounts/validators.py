"""
NICARA Accounts — Password validators.

Plugged into AUTH_PASSWORD_VALIDATORS so the same rules apply to the Django
admin, `createsuperuser`, and every API endpoint that sets a password.
"""
import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


class ComplexityValidator:
    """Require a mix of upper case, lower case, digit and symbol."""

    RULES = (
        (re.compile(r'[A-Z]'), _('an uppercase letter')),
        (re.compile(r'[a-z]'), _('a lowercase letter')),
        (re.compile(r'[0-9]'), _('a digit')),
        (re.compile(r'[^A-Za-z0-9]'), _('a special character')),
    )

    def validate(self, password, user=None):
        missing = [label for pattern, label in self.RULES if not pattern.search(password)]
        if missing:
            raise ValidationError(
                _('Password must contain %(missing)s.'),
                code='password_not_complex',
                params={'missing': ', '.join(str(m) for m in missing)},
            )

    def get_help_text(self):
        return _(
            'Your password must contain an uppercase letter, a lowercase letter, '
            'a digit and a special character.'
        )
