"""
NICARA — Estimate line breakdown (bill of materials) tests.

Run: python manage.py test projects.test_components
"""
from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from catalog.models import (
    Furniture, FurniturePart, Material, MaterialOption, PartMaterial,
)
from projects.models import (
    Estimate, EstimateItem, EstimateItemComponent, Project,
)

PASSWORD = 'Str0ng!Passw0rd'


class ComponentTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='admin@nicara.design', password=PASSWORD,
            first_name='NICARA', last_name='Admin', role=User.Role.ADMIN,
        )
        self.client.force_authenticate(self.user)
        self.project = Project.objects.create(name='Sharma Residence', client_name='Anita')
        self.estimate = Estimate.objects.create(
            project=self.project, type=Estimate.EstimateType.INITIAL, version=1)
        self.line = EstimateItem.objects.create(
            estimate=self.estimate, area='Master Bedroom', zone='East Wall',
            item='Wardrobe', finishing='Laminate', qty=1, rate=Decimal('5000'),
        )

    def comp_url(self):
        return reverse('estimate-item-component-list',
                       args=[self.project.pk, self.estimate.pk, self.line.pk])


class RollupTests(ComponentTestCase):
    def test_line_uses_qty_rate_without_components(self):
        self.line.refresh_from_db()
        self.assertEqual(self.line.amount, Decimal('5000.00'))

    def test_blank_area_line_can_be_created(self):
        """The 'Blank Line' button posts an empty area — a fresh row has no room yet."""
        url = reverse('estimate-item-list', args=[self.project.pk, self.estimate.pk])
        res = self.client.post(
            url, {'area': '', 'item': 'New line', 'qty': 1, 'rate': 0, 'unit': 'unit', 'gst_pct': 18},
            format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data['area'], '')

    def test_component_amount_is_qty_times_price(self):
        comp = EstimateItemComponent.objects.create(
            estimate_item=self.line, basic_component='Plywood', detail='18mm',
            brand='Austin', model='Lincoln', qty=Decimal('64'), unit='sft', price=Decimal('100'))
        self.assertEqual(comp.amount, Decimal('6400.00'))

    def test_line_amount_rolls_up_from_components(self):
        EstimateItemComponent.objects.create(
            estimate_item=self.line, basic_component='Plywood', detail='18mm',
            qty=Decimal('64'), unit='sft', price=Decimal('100'))          # 6400
        EstimateItemComponent.objects.create(
            estimate_item=self.line, basic_component='Plywood', detail='8mm',
            qty=Decimal('16'), unit='sft', price=Decimal('60'))           # 960
        EstimateItemComponent.objects.create(
            estimate_item=self.line, basic_component='Laminate', detail='1mm',
            qty=Decimal('32'), unit='sft', price=Decimal('80'))           # 2560
        self.line.refresh_from_db()
        # 6400 + 960 + 2560 = 9920  (matches the shared sheet)
        self.assertEqual(self.line.amount, Decimal('9920.00'))

    def test_deleting_last_component_reverts_to_qty_rate(self):
        comp = EstimateItemComponent.objects.create(
            estimate_item=self.line, basic_component='Plywood',
            qty=Decimal('10'), price=Decimal('100'))
        self.line.refresh_from_db()
        self.assertEqual(self.line.amount, Decimal('1000.00'))
        comp.delete()
        self.line.refresh_from_db()
        self.assertEqual(self.line.amount, Decimal('5000.00'))  # back to qty × rate

    def test_estimate_total_reflects_component_rollup(self):
        EstimateItemComponent.objects.create(
            estimate_item=self.line, basic_component='Plywood',
            qty=Decimal('64'), price=Decimal('100'))  # 6400
        self.estimate.refresh_from_db()
        self.assertEqual(self.estimate.subtotal, Decimal('6400.00'))


