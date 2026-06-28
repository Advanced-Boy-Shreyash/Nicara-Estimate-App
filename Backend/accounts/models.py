"""
NICARA Accounts — User + IAM Models

Custom User model with roles and invite-based registration.
Permission model for page-level access control.
"""
import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user with role and invitation support."""

    class Role(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        DESIGNER = 'designer', 'Designer'
        CLIENT = 'client', 'Client'
        SUPERVISOR = 'supervisor', 'Site Supervisor'

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.DESIGNER)
    phone = models.CharField(max_length=20, blank=True, default='')
    avatar_url = models.URLField(blank=True, default='')

    # Invitation system
    invited_by = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invitees'
    )
    invite_token = models.CharField(max_length=64, blank=True, default='')
    invite_accepted = models.BooleanField(default=True)
    invite_email_sent = models.BooleanField(default=False)

    class Meta:
        ordering = ['-date_joined']

    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"

    def generate_invite_token(self):
        """Generate a unique invite token for this user."""
        self.invite_token = uuid.uuid4().hex
        self.invite_accepted = False
        self.is_active = False  # Inactive until invite is accepted
        self.save(update_fields=['invite_token', 'invite_accepted', 'is_active'])
        return self.invite_token


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
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='page_permissions')
    page_id = models.CharField(max_length=30, choices=PAGE_CHOICES)
    level = models.CharField(max_length=10, choices=Level.choices, default=Level.VIEW)

    class Meta:
        unique_together = ('user', 'page_id')
        ordering = ['user', 'page_id']

    def __str__(self):
        return f"{self.user.username} — {self.page_id}: {self.level}"
