"""
Seed script — Generates EstimateItems and Components from the provided Excel format.
Run: python manage.py shell < seed_excel_data.py
"""
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nicara.settings')
django.setup()

from projects.models import Project, Estimate, EstimateItem, EstimateItemComponent
from accounts.models import User
from decimal import Decimal

def run():
    print("Seeding Estimate data from provided Excel format...")
    
    # 1. Ensure we have a Project and an Estimate to attach these to.
    admin = User.objects.filter(role='admin').order_by('id').first() or User.objects.first()
    
    project, _ = Project.objects.get_or_create(
        name='Excel Import Test Project',
        defaults={
            'client_name': 'Test Client', 
            'stage': 'design',
            'created_by': admin
        }
    )
    
    estimate, _ = Estimate.objects.get_or_create(
        project=project, 
        type='initial', 
        version=1,
        defaults={
            'status': 'draft',
            'title': 'Initial Estimate from Excel',
            'created_by': admin
        }
    )
    
    # Clear existing items so we don't duplicate on multiple runs
    estimate.items.all().delete()
    
    # ── ITEM 1 ──
    # 1,,East Wall,,Wardrobe,,,,Laminate,8,9,1.5,9920,+
    item1 = EstimateItem.objects.create(
        estimate=estimate,
        sno=1,
        area='East Wall',
        zone='East Wall',
        item='Wardrobe',
        finishing='Laminate',
        length='8',
        breadth='9',
        height='1.5',
        qty=1,
        unit='nos',
        rate=9920,
        amount=9920,
        gst_pct=18
    )
    
    # Components for Item 1
    # ,-,Plywood,18mm,Austin,Lincoln,64,sft,100,6400,edit,,,
    EstimateItemComponent.objects.create(
        estimate_item=item1, basic_component='Plywood', detail='18mm', brand='Austin',
        model='Lincoln', qty=64, unit='sft', price=100, amount=6400
    )
    # ,-,Plywood,8mm,Austin,Lincoln,16,sft,60,960,edit,,,
    EstimateItemComponent.objects.create(
        estimate_item=item1, basic_component='Plywood', detail='8mm', brand='Austin',
        model='Lincoln', qty=16, unit='sft', price=60, amount=960
    )
    # ,-,Laminate,1mm,Virgo,SU,32,sft,80,2560,edit,,,
    EstimateItemComponent.objects.create(
        estimate_item=item1, basic_component='Laminate', detail='1mm', brand='Virgo',
        model='SU', qty=32, unit='sft', price=80, amount=2560
    )
    # ,-,Hinges,,,,,,,,,,,
    EstimateItemComponent.objects.create(
        estimate_item=item1, basic_component='Hinges', detail='', brand='',
        model='', qty=0, unit='', price=0, amount=0
    )
    # ,-,Channels,,,,,,,,,,,
    EstimateItemComponent.objects.create(
        estimate_item=item1, basic_component='Channels', detail='', brand='',
        model='', qty=0, unit='', price=0, amount=0
    )
    
    # ── ITEM 2 ──
    # 2,,West Wall,,Study Unit,,,,Laminate,8,9,1.5,4480,+
    item2 = EstimateItem.objects.create(
        estimate=estimate,
        sno=2,
        area='West Wall',
        zone='West Wall',
        item='Study Unit',
        finishing='Laminate',
        length='8',
        breadth='9',
        height='1.5',
        qty=1,
        unit='nos',
        rate=4480,
        amount=4480,
        gst_pct=18
    )
    
    # Components for Item 2
    # ,,Plywood,18mm,Austin,Gold,32,sft,120,3840,edit,,,
    EstimateItemComponent.objects.create(
        estimate_item=item2, basic_component='Plywood', detail='18mm', brand='Austin',
        model='Gold', qty=32, unit='sft', price=120, amount=3840
    )
    # ,,Plywood,8mm,Austin,Gold,8,sft,80,640,,,,
    EstimateItemComponent.objects.create(
        estimate_item=item2, basic_component='Plywood', detail='8mm', brand='Austin',
        model='Gold', qty=8, unit='sft', price=80, amount=640
    )
    # ,,Laminate,1mm,Greenlam,SU,16,sft,100,1600,,,,
    EstimateItemComponent.objects.create(
        estimate_item=item2, basic_component='Laminate', detail='1mm', brand='Greenlam',
        model='SU', qty=16, unit='sft', price=100, amount=1600
    )

    print(f"✅ Successfully seeded Estimate {estimate.title} in Project '{project.name}'!")
    print(f"   Items added: {estimate.items.count()}")
    print(f"   Components added: {EstimateItemComponent.objects.filter(estimate_item__estimate=estimate).count()}")

if __name__ == "__main__":
    run()
