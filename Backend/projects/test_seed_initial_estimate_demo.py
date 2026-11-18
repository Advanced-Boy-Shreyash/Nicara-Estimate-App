from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase

from catalog.models import BasicComponent, Furniture, FurnitureComponent, ItemType
from library.models import MaterialBrand, MaterialCategory, MaterialItem, ServiceItem
from projects.models import Estimate, EstimateItemComponent, Project


class InitialEstimateDemoSeedTests(TestCase):
    def test_seed_imports_workbook_data_and_is_idempotent(self):
        call_command('seed_initial_estimate_demo', stdout=None)

        project = Project.objects.get(name='Initial Estimate Workbook Demo')
        estimate = Estimate.objects.get(
            project=project,
            type=Estimate.EstimateType.INITIAL,
            version=1,
        )
        self.assertEqual(estimate.items.count(), 42)
        self.assertEqual(
            EstimateItemComponent.objects.filter(estimate_item__estimate=estimate).count(),
            399,
        )
        self.assertTrue(Furniture.objects.exists())
        self.assertTrue(FurnitureComponent.objects.exists())
        self.assertTrue(FurnitureComponent.objects.filter(default_material__isnull=False).exists())
        self.assertTrue(BasicComponent.objects.exists())
        self.assertTrue(MaterialCategory.objects.exists())
        self.assertTrue(MaterialBrand.objects.exists())
        self.assertTrue(MaterialItem.objects.exists())
        self.assertTrue(ServiceItem.objects.exists())
        self.assertEqual(
            MaterialCategory.objects.get(name='Polishing').type,
            MaterialCategory.SpecType.PROC_SERVICE,
        )
        self.assertEqual(
            BasicComponent.objects.get(name='Polishing').item_type,
            ItemType.PROCUREMENT_CUM_SERVICE,
        )
        kitchen_component = BasicComponent.objects.get(code='SAMPLE-KITCHEN-PULLOUT')
        self.assertEqual(
            kitchen_component.library_category.product_group,
            MaterialCategory.ProductGroup.KITCHEN_ACCESSORIES,
        )
        self.assertTrue(
            FurnitureComponent.objects.filter(
                furniture__name='Base Wall and Loft',
                basic_component=kitchen_component,
                default_material__brand__name='Ebco',
            ).exists()
        )

        self.assertTrue(
            estimate.items.get(sno=3).components.filter(
                library_material_item__isnull=False,
            ).exists()
        )
        for item in estimate.items.all():
            component_total = sum(
                (component.amount for component in item.components.all()),
                Decimal('0.00'),
            )
            self.assertEqual(item.amount, component_total)

        before = (
            Project.objects.count(),
            Estimate.objects.count(),
            estimate.items.count(),
            EstimateItemComponent.objects.count(),
            Furniture.objects.count(),
            FurnitureComponent.objects.count(),
            BasicComponent.objects.count(),
            MaterialCategory.objects.count(),
            MaterialBrand.objects.count(),
            MaterialItem.objects.count(),
            ServiceItem.objects.count(),
        )
        call_command('seed_initial_estimate_demo', stdout=None)
        after = (
            Project.objects.count(),
            Estimate.objects.count(),
            estimate.items.count(),
            EstimateItemComponent.objects.count(),
            Furniture.objects.count(),
            FurnitureComponent.objects.count(),
            BasicComponent.objects.count(),
            MaterialCategory.objects.count(),
            MaterialBrand.objects.count(),
            MaterialItem.objects.count(),
            ServiceItem.objects.count(),
        )
        self.assertEqual(after, before)
