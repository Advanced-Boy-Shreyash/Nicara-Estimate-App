"""NICARA Items — catalogue tests. Run: python manage.py test items"""
from decimal import Decimal

from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import PagePermission, User
from items.models import Item, ItemCategory, ItemComponent
from library.models import MaterialBrand, MaterialCategory, MaterialItem

PASSWORD = 'Str0ng!Passw0rd'


def grant(user, module, level='full'):
    """Give a non-admin test user access to a module in the IAM matrix."""
    PagePermission.objects.update_or_create(
        user=user, page_id=module, defaults={'level': level}
    )


class ItemCatalogueTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='designer@nicara.design', password=PASSWORD,
            first_name='Test', last_name='User',
        )
        grant(self.user, 'items')
        self.client.force_authenticate(self.user)
        self.category = ItemCategory.objects.create(name='Carpentry', sort_order=1)
        self.item = Item.objects.create(
            name='Wardrobe 8ft', category=self.category, default_room='Master Bedroom',
            unit=Item.Unit.UNIT, default_rate=Decimal('145000'), gst_pct=18,
            default_length="8'0\"", default_breadth="2'0\"", default_height="8'0\"",
        )

    def test_requires_authentication(self):
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.get(reverse('item-list')).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_code_is_generated_from_category_and_name(self):
        self.assertTrue(self.item.code.startswith('CARP-'))

    def test_duplicate_names_get_distinct_codes(self):
        twin = Item.objects.create(name='Wardrobe 8ft', category=self.category)
        self.assertNotEqual(twin.code, self.item.code)

    def test_list_and_filter_by_category(self):
        other = ItemCategory.objects.create(name='False Ceiling')
        Item.objects.create(name='Gypsum Ceiling', category=other, unit=Item.Unit.SFT)

        res = self.client.get(reverse('item-list'), {'category': self.category.pk})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual([r['name'] for r in res.data['results']], ['Wardrobe 8ft'])

    def test_search_matches_room_and_description(self):
        res = self.client.get(reverse('item-list'), {'search': 'Master Bedroom'})
        self.assertEqual(len(res.data['results']), 1)

    def test_min_rate_cannot_exceed_max_rate(self):
        res = self.client.post(reverse('item-list'), {
            'name': 'Bad Rates', 'category': self.category.pk,
            'min_rate': 500, 'max_rate': 100,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('min_rate', res.data['errors'])

    def test_delete_retires_the_item(self):
        res = self.client.delete(reverse('item-detail', args=[self.item.pk]))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.item.refresh_from_db()
        self.assertFalse(self.item.is_active)

    def test_as_estimate_line_copies_defaults(self):
        line = self.item.as_estimate_line()
        self.assertEqual(line['item'], 'Wardrobe 8ft')
        self.assertEqual(line['area'], 'Master Bedroom')
        self.assertEqual(line['rate'], Decimal('145000'))
        self.assertEqual(line['catalog_item'], self.item)

    def test_as_estimate_line_accepts_overrides(self):
        line = self.item.as_estimate_line(area='Guest Bedroom', qty=2)
        self.assertEqual(line['area'], 'Guest Bedroom')
        self.assertEqual(line['qty'], 2)

    def test_meta_exposes_units_rooms_and_categories(self):
        res = self.client.get(reverse('item-meta'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('Master Bedroom', res.data['rooms'])
        self.assertTrue(any(u['value'] == 'sft' for u in res.data['units']))
        self.assertEqual(res.data['counts']['items'], 1)


class ItemComponentTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='designer@nicara.design', password=PASSWORD,
            first_name='Test', last_name='User',
        )
        grant(self.user, 'items')
        self.client.force_authenticate(self.user)
        self.category = ItemCategory.objects.create(name='Carpentry')
        self.item = Item.objects.create(name='Wardrobe', category=self.category, margin_pct=50)

        lib_cat = MaterialCategory.objects.create(name='Core Material')
        brand = MaterialBrand.objects.create(category=lib_cat, name='Austin')
        self.ply = MaterialItem.objects.create(
            brand=brand, model_name='Lincoln BWP', default_rate=Decimal('100'),
            default_unit='sheets',
        )

    def test_component_cost_includes_wastage(self):
        ItemComponent.objects.create(
            item=self.item, material_item=self.ply,
            qty_per_unit=Decimal('10'), wastage_pct=Decimal('10'),
        )
        # 10 sheets × 1.10 wastage × ₹100 = ₹1100
        self.assertEqual(self.item.component_cost, Decimal('1100.000'))

    def test_suggested_rate_applies_margin(self):
        ItemComponent.objects.create(
            item=self.item, material_item=self.ply, qty_per_unit=Decimal('10'),
        )
        # ₹1000 cost + 50% margin
        self.assertEqual(self.item.suggested_rate, Decimal('1500.000'))

    def test_suggested_rate_is_zero_without_a_bom(self):
        self.assertEqual(self.item.suggested_rate, Decimal('0'))

    def test_rate_override_wins_over_library_rate(self):
        component = ItemComponent.objects.create(
            item=self.item, material_item=self.ply,
            qty_per_unit=Decimal('1'), rate_override=Decimal('250'),
        )
        self.assertEqual(component.effective_rate, Decimal('250'))

    def test_component_needs_a_link_or_a_label(self):
        res = self.client.post(
            reverse('item-component-list', args=[self.item.pk]),
            {'qty_per_unit': 1}, format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_component_cannot_link_material_and_service(self):
        from library.models import ServiceItem
        service = ServiceItem.objects.create(name='Box Carpentry', category='Carpentry')
        res = self.client.post(
            reverse('item-component-list', args=[self.item.pk]),
            {'material_item': self.ply.pk, 'service_item': service.pk, 'qty_per_unit': 1},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class SeedItemsCommandTests(APITestCase):
    def test_seed_is_idempotent(self):
        call_command('seed_items', verbosity=0)
        first = Item.objects.count()
        self.assertGreater(first, 20)

        call_command('seed_items', verbosity=0)
        self.assertEqual(Item.objects.count(), first)

    def test_seeded_items_carry_estimate_fields(self):
        call_command('seed_items', verbosity=0)
        wardrobe = Item.objects.get(name="Wardrobe 8'x2'x8'")
        self.assertEqual(wardrobe.default_room, 'Master Bedroom')
        self.assertEqual(wardrobe.default_rate, Decimal('145000.00'))
        self.assertEqual(wardrobe.default_length, "8'0\"")
        self.assertEqual(wardrobe.gst_pct, Decimal('18.00'))

        ceiling = Item.objects.get(name='False Ceiling — Gypsum')
        self.assertEqual(ceiling.unit, Item.Unit.SFT)
        self.assertEqual(ceiling.calc_method, Item.CalcMethod.AREA_LB)
        self.assertEqual(ceiling.default_qty, Decimal('168.00'))
