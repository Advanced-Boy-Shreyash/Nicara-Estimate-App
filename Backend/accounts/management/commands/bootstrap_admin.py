"""
Create (or reset) the first administrator account non-interactively.

    python manage.py bootstrap_admin --email admin@nicara.design --password '...'

Falls back to the ADMIN_EMAIL / ADMIN_PASSWORD environment variables, which is
what the local dev setup uses.
"""
import os

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()


class Command(BaseCommand):
    help = 'Create or reset the initial admin user.'

    def add_arguments(self, parser):
        parser.add_argument('--email', default=os.environ.get('ADMIN_EMAIL'))
        parser.add_argument('--password', default=os.environ.get('ADMIN_PASSWORD'))
        parser.add_argument('--first-name', default=os.environ.get('ADMIN_FIRST_NAME', 'NICARA'))
        parser.add_argument('--last-name', default=os.environ.get('ADMIN_LAST_NAME', 'Admin'))

    def handle(self, *args, **options):
        email = options['email']
        password = options['password']
        if not email or not password:
            raise CommandError(
                'Provide --email and --password (or set ADMIN_EMAIL / ADMIN_PASSWORD).'
            )

        try:
            validate_password(password)
        except ValidationError as exc:
            raise CommandError('Password rejected: ' + ' '.join(exc.messages))

        user = User.objects.filter(email__iexact=email).first()
        if user:
            action = 'updated'
        else:
            user = User(email=email.lower())
            action = 'created'

        user.first_name = options['first_name']
        user.last_name = options['last_name']
        user.role = User.Role.ADMIN
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.invite_accepted = True
        user.set_password(password)
        user.save()

        self.stdout.write(self.style.SUCCESS(f'Admin {action}: {user.email}'))
