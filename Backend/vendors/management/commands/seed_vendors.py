"""
Seed the suppliers and contractors that appear in the sample projects.

    python manage.py seed_vendors
    python manage.py seed_vendors --reset

Names match the supplier / vendor columns already used in the frontend's
Material Selections and Execution Stages tables.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from vendors.models import Vendor, VendorContact

# name, city, contact, phone, categories/brands, lead_time, payment_terms, rating
SUPPLIERS = [
    ('Raj Timber & Plywood', 'Mumbai', 'Rajesh Gupta', '+91 98200 11223',
     'Austin, Century, Greenply', 3, 'net_30', 4.5,
     'Plywood, blockboard and MDF. Reliable on BWP grades.'),
    ('D Decor Hub', 'Mumbai', 'Dinesh Shah', '+91 98200 44556',
     'Greenlam, Merino, Royale Touche', 7, 'part_advance', 4.2,
     'Laminates, veneers and decorative surfaces.'),
    ('Metro Hardware', 'Mumbai', 'Imran Sheikh', '+91 98670 77889',
     'Hettich, Hafele, Ebco', 2, 'on_delivery', 4.7,
     'Hinges, channels, handles and cabinet hardware.'),
    ('Kitchen World', 'Bangalore', 'Suma Rao', '+91 99450 22110',
     'Kaff, Faber, Elica', 21, 'part_advance', 4.0,
     'Kitchen accessories, chimneys, hobs and pull-outs.'),
    ('Lumina Lights', 'Bangalore', 'Karthik N', '+91 99860 33445',
     'Philips, Wipro, Jaquar Lighting', 5, 'net_15', 4.3,
     'Profile lights, cove LED strips and down-lights.'),
    ('StoneCraft Marbles', 'Bangalore', 'Mahesh Patil', '+91 99001 55667',
     'Italian marble, Quartz, Granite', 14, 'part_advance', 3.9,
     'Counter tops, cladding and waterfall edges.'),
]

# name, city, contact, phone, trade, team_size, day_rate, payment_terms, rating
CONTRACTORS = [
    ('Shree Furniture Works', 'Bangalore', 'Ramesh Yadav', '+91 99012 88776',
     'carpentry', 18, 1200, 'milestone', 4.6,
     'Site carpentry — wardrobes, kitchens and panelling.'),
    ('Skyline Interiors', 'Bangalore', 'Vinod Kumar', '+91 99012 33221',
     'false_ceiling', 10, 1100, 'milestone', 4.4,
     'Gypsum and POP false ceiling, cove detailing.'),
    ('PowerTech Electricals', 'Bangalore', 'Sanjay Rao', '+91 99450 66554',
     'electrical', 8, 1300, 'net_15', 4.5,
     'Wiring, points, DB work and light installation.'),
    ('ColorPro Painters', 'Bangalore', 'Feroz Khan', '+91 99860 11002',
     'painting', 12, 950, 'milestone', 4.1,
     'Emulsion, texture, PU and duco finishes.'),
    ('Crystal Glass Works', 'Mumbai', 'Nitin Jain', '+91 98200 99887',
     'glass', 6, 1400, 'on_delivery', 4.2,
     'Mirrors, toughened glass, shower cubicles.'),
    ('SafeGuard Services', 'Bangalore', 'Prakash M', '+91 99001 77665',
     'cleaning', 5, 700, 'on_delivery', 4.0,
     'Floor protection, site safety and pre-handover cleaning.'),
    ('AquaFlow Plumbing', 'Mumbai', 'Sunil Patil', '+91 98670 44332',
     'plumbing', 7, 1150, 'net_15', 4.3,
     'CP fittings, concealed plumbing and sanitaryware.'),
]


class Command(BaseCommand):
    help = 'Seed sample material suppliers and contractors.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true',
                            help='Delete all vendors before seeding.')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['reset']:
            deleted, _ = Vendor.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Cleared {deleted} existing vendor rows.'))

        suppliers = 0
        for (name, city, contact, phone, brands, lead_time,
             terms, rating, notes) in SUPPLIERS:
            vendor, created = Vendor.objects.get_or_create(
                name=name,
                defaults={
                    'vendor_type': Vendor.VendorType.MATERIAL_SUPPLIER,
                    'city': city, 'state': 'Maharashtra' if city == 'Mumbai' else 'Karnataka',
                    'contact_person': contact, 'phone': phone,
                    'email': f"{name.split()[0].lower()}@example.com",
                    'brands_supplied': brands, 'lead_time_days': lead_time,
                    'payment_terms': terms, 'rating': rating, 'notes': notes,
                    'is_preferred': rating >= 4.5,
                },
            )
            if created:
                suppliers += 1
                VendorContact.objects.create(
                    vendor=vendor, name=contact, designation='Proprietor',
                    phone=phone, is_primary=True,
                )

        contractors = 0
        for (name, city, contact, phone, trade, team,
             day_rate, terms, rating, notes) in CONTRACTORS:
            vendor, created = Vendor.objects.get_or_create(
                name=name,
                defaults={
                    'vendor_type': Vendor.VendorType.CONTRACTOR,
                    'city': city, 'state': 'Maharashtra' if city == 'Mumbai' else 'Karnataka',
                    'contact_person': contact, 'phone': phone,
                    'email': f"{name.split()[0].lower()}@example.com",
                    'trade': trade, 'team_size': team,
                    'labour_rate_per_day': day_rate, 'specialization': notes,
                    'payment_terms': terms, 'rating': rating, 'notes': notes,
                    'is_preferred': rating >= 4.5,
                },
            )
            if created:
                contractors += 1
                VendorContact.objects.create(
                    vendor=vendor, name=contact, designation='Site In-charge',
                    phone=phone, is_primary=True,
                )

        self.stdout.write(self.style.SUCCESS(
            f'Suppliers created: {suppliers} | Contractors created: {contractors} | '
            f'Total vendors: {Vendor.objects.count()}'
        ))
