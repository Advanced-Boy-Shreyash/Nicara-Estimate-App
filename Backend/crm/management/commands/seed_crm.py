"""
Seed demo leads and clients, and link the existing projects to clients.

    python manage.py seed_crm
    python manage.py seed_crm --reset
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import User
from crm.models import Client, CrmNote, Lead
from projects.models import Project

# name, phone, project, developer, city, property, area, budget, stage, source, priority
LEADS = [
    ('Vikram Malhotra', '+91 98200 33445', 'Malhotra Residence', 'Lodha Bellezza',
     'Mumbai', '3BHK Apartment', '1,650 sqft', 1600000, 'initial_estimate', 'referral', 'high'),
    ('Sneha Iyer', '+91 99860 55221', 'Iyer Apartment', 'Brigade Cornerstone',
     'Bangalore', '2BHK Apartment', '1,180 sqft', 950000, 'mood_board', 'website', 'medium'),
    ('Arjun Reddy', '+91 99490 77883', 'Reddy Villa', 'My Home Bhooja',
     'Hyderabad', 'Independent Villa', '3,400 sqft', 3800000, 'furniture_layout', 'builder', 'high'),
    ('Farah Khan', '+91 98670 22119', 'Khan Penthouse', 'Oberoi Sky City',
     'Mumbai', 'Penthouse', '2,900 sqft', 4200000, 'decision', 'referral', 'high'),
    ('Deepak Nair', '+91 99001 44557', 'Nair Home', 'Prestige Falcon City',
     'Bangalore', '3BHK Apartment', '1,720 sqft', 1450000, 'contacted', 'social', 'medium'),
    ('Meera Joshi', '+91 98200 66332', 'Joshi Duplex', 'Runwal Bliss',
     'Mumbai', 'Duplex', '2,250 sqft', 2600000, 'new', 'exhibition', 'low'),
    ('Sanjay Gupta', '+91 99860 11447', 'Gupta Office', 'Embassy Tech Village',
     'Bangalore', 'Commercial Office', '4,500 sqft', 5500000, 'lost', 'website', 'medium'),
]


class Command(BaseCommand):
    help = 'Seed demo leads and clients.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['reset']:
            Lead.objects.all().delete()
            Client.objects.all().delete()
            self.stdout.write(self.style.WARNING('Cleared existing leads and clients.'))

        owner = User.objects.filter(role=User.Role.DESIGNER).first() or User.objects.first()

        created = 0
        for (name, phone, project_name, developer, city, property_type,
             area, budget, stage, source, priority) in LEADS:
            lead, was_new = Lead.objects.get_or_create(
                name=name,
                defaults={
                    'phone': phone, 'email': f"{name.split()[0].lower()}@example.com",
                    'project_name': project_name, 'developer': developer,
                    'city': city, 'property_type': property_type, 'area': area,
                    'estimated_budget': Decimal(budget), 'stage': stage,
                    'source': source, 'priority': priority, 'owner': owner,
                    'lost_reason': 'Went with an in-house team' if stage == 'lost' else '',
                },
            )
            if was_new:
                created += 1
                CrmNote.objects.create(
                    lead=lead, kind=CrmNote.Kind.CALL,
                    body=f'Initial call — discussed {property_type} requirement in {city}.',
                    created_by=owner,
                )

        # Give the seeded projects a client record so the Clients screen is not empty.
        linked = 0
        for project in Project.objects.filter(client__isnull=True):
            client, _ = Client.objects.get_or_create(
                name=project.client_name,
                defaults={
                    'email': project.client_email, 'phone': project.client_phone,
                    'address': project.client_address, 'city': project.city,
                    'state': project.state,
                },
            )
            project.client = client
            project.save(update_fields=['client'])
            linked += 1

        self.stdout.write(self.style.SUCCESS(
            f'Leads created: {created} (total {Lead.objects.count()}) | '
            f'Clients: {Client.objects.count()} | projects linked: {linked}'
        ))
