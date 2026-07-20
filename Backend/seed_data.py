"""
Seed script — Creates 2 sample projects with full lifecycle data.
Run: python manage.py shell < seed_data.py
"""
import os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nicara.settings')

import django
django.setup()

from datetime import date
from decimal import Decimal
from accounts.models import User
from projects.models import (
    Project, DesignRequirement, ProjectDeliverable, Estimate, EstimateItem,
    Measurement, MaterialSelection, ExecutionStage, PaymentMilestone,
    QualityCheck, Vendor,
)

admin = User.objects.get(username='admin')

# Also create team members
nishanth, _ = User.objects.get_or_create(username='nishanth', defaults={
    'email': 'nishanth@nicara.in', 'first_name': 'Nishanth', 'last_name': 'K',
    'role': 'designer', 'is_active': True,
})
nishanth.set_password('password')
nishanth.save()

priya, _ = User.objects.get_or_create(username='priya', defaults={
    'email': 'priya@nicara.in', 'first_name': 'Priya', 'last_name': 'S',
    'role': 'designer', 'is_active': True,
})
priya.set_password('password')
priya.save()

# ════════════════════════════════════════════════════════════════
# PROJECT 1: Sharma Residence (Design Phase)
# ════════════════════════════════════════════════════════════════
p1 = Project.objects.create(
    name='Sharma Residence', stage='design', progress=42,
    client_name='Ms. Anita Sharma', client_phone='+91 98765 43210',
    client_email='anita.sharma@gmail.com',
    client_address='C-204, Raheja Classique, Andheri West, Mumbai',
    developer='Prestige Lakeside - Tower B', unit_no='B-1204',
    city='Mumbai', state='Maharashtra', pincode='400053',
    project_type='Residential', purpose='Self', interior_style='Contemporary',
    area='1,850 sqft', property_type='3BHK',
    budget=Decimal('1850000'),
    start_date=date(2026,6,10), target_date=date(2026,10,30),
    design_owner=nishanth, site_manager=admin, created_by=admin,
)

# Design Requirements
dr_data = [
    ("Master Bedroom", "Wardrobe", "8'0\"", "2'0\"", "8'0\"", "Laminate", "Mirror on one shutter"),
    ("Master Bedroom", "Study Table", "4'0\"", "1'6\"", "2'6\"", "Veneer", "With bookshelf above"),
    ("Master Bedroom", "TV Unit", "6'0\"", "1'3\"", "4'0\"", "Laminate", "Wall mounted panel"),
    ("Master Bedroom", "False Ceiling", "14'0\"", "12'0\"", "-", "Gypsum", "Cove lighting"),
    ("Kids Room", "Wardrobe", "6'0\"", "2'0\"", "8'0\"", "Laminate", "Pastel blue color"),
    ("Kids Room", "Study Table", "3'6\"", "1'6\"", "2'6\"", "Laminate", "With pin-up board"),
    ("Kids Room", "Bed Headboard", "5'0\"", "0'4\"", "4'0\"", "Upholstery", "Soft padded"),
    ("Drawing Room", "TV Unit", "8'0\"", "1'3\"", "1'0\"", "Veneer", "Walnut finish"),
    ("Drawing Room", "Shoe Rack", "3'0\"", "1'0\"", "4'0\"", "Laminate", "Near entrance"),
    ("Drawing Room", "False Ceiling", "18'0\"", "14'0\"", "-", "Gypsum", "Peripheral + center"),
    ("Kitchen", "Kitchen Cabinet - Base", "10'0\"", "2'0\"", "2'10\"", "Acrylic", "Soft-close hinges"),
    ("Kitchen", "Kitchen Cabinet - Wall", "10'0\"", "1'0\"", "2'6\"", "Acrylic", "Glass shutters"),
    ("Kitchen", "Kitchen Tall Unit", "2'6\"", "2'0\"", "7'0\"", "Acrylic", "Pull-out baskets"),
    ("Kitchen", "Loft", "10'0\"", "1'6\"", "1'6\"", "Laminate", "Storage above cabinets"),
    ("Guest Bedroom", "Wardrobe", "6'0\"", "2'0\"", "8'0\"", "Laminate", "Simple design"),
    ("Guest Bedroom", "Dressing Table", "3'0\"", "1'6\"", "5'0\"", "Veneer", "With LED mirror"),
]
for i, (room, unit, l, b, h, fin, rem) in enumerate(dr_data, 1):
    DesignRequirement.objects.create(
        project=p1, room=room, unit=unit, length=l, breadth=b, height=h,
        finishing=fin, remarks=rem, design_required=(i not in [7, 14]), sort_order=i,
    )