class ComponentApiTests(ComponentTestCase):
    def test_add_component_via_api(self):
        res = self.client.post(self.comp_url(), {
            'basic_component': 'Plywood', 'detail': '18mm', 'brand': 'Austin',
            'model': 'Lincoln', 'qty': '64', 'unit': 'sft', 'price': '100',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(Decimal(res.data['amount']), Decimal('6400.00'))

    def test_amount_is_read_only(self):
        res = self.client.post(self.comp_url(), {
            'basic_component': 'Plywood', 'qty': '2', 'price': '100', 'amount': '999999',
        }, format='json')
        self.assertEqual(Decimal(res.data['amount']), Decimal('200.00'))

    def test_negative_price_rejected(self):
        res = self.client.post(self.comp_url(), {
            'basic_component': 'Plywood', 'qty': '2', 'price': '-5'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_edit_component_updates_line(self):
        comp = EstimateItemComponent.objects.create(
            estimate_item=self.line, basic_component='Plywood', qty=Decimal('10'), price=Decimal('100'))
        url = reverse('estimate-item-component-detail',
                      args=[self.project.pk, self.estimate.pk, self.line.pk, comp.pk])
        res = self.client.patch(url, {'qty': '20'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.line.refresh_from_db()
        self.assertEqual(self.line.amount, Decimal('2000.00'))

    def test_item_serializer_nests_components(self):
        EstimateItemComponent.objects.create(
            estimate_item=self.line, basic_component='Plywood', qty=Decimal('1'), price=Decimal('100'))
        url = reverse('estimate-item-detail', args=[self.project.pk, self.estimate.pk, self.line.pk])
        res = self.client.get(url)
        self.assertEqual(len(res.data['components']), 1)
        self.assertTrue(res.data['has_components'])


class PopulateFromFurnitureTests(ComponentTestCase):
    def setUp(self):
        super().setUp()
        # A small catalogue furniture: Wardrobe → Cabinet → Plywood + Hardware
        self.ply = Material.objects.create(name='Plywood', default_unit='sft')
        MaterialOption.objects.create(
            material=self.ply, detail='18mm', brand='Austin', model_no='Lincoln',
            price=Decimal('100'), unit='sft')
        self.hardware = Material.objects.create(name='Hardware', default_unit='nos')
        MaterialOption.objects.create(
            material=self.hardware, detail='Hinge', brand='Hettich', model_no='Onsys',
            price=Decimal('45'), unit='nos')

        self.furniture = Furniture.objects.create(name='Wardrobe')
        cabinet = FurniturePart.objects.create(furniture=self.furniture, name='Cabinet')
        PartMaterial.objects.create(part=cabinet, material=self.ply,
                                    qty_per_unit=Decimal('64'), unit='sft')
        PartMaterial.objects.create(part=cabinet, material=self.hardware,
                                    qty_per_unit=Decimal('12'), unit='nos')

    def populate_url(self):
        return reverse('estimate-item-populate',
                       args=[self.project.pk, self.estimate.pk, self.line.pk])

    def test_populates_breakdown_from_furniture(self):
        res = self.client.post(self.populate_url(), {'furniture_id': self.furniture.pk}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(self.line.components.count(), 2)

        plywood = self.line.components.get(basic_component='Plywood')
        self.assertEqual(plywood.detail, '18mm')
        self.assertEqual(plywood.brand, 'Austin')
        self.assertEqual(plywood.price, Decimal('100.00'))
        self.assertEqual(plywood.amount, Decimal('6400.00'))  # 64 × 100

    def test_line_amount_updates_after_populate(self):
        self.client.post(self.populate_url(), {'furniture_id': self.furniture.pk}, format='json')
        self.line.refresh_from_db()
        # 64×100 + 12×45 = 6400 + 540 = 6940
        self.assertEqual(self.line.amount, Decimal('6940.00'))

    def test_replace_clears_previous_breakdown(self):
        EstimateItemComponent.objects.create(
            estimate_item=self.line, basic_component='Old', qty=Decimal('1'), price=Decimal('1'))
        self.client.post(self.populate_url(), {'furniture_id': self.furniture.pk, 'replace': True}, format='json')
        self.assertFalse(self.line.components.filter(basic_component='Old').exists())

    def test_wastage_is_applied(self):
        cabinet = self.furniture.parts.first()
        pm = cabinet.materials.get(material=self.ply)
        pm.wastage_pct = Decimal('10')
        pm.save()
        self.client.post(self.populate_url(), {'furniture_id': self.furniture.pk}, format='json')
        plywood = self.line.components.get(basic_component='Plywood')
        # 64 × 1.10 = 70.4 qty
        self.assertEqual(plywood.qty, Decimal('70.40'))

    def test_unknown_furniture_rejected(self):
        res = self.client.post(self.populate_url(), {'furniture_id': 99999}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_from_catalog_seeds_breakdown_for_linked_item(self):
        """An Item linked to a furniture arrives on the estimate fully costed."""
        from items.models import Item as MasterItem, ItemCategory
        cat = ItemCategory.objects.create(name='Carpentry')
        master = MasterItem.objects.create(
            name='Wardrobe', category=cat, default_rate=Decimal('0'),
            catalog_furniture=self.furniture)

        url = reverse('estimate-item-from-catalog', args=[self.project.pk, self.estimate.pk])
        res = self.client.post(url, {'items': [{'item_id': master.pk, 'area': 'Master Bedroom'}]}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

        line = self.estimate.items.get(catalog_item=master)
        self.assertEqual(line.components.count(), 2)          # Plywood + Hardware
        self.assertEqual(line.amount, Decimal('6940.00'))     # rolled up from BOM

    def test_add_from_catalog_without_link_stays_flat(self):
        from items.models import Item as MasterItem, ItemCategory
        cat = ItemCategory.objects.create(name='Carpentry')
        master = MasterItem.objects.create(
            name='Loose Item', category=cat, default_qty=Decimal('2'), default_rate=Decimal('500'))

        url = reverse('estimate-item-from-catalog', args=[self.project.pk, self.estimate.pk])
        self.client.post(url, {'items': [{'item_id': master.pk}]}, format='json')

        line = self.estimate.items.get(catalog_item=master)
        self.assertEqual(line.components.count(), 0)
        self.assertEqual(line.amount, Decimal('1000.00'))     # 2 × 500
