"""
NICARA Accounts — User + IAM Models

Email-first custom User model with roles and invite-based registration,
a login audit trail used for account lockout, and a page-level permission
model for the frontend IAM matrix.
"""
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    """Manager for a User whose USERNAME_FIELD is `email`."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError('An email address is required.')
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', User.Role.ADMIN)
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        return self._create_user(email, password, **extra_fields)

    def get_by_natural_key(self, username):
        """Make email lookups case-insensitive at authentication time."""
        return self.get(**{f'{self.model.USERNAME_FIELD}__iexact': username})


class User(AbstractUser):
    """Custom user with role and invitation support. Logs in with email."""

    class Role(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        DESIGNER = 'designer', 'Designer'
        CLIENT = 'client', 'Client'
        SUPERVISOR = 'supervisor', 'Site Supervisor'

    username = None  # replaced by email
    email = models.EmailField('email address', unique=True)

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.DESIGNER)
    phone = models.CharField(max_length=20, blank=True, default='')
    avatar_url = models.URLField(blank=True, default='')

    # Invitation system
    invited_by = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invitees'
    )
    invite_token = models.CharField(max_length=64, blank=True, default='', db_index=True)
    invite_accepted = models.BooleanField(default=True)
    invite_email_sent = models.BooleanField(default=False)

    # Credential hygiene
    password_changed_at = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    objects = UserManager()

    class Meta:
        ordering = ['-date_joined']

    def __str__(self):
        return f"{self.get_full_name() or self.email} ({self.role})"

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.lower()
        super().save(*args, **kwargs)

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN or self.is_superuser

    def generate_invite_token(self):
        """Generate a unique invite token and park the account until accepted."""
        self.invite_token = uuid.uuid4().hex
        self.invite_accepted = False
        self.is_active = False  # Inactive until invite is accepted
        self.save(update_fields=['invite_token', 'invite_accepted', 'is_active'])
        return self.invite_token


class LoginAttempt(models.Model):
    """
    Audit trail of every authentication attempt.

    Doubles as the source of truth for account lockout: too many failures for
    one email inside the lockout window blocks further attempts.
    """

    email = models.EmailField(db_index=True)
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='login_attempts'
    )
    successful = models.BooleanField(default=False)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['email', 'created_at'])]

    def __str__(self):
        state = 'OK' if self.successful else 'FAIL'
        return f"{self.email} — {state} @ {self.created_at:%Y-%m-%d %H:%M}"

    # ── Lockout helpers ──────────────────────────────────────
    @classmethod
    def window_start(cls):
        return timezone.now() - timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)

    @classmethod
    def recent_failures(cls, email):
        """Failed attempts for this email since the last success in the window."""
        qs = cls.objects.filter(email=email.lower(), created_at__gte=cls.window_start())
        last_success = qs.filter(successful=True).order_by('-created_at').first()
        if last_success:
            qs = qs.filter(created_at__gt=last_success.created_at)
        return qs.filter(successful=False).count()

    @classmethod
    def is_locked(cls, email):
        return cls.recent_failures(email) >= settings.LOGIN_MAX_FAILED_ATTEMPTS

    @classmethod
    def record(cls, email, *, successful, request=None, user=None):
        ip, agent = None, ''
        if request is not None:
            forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
            ip = forwarded.split(',')[0].strip() or request.META.get('REMOTE_ADDR')
            agent = request.META.get('HTTP_USER_AGENT', '')[:255]
        return cls.objects.create(
            email=(email or '').lower(), user=user, successful=successful,
            ip_address=ip or None, user_agent=agent,
        )


class PagePermission(models.Model):
    """
    Per-user, per-page permission.
    Maps directly to the IAM matrix in the frontend.
    """

    class Level(models.TextChoices):
        NONE = 'none', 'No Access'
        VIEW = 'view', 'View Only'
        EDIT = 'edit', 'Edit'
        FULL = 'full', 'Full Access'

    PAGE_CHOICES = [
        ('clientreq', 'Client Requirements'),
        ('furniture', 'Furniture Layout'),
        ('moodboard', 'Mood Board'),
        ('initial', 'Initial Estimate'),
        ('design', 'Design'),
        ('final', 'Final Estimate'),
        ('pm', 'Project Management'),
        ('handover', 'Handover'),
        ('dashboard', 'Dashboard'),
        ('iam', 'IAM Settings'),
        ('users', 'User Management'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='page_permissions')
    page_id = models.CharField(max_length=30, choices=PAGE_CHOICES)
    level = models.CharField(max_length=10, choices=Level.choices, default=Level.VIEW)

    class Meta:
        unique_together = ('user', 'page_id')
        ordering = ['user', 'page_id']

    def __str__(self):
        return f"{self.user.email} — {self.page_id}: {self.level}"