# Deliverables — FL
for v, dt, st, rem in [
    ("Ver 1", date(2026,6,18), "revision", "Kitchen island position needs change"),
    ("Ver 2", date(2026,6,25), "approved", "Final approved layout"),
]:
    ProjectDeliverable.objects.create(
        project=p1, type='furniture_layout', version=v, status=st,
        date=dt, remarks=rem, uploaded_by=nishanth, file_name=f"sharma_fl_{v.lower().replace(' ','')}.pdf",
    )

# Deliverables — MB
for v, dt, st, rem in [
    ("Ver 1", date(2026,6,20), "revision", "Client wants warmer tones"),
    ("Ver 2", date(2026,6,28), "approved", "Final approved mood board"),
]:
    ProjectDeliverable.objects.create(
        project=p1, type='mood_board', version=v, status=st,
        date=dt, remarks=rem, uploaded_by=priya, file_name=f"sharma_mb_{v.lower().replace(' ','')}.pdf",
    )

# Deliverables — 3D Models
for v, dt, st, rem in [
    ("Ver 1", date(2026,7,5), "approved", "Master Bedroom 3D view"),
    ("Ver 1", date(2026,7,5), "approved", "Kitchen 3D view"),
    ("Ver 1", date(2026,7,8), "pending", "Drawing Room 3D view"),
]:
    ProjectDeliverable.objects.create(
        project=p1, type='model_3d', version=v, status=st,
        date=dt, remarks=rem, uploaded_by=priya, file_name=f"sharma_3d_{rem.split()[0].lower()}.jpg",
    )

# Deliverables — Renders
for v, dt, st, rem in [
    ("Ver 1", date(2026,7,12), "approved", "Master bedroom render"),
    ("Ver 1", date(2026,7,12), "pending", "Kitchen render — awaiting review"),
]:
    ProjectDeliverable.objects.create(
        project=p1, type='render', version=v, status=st,
        date=dt, remarks=rem, uploaded_by=priya,
    )

# Initial Estimate
est1 = Estimate.objects.create(project=p1, type='initial', version=1, status='approved')
est_items_1 = [
    (1, "Master Bedroom", "Wardrobe 8'x2'x8'", "16mm BWP ply with laminate finish, mirror on one shutter", "8'0\"", "2'0\"", "8'0\"", 1, "unit", 145000),
    (2, "Master Bedroom", "Study Table + Bookshelf", "16mm BWP ply with veneer finish", "4'0\"", "1'6\"", "2'6\"", 1, "unit", 42000),
    (3, "Master Bedroom", "TV Unit Wall Panel", "Wall mounted panel with back-lit groove", "6'0\"", "1'3\"", "4'0\"", 1, "unit", 68000),
    (4, "Master Bedroom", "False Ceiling", "Gypsum false ceiling with cove LED lighting", "14'0\"", "12'0\"", "-", 168, "sft", 165),
    (5, "Kids Room", "Wardrobe 6'x2'x8'", "16mm BWP ply with pastel blue laminate", "6'0\"", "2'0\"", "8'0\"", 1, "unit", 115000),
    (6, "Kids Room", "Study Table + Pinboard", "16mm BWP ply with laminate + soft-board panel", "3'6\"", "1'6\"", "2'6\"", 1, "unit", 35000),
    (7, "Drawing Room", "TV Unit Console", "Walnut veneer with concealed cable management", "8'0\"", "1'3\"", "1'0\"", 1, "unit", 88000),
    (8, "Drawing Room", "Shoe Rack Cabinet", "16mm ply with laminate, ventilated design", "3'0\"", "1'0\"", "4'0\"", 1, "unit", 28000),
    (9, "Drawing Room", "False Ceiling", "Gypsum peripheral + center piece with down-lights", "18'0\"", "14'0\"", "-", 252, "sft", 175),
    (10, "Kitchen", "Base Cabinets L-shape", "BWR ply with acrylic shutters, soft-close hinges, granite top", "10'0\"", "2'0\"", "2'10\"", 1, "unit", 225000),
    (11, "Kitchen", "Wall Cabinets", "BWR ply with acrylic + glass shutters", "10'0\"", "1'0\"", "2'6\"", 1, "unit", 135000),
    (12, "Kitchen", "Tall Unit with Baskets", "BWR ply with pull-out wire baskets", "2'6\"", "2'0\"", "7'0\"", 1, "unit", 85000),
    (13, "Guest Bedroom", "Wardrobe 6'x2'x8'", "16mm BWP ply with laminate finish", "6'0\"", "2'0\"", "8'0\"", 1, "unit", 105000),
    (14, "Guest Bedroom", "Dressing Table + LED Mirror", "Veneer finish with integrated LED back-lit mirror", "3'0\"", "1'6\"", "5'0\"", 1, "unit", 45000),
]
for sno, area, item, desc, l, b, h, qty, unit, rate in est_items_1:
    EstimateItem.objects.create(
        estimate=est1, sno=sno, area=area, item=item, description=desc,
        length=l, breadth=b, height=h, qty=qty, unit=unit, rate=rate,
        amount=qty * rate, gst_pct=18,
    )

