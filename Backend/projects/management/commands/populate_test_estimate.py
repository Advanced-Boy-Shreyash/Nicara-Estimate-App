"""
Populate an Initial Estimate with the test data from the spreadsheet.
Usage: python manage.py populate_test_estimate
"""
from django.core.management.base import BaseCommand
from projects.models import Project, Estimate, EstimateItem


ROWS = [
    # (item_name, w_ft, w_in, h_ft, h_in, d_ft, d_in, item_type, specification, brand, model_name, application, est_spec_flag, qty, unit, rate, price_unit, margin_pct, referral_pct, gst_pct)
    ("West Wall Beadings", 0,0,0,0,0,0, "Procurement", "Teak beading", "", '1 1/2" x2"', "", 1, 20, "rft", 35, "per rft", 35, 0, 18),
    ("West Wall Beadings", 0,0,0,0,0,0, "Procurement cum service", "Polishing", "Melamine", "Matt Finish", "", 1, 20, "rft", 220, "per rft", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Spec Purpose", "Doors", "", "", "1 nos", 1, 1, "nos", 0, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Spec Purpose", "Draws", "", "", "2 nos", 1, 2, "nos", 0, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Spec Purpose", "Shelves", "", "Ply Shelves", "5 nos", 1, 5, "nos", 0, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Procurement", "Core Material(16mm BWP Ply)", "Austin", "Lincoln BWP", "", 1, 4, "sheets", 3520, "Sheets", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Procurement", "Core Material(12mm BWP Ply)", "Austin", "Lincoln BWP", "", 1, 2, "sheets", 3040, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Procurement", "Box Hinges", "Hettich", "Onsys - 0 Crank Soft Close", "6 sets", 1, 6, "sets", 260, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Procurement", "Draw Channels", "Hettich", "Quadro Channels", "2 sets", 1, 2, "sets", 2600, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Procurement", "Inner Liner", "Fabric", "0.8mm thick", "", 1, 9, "sheets", 450, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Procurement", "Finishing - Laminate", "Greenlam", "White", "", 1, 2, "sheets", 3000, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Procurement", "Finishing - Laminate", "Greenlam", "Wooden", "", 1, 1, "sheets", 3000, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Procurement", "Adhesive(Bonding)", "Fevicol", "Hi - Per", "", 1, 12, "kg", 290, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Procurement", "Adhesive(Support)", "Abro", "Masking Tape", "", 1, 1, "roll", 180, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Procurement", "Nails and Screws", "PTA", "", "", 0, 1, "box", 750, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Procurement", "Door Edges", "Shape", "PVC 22mm x 2mm", "For Grey laminate", 1, 10, "m", 60, "MTR", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Procurement", "Handles/Knobs", "Handleless design", "", "For Drawers", 1, 0, "", 550, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Service", "Carpentry", "", "Box", "", 0, 21.5, "sft", 360, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Service", "Carpentry", "", "Panel", "", 0, 10, "sft", 280, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Procurement cum Service", "Glass", "", "Aluminium Profile with Glass", "2 nos", 1, 15.5, "sft", 950, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Procurement", "Lights", "Alt", "Profile Light", "", 1, 9, "rft", 55, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Procurement", "Lights", "Alt", "5 amp driver With Sensers", "1 nos", 1, 1, "nos", 1500, "", 35, 0, 18),
    ("East Wall TV Unit with ledge", 8,0,1,0,1,3, "Service", "Electrical Work", "Light provisions", "Profile light", "1 nos", 1, 9, "rft", 120, "", 35, 0, 18),
]


class Command(BaseCommand):
    help = 'Creates a test project and populates an initial estimate with spreadsheet data'

    def handle(self, *args, **options):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.first()
        if not user:
            self.stderr.write("No user found. Create a superuser first.")
            return

        # Get or create a test project.
        project, created = Project.objects.get_or_create(
            name='Estimate Test Project',
            defaults={
                'client_name': 'Test Client',
                'client_email': 'test@nicara.in',
                'stage': 'design',
                'created_by': user,
            }
        )
        if created:
            self.stdout.write(f"Created project: {project.name} (id={project.id})")
        else:
            self.stdout.write(f"Using existing project: {project.name} (id={project.id})")

        # Delete old test estimates for this project.
        Estimate.objects.filter(project=project, type='initial').delete()

        estimate = Estimate.objects.create(
            project=project,
            type='initial',
            version=1,
            title='Initial Estimate',
            created_by=user,
        )
        self.stdout.write(f"Created estimate: {estimate} (id={estimate.id})")

        for i, row in enumerate(ROWS, start=1):
            (item_name, w_ft, w_in, h_ft, h_in, d_ft, d_in,
             item_type, specification, brand, model_name, application,
             est_spec_flag, qty, unit, rate, price_unit,
             margin_pct, referral_pct, gst_pct) = row

            ei = EstimateItem(
                estimate=estimate,
                sno=i,
                area='Drawing',
                item=item_name,
                width_ft=w_ft, width_in=w_in,
                height_ft=h_ft, height_in=h_in,
                depth_ft=d_ft, depth_in=d_in,
                item_type=item_type,
                specification=specification,
                brand=brand,
                model_name=model_name,
                application=application,
                estimate_spec_flag=bool(est_spec_flag),
                qty=qty,
                unit=unit,
                rate=rate,
                price_unit=price_unit,
                margin_pct=margin_pct,
                referral_pct=referral_pct,
                gst_pct=gst_pct,
            )
            ei.save()

            self.stdout.write(
                f"  #{i:>2} {item_name[:30]:30s} | {specification[:25]:25s} | "
                f"cost={ei.cost:>10} margin={ei.margin_amount:>10} "
                f"GST={ei.gst_amount_stored:>10} total={ei.total_amount:>10}"
            )

        self.stdout.write(self.style.SUCCESS(
            f"\n✅ Created {len(ROWS)} items in estimate id={estimate.id} "
            f"for project id={project.id}"
        ))
        self.stdout.write(f"   Subtotal:    {estimate.subtotal}")
        self.stdout.write(f"   GST:         {estimate.gst_total}")
        self.stdout.write(f"   Grand Total: {estimate.grand_total}")
        self.stdout.write(f"\n   Open the app → Projects → '{project.name}' → Initial Estimate")
