"""
NICARA — Estimate line breakdown (bill of materials) tests.

Run: python manage.py test projects.test_components
"""
from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from items.models import Item, ItemCategory, ItemComponent
from library.models import MaterialBrand, MaterialCategory, MaterialItem
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
        # The component amount is the base cost; estimate subtotal also includes
        # the line's default 15% margin.
        self.assertEqual(self.estimate.subtotal, Decimal('7360.00'))


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


class PopulateFromItemTests(ComponentTestCase):
    def test_item_bom_uses_library_price_quantity_and_dimensions(self):
        raw_category = MaterialCategory.objects.create(
            name='Plywood', product_group=MaterialCategory.ProductGroup.PLYWOOD,
        )
        brand = MaterialBrand.objects.create(category=raw_category, name='Austin')
        variant = MaterialItem.objects.create(
            category=raw_category, brand=brand, model_name='Lincoln',
            default_rate=Decimal('100'), default_unit='sft',
        )
        item_category = ItemCategory.objects.create(name='Components')
        drawer = Item.objects.create(
            name='Custom Wooden Drawer', category=item_category,
            default_length='4', default_height='3',
        )
        ItemComponent.objects.create(
            item=drawer, material_item=variant, qty_per_unit=1, unit='sft',
            quantity_basis=ItemComponent.QuantityBasis.AREA,
        )

        url = reverse('estimate-item-from-catalog', args=[self.project.pk, self.estimate.pk])
        response = self.client.post(url, {
            'items': [{
                'item_id': drawer.pk, 'qty': 2, 'width_ft': 4, 'height_ft': 3,
            }],
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        component = EstimateItemComponent.objects.get(
            estimate_item_id=response.data['items'][0]['id'],
        )
        self.assertEqual(component.library_material_item_id, variant.id)
        self.assertEqual(component.qty, Decimal('24.00'))
        self.assertEqual(component.price, Decimal('100.00'))
        self.assertEqual(component.amount, Decimal('2400.00'))


class SmartMaterialTests(ComponentTestCase):
    """Smart Estimate Generator choices re-price line breakdowns from the library."""

    def setUp(self):
        super().setUp()
        self.ply18 = MaterialCategory.objects.create(
            name='Core Material(18mm BWP Ply)', product_group=MaterialCategory.ProductGroup.PLYWOOD)
        self.ply12 = MaterialCategory.objects.create(
            name='Core Material(12mm BWP Ply)', product_group=MaterialCategory.ProductGroup.PLYWOOD)
        gurjan18 = MaterialBrand.objects.create(category=self.ply18, name='Gurjan')
        gurjan12 = MaterialBrand.objects.create(category=self.ply12, name='Gurjan')
        austin18 = MaterialBrand.objects.create(category=self.ply18, name='Austin')
        self.g18 = MaterialItem.objects.create(category=self.ply18, brand=gurjan18, model_name='710 BWP',
                                               default_rate=Decimal('80'), default_unit='sft')
        self.g12 = MaterialItem.objects.create(category=self.ply12, brand=gurjan12, model_name='710 BWP',
                                               default_rate=Decimal('75'), default_unit='sft')
        self.a18 = MaterialItem.objects.create(category=self.ply18, brand=austin18, model_name='Lincoln',
                                               default_rate=Decimal('100'), default_unit='sft')

    def apply(self, item):
        return self.client.post(
            reverse('estimate-apply-materials', args=[self.project.pk, self.estimate.pk]),
            {'materials': [{'library_item_id': item.id}]}, format='json')

    def test_same_category_takes_the_chosen_model(self):
        comp = EstimateItemComponent.objects.create(
            estimate_item=self.line, basic_component='Plywood 18mm', qty=Decimal('4'),
            price=Decimal('1'), library_material_item=self.g18)
        res = self.apply(self.a18)
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        comp.refresh_from_db()
        self.assertEqual((comp.brand, comp.model, comp.price), ('Austin', 'Lincoln', Decimal('100.00')))
        self.assertEqual(comp.amount, Decimal('400.00'))

    def test_brand_carries_across_ply_thicknesses(self):
        comp12 = EstimateItemComponent.objects.create(
            estimate_item=self.line, basic_component='Plywood 12mm', qty=Decimal('2'),
            price=Decimal('1'), library_material_item=self.g12)
        self.apply(self.g18)
        comp12.refresh_from_db()
        self.assertEqual(comp12.library_material_item, self.g12)   # Gurjan has a 12mm model
        self.assertEqual(comp12.price, Decimal('75.00'))

    def test_unmatched_breakdown_rows_are_left_alone(self):
        other = EstimateItemComponent.objects.create(
            estimate_item=self.line, basic_component='Hardware', qty=Decimal('1'), price=Decimal('20'))
        self.apply(self.a18)
        other.refresh_from_db()
        self.assertEqual((other.brand, other.price), ('', Decimal('20.00')))

    def test_unknown_material_is_rejected(self):
        res = self.client.post(
            reverse('estimate-apply-materials', args=[self.project.pk, self.estimate.pk]),
            {'materials': [{'library_item_id': 99999}]}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