# Intermediate Estimate (5% markup)
est1i = Estimate.objects.create(project=p1, type='intermediate', version=1, status='draft')
for sno, area, item, desc, l, b, h, qty, unit, rate in est_items_1:
    r = int(rate * 1.05)
    EstimateItem.objects.create(
        estimate=est1i, sno=sno, area=area, item=item, description=desc,
        length=l, breadth=b, height=h, qty=qty, unit=unit, rate=r,
        amount=qty * r, gst_pct=18,
    )

# Measurements
for room, east, west, north, south, other, checker, st in [
    ("Master Bedroom", '14\'2"', '14\'1"', '12\'3"', '12\'3"', "Window: 5'x4' (N)", "Rahul M", "complete"),
    ("Kids Room", '12\'0"', '11\'11"', '10\'6"', '10\'6"', "Window: 4'x4' (E)", "Rahul M", "complete"),
    ("Drawing Room", '18\'4"', '18\'3"', '14\'1"', '14\'0"', "Balcony door: 6'x7' (W)", "Nishanth K", "complete"),
    ("Kitchen", '10\'2"', '10\'1"', '8\'6"', '8\'6"', "Window: 3'x3' (N), Service door (E)", "Rahul M", "complete"),
    ("Guest Bedroom", '12\'0"', '12\'1"', '10\'0"', '10\'0"', "Window: 4'x4' (S)", "", "pending"),
]:
    Measurement.objects.create(
        project=p1, room=room, plan_verified=bool(checker),
        east=east, west=west, north=north, south=south,
        other_details=other, proof_checked_by=checker, status=st,
    )

# Material Selections
mat_data = [
    ("Plywood", "Master Bedroom", "Wardrobe", "Raj Timber", "Austin", "Lincoln BWP", "AUS-LN-16", 92, "In Stock"),
    ("Plywood", "Kitchen", "Base Cabinets", "Raj Timber", "Austin", "Lincoln BWR", "AUS-LR-16", 95, "In Stock"),
    ("Laminates", "Master Bedroom", "Wardrobe Shutters", "D Decor Hub", "Greenlam", "Mikasa Oak", "GL-MO-445", 1450, "In Stock"),
    ("Laminates", "Kids Room", "Wardrobe", "D Decor Hub", "Greenlam", "Sky Blue Matte", "GL-SB-221", 1350, "2-3 weeks"),
    ("Laminates", "Drawing Room", "TV Unit", "D Decor Hub", "Merino", "Walnut Dark", "MR-WD-889", 2100, "In Stock"),
    ("Hardware", "Kitchen", "All Cabinets", "Metro Hardware", "Hettich", "Sensys 8645i", "HT-SC-8645", 420, "In Stock"),
    ("Hardware", "All Rooms", "Wardrobes", "Metro Hardware", "Hettich", "Onsys 0-Crank", "HT-ON-110", 380, "In Stock"),
    ("Kitchen Accessories", "Kitchen", "Base Unit", "Kitchen World", "Kaff", "Pull-out Basket Set", "KF-PB-600", 4200, "2-3 weeks"),
    ("Kitchen Accessories", "Kitchen", "Corner", "Kitchen World", "Kaff", "Magic Corner", "KF-MC-900", 9500, "4-6 weeks"),
]
for cat, room, wall, sup, brand, catalog, code, price, avail in mat_data:
    MaterialSelection.objects.create(
        project=p1, category=cat, room=room, wall_area=wall,
        supplier_name=sup, brand_name=brand, catalog=catalog,
        item_code=code, supplier_price=price, availability=avail,
    )

# Payments
for ms, amt, due, paid_dt, st, mode, ref in [
    ("Booking Advance", 50000, date(2026,6,15), date(2026,6,15), "paid", "NEFT", "NEFT-0615-001"),
    ("Design Phase - P1", 200000, date(2026,7,1), date(2026,7,2), "paid", "UPI", "UPI-0702-042"),
    ("Intermediate Estimate Approval", 300000, date(2026,7,20), None, "pending", "", ""),
    ("Material Procurement", 500000, date(2026,8,1), None, "pending", "", ""),
]:
    PaymentMilestone.objects.create(
        project=p1, milestone=ms, amount=amt, due_date=due,
        paid_date=paid_dt, status=st, mode=mode, reference=ref,
    )


# ════════════════════════════════════════════════════════════════
# PROJECT 2: Kapoor Villa (Execution Phase)
# ════════════════════════════════════════════════════════════════
p2 = Project.objects.create(
    name='Kapoor Villa', stage='execution', progress=58,
    client_name='Mr. Rajesh Kapoor', client_phone='+91 99001 22334',
    client_email='rajesh.kapoor@kapoorgroup.com',
    client_address='14, Windmere Estate, Whitefield, Bangalore',
    developer='DLF Pinnacle - Phase 2', unit_no='Villa 14',
    city='Bangalore', state='Karnataka', pincode='560066',
    project_type='Residential', purpose='Self', interior_style='Modern Luxury',
    area='4,200 sqft', property_type='Villa',
    budget=Decimal('4618000'),
    start_date=date(2026,5,1), target_date=date(2026,9,15),
    design_owner=priya, site_manager=admin, created_by=admin,
)

# Design Requirements
dr2 = [
    ("Master Bedroom Suite", "Walk-in Wardrobe", "10'0\"", "6'0\"", "9'0\"", "Veneer", "Italian walnut"),
    ("Master Bedroom Suite", "Bed Back Panel", "12'0\"", "0'6\"", "10'0\"", "Upholstery + Veneer", "Leather + walnut combo"),
    ("Master Bedroom Suite", "Dressing Room", "8'0\"", "4'0\"", "9'0\"", "Veneer", "With vanity counter"),
    ("Living Room", "Entertainment Wall", "16'0\"", "1'6\"", "10'0\"", "Veneer + Stone", "85\" TV recess + Italian stone"),
    ("Living Room", "Bar Unit", "6'0\"", "2'0\"", "3'6\"", "Veneer", "With wine rack + LED"),
    ("Living Room", "False Ceiling", "24'0\"", "18'0\"", "-", "Gypsum + Wood", "Layered with wood beams"),
    ("Home Office", "Full Office Setup", "12'0\"", "10'0\"", "9'0\"", "Veneer", "L-desk + library wall + seating"),
    ("Kitchen", "Island Kitchen", "14'0\"", "10'0\"", "3'0\"", "PU Paint", "Quartz top, waterfall edge"),
    ("Kitchen", "Wall + Tall Units", "14'0\"", "1'0\"", "4'0\"", "PU Paint", "Handle-less push-to-open"),
    ("Kids Room 1", "Bunk Bed + Wardrobe", "8'0\"", "4'0\"", "9'0\"", "Laminate", "Custom bunk with storage steps"),
    ("Kids Room 2", "Wardrobe + Study", "8'0\"", "2'0\"", "9'0\"", "Laminate", "Pastel green theme"),
    ("Guest Bedroom", "Wardrobe + TV Unit", "8'0\"", "2'0\"", "9'0\"", "Laminate", "Minimal elegant"),
    ("Pooja Room", "Custom Pooja Unit", "4'0\"", "2'0\"", "7'0\"", "Solid Teak", "Traditional carved design"),
    ("Entrance", "Foyer Console + Mirror", "5'0\"", "1'6\"", "3'0\"", "Veneer + Brass", "Statement piece with brass inlay"),
]
for i, (room, unit, l, b, h, fin, rem) in enumerate(dr2, 1):
    DesignRequirement.objects.create(
        project=p2, room=room, unit=unit, length=l, breadth=b, height=h,
        finishing=fin, remarks=rem, design_required=True, sort_order=i,
    )

# Deliverables
for t, v, dt, st, rem in [
    ("furniture_layout", "Ver 1", date(2026,5,12), "revision", "Bar unit repositioned"),
    ("furniture_layout", "Ver 2", date(2026,5,18), "approved", "Final layout"),
    ("mood_board", "Ver 1", date(2026,5,15), "approved", "Modern luxury theme"),
    ("model_3d", "Ver 1", date(2026,5,28), "approved", "All rooms 3D model"),
    ("model_3d", "Ver 2", date(2026,6,2), "approved", "Updated kitchen island"),
    ("render", "Ver 1", date(2026,6,8), "approved", "All room renders approved"),
    ("final_render", "Final", date(2026,6,15), "approved", "Final approved"),
    ("working_drawing", "Ver 1", date(2026,6,18), "approved", "Complete working drawing set"),
]:
    ProjectDeliverable.objects.create(
        project=p2, type=t, version=v, date=dt, status=st,
        remarks=rem, uploaded_by=priya,
    )

# Estimates
est2_items = [
    (1, "Master Bedroom Suite", "Walk-in Wardrobe", "BWP ply, Italian walnut veneer, brass handles, LED strips", "10'0\"", "6'0\"", "9'0\"", 1, "unit", 485000),
    (2, "Master Bedroom Suite", "Bed Back Panel", "Veneer + Italian leather upholstery", "12'0\"", "0'6\"", "10'0\"", 1, "unit", 165000),
    (3, "Master Bedroom Suite", "Dressing Room", "Full vanity with backlit mirror, veneer finish", "8'0\"", "4'0\"", "9'0\"", 1, "unit", 210000),
    (4, "Living Room", "Entertainment Wall", "Veneer + Italian stone cladding, 85\" TV recess", "16'0\"", "1'6\"", "10'0\"", 1, "unit", 420000),
    (5, "Living Room", "Bar Unit", "Walnut veneer, wine rack, LED lighting, granite top", "6'0\"", "2'0\"", "3'6\"", 1, "unit", 185000),
    (6, "Living Room", "False Ceiling", "Gypsum layered + teak wood beams, cove lighting", "24'0\"", "18'0\"", "-", 432, "sft", 250),
    (7, "Home Office", "Office Setup", "L-desk + floor-to-ceiling library + visitor seating nook", "12'0\"", "10'0\"", "9'0\"", 1, "unit", 320000),
    (8, "Kitchen", "Island Kitchen Complete", "PU paint, quartz waterfall, Hafele fittings", "14'0\"", "10'0\"", "3'0\"", 1, "unit", 680000),
    (9, "Kitchen", "Wall + Tall Units", "PU paint, handle-less push-to-open, SS internals", "14'0\"", "1'0\"", "4'0\"", 1, "unit", 310000),
    (10, "Kids Room 1", "Custom Bunk + Wardrobe", "BWP ply with colourful laminate, storage steps", "8'0\"", "4'0\"", "9'0\"", 1, "unit", 195000),
    (11, "Kids Room 2", "Wardrobe + Study Combo", "BWP ply, pastel green laminate with open shelves", "8'0\"", "2'0\"", "9'0\"", 1, "unit", 155000),
    (12, "Guest Bedroom", "Wardrobe + TV Unit", "BWP ply, elegant laminate finish", "8'0\"", "2'0\"", "9'0\"", 1, "unit", 140000),
    (13, "Pooja Room", "Custom Pooja Unit", "Solid teak wood, traditional carving, brass bell", "4'0\"", "2'0\"", "7'0\"", 1, "unit", 175000),
    (14, "Entrance", "Foyer Console + Mirror", "Veneer with brass inlay, oval mirror with brass frame", "5'0\"", "1'6\"", "3'0\"", 1, "unit", 95000),
]

# Initial
est2i = Estimate.objects.create(project=p2, type='initial', version=1, status='approved')
for sno, area, item, desc, l, b, h, qty, unit, rate in est2_items:
    EstimateItem.objects.create(
        estimate=est2i, sno=sno, area=area, item=item, description=desc,
        length=l, breadth=b, height=h, qty=qty, unit=unit, rate=rate,
        amount=qty * rate, gst_pct=18,
    )

# Intermediate (3% markup)
est2m = Estimate.objects.create(project=p2, type='intermediate', version=1, status='approved')
for sno, area, item, desc, l, b, h, qty, unit, rate in est2_items:
    r = int(rate * 1.03)
    EstimateItem.objects.create(
        estimate=est2m, sno=sno, area=area, item=item, description=desc,
        length=l, breadth=b, height=h, qty=qty, unit=unit, rate=r,
        amount=qty * r, gst_pct=18,
    )

# Final (8% markup)
est2f = Estimate.objects.create(project=p2, type='final', version=1, status='approved')
for sno, area, item, desc, l, b, h, qty, unit, rate in est2_items:
    r = int(rate * 1.08)
    EstimateItem.objects.create(
        estimate=est2f, sno=sno, area=area, item=item, description=desc,
        length=l, breadth=b, height=h, qty=qty, unit=unit, rate=r,
        amount=qty * r, gst_pct=18,
    )

# Measurements
for room, east, west, north, south, other in [
    ("Master Bedroom Suite", '22\'4"', '22\'3"', '16\'1"', '16\'0"', "French windows (S)"),
    ("Living Room", '24\'6"', '24\'5"', '18\'2"', '18\'1"', "Double height (N wall)"),
    ("Home Office", '12\'3"', '12\'2"', '10\'1"', '10\'0"', "Bay window (E)"),
    ("Kitchen", '14\'2"', '14\'1"', '10\'6"', '10\'5"', "Utility door (N)"),
    ("Kids Room 1", '14\'0"', '13\'11"', '12\'1"', '12\'0"', "Window (W)"),
    ("Kids Room 2", '12\'0"', '12\'1"', '11\'0"', '11\'0"', "Window (E)"),
]:
    Measurement.objects.create(
        project=p2, room=room, plan_verified=True,
        east=east, west=west, north=north, south=south,
        other_details=other, proof_checked_by="Anil K", status="complete",
    )

# Execution Stages
exec_data = [
    ("Floor Protection & House Safety", "SafeGuard Services", date(2026,6,20), date(2026,6,22), "completed", 100, 35000, "paid"),
    ("False Ceiling — All Rooms", "Skyline Interiors", date(2026,6,23), date(2026,7,5), "completed", 100, 280000, "paid"),
    ("Electrical Work", "PowerTech Electricals", date(2026,6,25), date(2026,7,10), "completed", 100, 185000, "paid"),
    ("Carpentry — Master Bedroom", "Shree Furniture Works", date(2026,7,5), date(2026,7,25), "in-progress", 65, 400000, "partial"),
    ("Carpentry — Living + Office", "Shree Furniture Works", date(2026,7,10), date(2026,8,5), "in-progress", 35, 500000, "partial"),
    ("Carpentry — Kitchen", "Shree Furniture Works", date(2026,7,15), date(2026,8,15), "in-progress", 20, 600000, "pending"),
    ("Carpentry — Kids + Guest", "Shree Furniture Works", date(2026,7,20), date(2026,8,10), "upcoming", 0, 350000, "pending"),
    ("Glass & Mirror Work", "Crystal Glass Works", date(2026,8,10), date(2026,8,20), "upcoming", 0, 120000, "pending"),
    ("Painting — All Areas", "ColorPro Painters", date(2026,8,15), date(2026,9,1), "upcoming", 0, 165000, "pending"),
    ("Final Cleanup & Handover", "CleanPro Services", date(2026,9,1), date(2026,9,5), "upcoming", 0, 25000, "pending"),
]
for i, (name, vendor, sd, ed, st, prog, pay, pst) in enumerate(exec_data, 1):
    ExecutionStage.objects.create(
        project=p2, name=name, vendor=vendor, start_date=sd, end_date=ed,
        status=st, progress=prog, payment=pay, payment_status=pst, sort_order=i,
    )

# Payments
for ms, amt, due, paid_dt, st, mode, ref in [
    ("Booking Advance", 200000, date(2026,5,15), date(2026,5,15), "paid", "NEFT", "NEFT-0515-KV01"),
    ("Design Approval - P1", 500000, date(2026,6,1), date(2026,6,2), "paid", "NEFT", "NEFT-0602-KV02"),
    ("Material Procurement - P2", 800000, date(2026,6,15), date(2026,6,15), "paid", "RTGS", "RTGS-0615-KV03"),
    ("Carpentry Start - P3", 600000, date(2026,7,1), date(2026,7,3), "paid", "UPI", "UPI-0703-KV04"),
    ("Mid-Execution - P4", 700000, date(2026,7,20), None, "overdue", "", ""),
    ("Pre-Handover - P5", 543000, date(2026,8,25), None, "pending", "", ""),
]:
    PaymentMilestone.objects.create(
        project=p2, milestone=ms, amount=amt, due_date=due,
        paid_date=paid_dt, status=st, mode=mode, reference=ref,
    )

# Quality Checks
for area, ct, dt, insp, st, rem in [
    ("All Rooms", "Floor Protection", date(2026,6,22), "Anil K", "pass", "All floors properly covered"),
    ("Living + Master", "False Ceiling Level", date(2026,7,5), "Suresh B", "pass", "Level within tolerance"),
    ("All Rooms", "Electrical Points", date(2026,7,10), "Suresh B", "pass", "All 87 points verified"),
    ("Master Bedroom", "Wardrobe Alignment", date(2026,7,18), "Anil K", "pass", "Plumb and level OK"),
    ("Kitchen", "Cabinet Fitment", date(2026,7,20), "Anil K", "pending", "Scheduled for next week"),
]:
    QualityCheck.objects.create(
        project=p2, area=area, check_type=ct, date=dt,
        inspector=insp, status=st, remarks=rem,
    )

# Vendors
vendors = [
    ("material_supplier", "Raj Timber", "Timber & Plywood", "Rajan", "+91 98111 22233"),
    ("material_supplier", "D Decor Hub", "Laminates & Veneers", "Deepak", "+91 98222 33344"),
    ("material_supplier", "Metro Hardware", "Hardware & Fittings", "Mahesh", "+91 98333 44455"),
    ("material_supplier", "Kitchen World", "Kitchen Accessories", "Kiran", "+91 98444 55566"),
    ("contractor", "Shree Furniture Works", "Carpentry", "Shyam Sundar", "+91 99555 66677"),
    ("contractor", "Skyline Interiors", "False Ceiling", "Ravi", "+91 99666 77788"),
    ("contractor", "PowerTech Electricals", "Electrical", "Prakash", "+91 99777 88899"),
    ("contractor", "Crystal Glass Works", "Glass & Mirror", "Vijay", "+91 99888 99900"),
    ("contractor", "ColorPro Painters", "Painting", "Sunil", "+91 99999 00011"),
]
for vt, name, cat, cp, ph in vendors:
    Vendor.objects.get_or_create(name=name, defaults={
        'vendor_type': vt, 'category': cat, 'contact_person': cp, 'phone': ph,
        'rating': Decimal('4.2'), 'is_active': True,
    })

print(f"\n✅ Seeded successfully!")
print(f"   Projects: {Project.objects.count()}")
print(f"   Design Requirements: {DesignRequirement.objects.count()}")
print(f"   Deliverables: {ProjectDeliverable.objects.count()}")
print(f"   Estimates: {Estimate.objects.count()} ({EstimateItem.objects.count()} items)")
print(f"   Measurements: {Measurement.objects.count()}")
print(f"   Material Selections: {MaterialSelection.objects.count()}")
print(f"   Execution Stages: {ExecutionStage.objects.count()}")
print(f"   Payment Milestones: {PaymentMilestone.objects.count()}")
print(f"   Quality Checks: {QualityCheck.objects.count()}")
print(f"   Vendors: {Vendor.objects.count()}")
print(f"   Users: {User.objects.count()}")
