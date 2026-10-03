"""
Cabinet calculation engine tests. Run: python manage.py test catalog

These pin the *behaviour* (scaling, defaults, validation, pricing source),
not the provisional constants — when the client-verified formulas replace
RULES, only the few exact-number assertions should need updating.
"""
from decimal import Decimal

from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from catalog import estimator
from projects.models import Estimate, EstimateItem, Project

PASSWORD = 'Str0ng!Passw0rd'


def rows_by(result):
    return {(r['basic_component'], r['detail']): r for r in result['rows']}


class EngineTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command('seed_catalog', verbosity=0)

    def test_default_template_is_two_drawers_one_door_one_shelf(self):
        c = estimator.calculate()['config']
        self.assertEqual(c['template'], 'base_cabinet')
        self.assertEqual((c['drawers'], c['doors'], c['shelves']), (2, 1, 1))

    def test_one_drawer_needs_two_slides_three_need_six(self):
        q1 = estimator.calculate({'drawers': 1})['quantities']
        q3 = estimator.calculate({'drawers': 3})['quantities']
        self.assertEqual(q1['slides'], 2)
        self.assertEqual(q3['slides'], 6)

    def test_handles_and_screws_scale_with_drawers(self):
        q2 = estimator.calculate({'drawers': 2})['quantities']
        q3 = estimator.calculate({'drawers': 3})['quantities']
        self.assertEqual(q3['handles'] - q2['handles'], 1)
        self.assertGreater(q3['screws'], q2['screws'])

    def test_bigger_cabinet_needs_more_plywood(self):
        small = estimator.calculate({'length': 600})['quantities']['plywood']['18mm']['net_sft']
        large = estimator.calculate({'length': 1200})['quantities']['plywood']['18mm']['net_sft']
        self.assertGreater(large, small)

    def test_thickness_change_reprices_carcass(self):
        r = estimator.calculate({'carcass_thickness': 16, 'shutter_thickness': 18})
        self.assertIn('16mm', r['quantities']['plywood'])
        ply16 = rows_by(r)[('Plywood', '16mm BWP Plywood')]
        self.assertEqual(ply16['price'], Decimal('90.00'))   # seeded Austin Lincoln 16mm

    def test_smaller_board_needs_more_sheets(self):
        big = estimator.calculate({'board': '8x4 ft', 'drawers': 0})['quantities']['plywood']['18mm']
        small = estimator.calculate({'board': '1x1 m', 'drawers': 0})['quantities']['plywood']['18mm']
        self.assertGreaterEqual(small['sheets'], big['sheets'])

    def test_tall_doors_get_more_hinges(self):
        r = estimator.calculate({'template': 'tall_unit'})   # 2100mm doors
        self.assertEqual(r['quantities']['hinges'], 2 * 4)

    def test_amount_is_qty_times_price_and_total_sums(self):
        r = estimator.calculate()
        for row in r['rows']:
            self.assertEqual(row['amount'], (row['qty'] * row['price']).quantize(Decimal('0.01')))
        self.assertEqual(r['total'], sum(row['amount'] for row in r['rows']))

    def test_every_row_explains_itself(self):
        for row in estimator.calculate()['rows']:
            self.assertTrue(row['basis'])

    def test_no_finish_drops_laminate_and_adhesive(self):
        names = {r['basic_component'] for r in estimator.calculate({'finish': 'none'})['rows']}
        self.assertNotIn('Laminate', names)
        self.assertNotIn('Adhesive', names)

    def test_too_many_drawers_for_height_rejected(self):
        with self.assertRaises(estimator.ConfigError) as ctx:
            estimator.calculate({'height': 300, 'drawers': 3})
        self.assertIn('drawers', ctx.exception.errors)

    def test_drawers_must_leave_room_for_doors(self):
        with self.assertRaises(estimator.ConfigError) as ctx:
            estimator.calculate({'height': 720, 'drawers': 4, 'doors': 1})
        self.assertIn('doors', ctx.exception.errors)

    def test_out_of_range_size_rejected(self):
        with self.assertRaises(estimator.ConfigError) as ctx:
            estimator.calculate({'length': 50})
        self.assertIn('length', ctx.exception.errors)

    def test_hint_picks_template_and_sizes(self):
        c = estimator.calculate(hint={'name': 'Wardrobe 8ft', 'length': "8'0\"",
                                      'breadth': "2'0\"", 'height': "8'0\""})['config']
        self.assertEqual(c['template'], 'wardrobe')
        self.assertAlmostEqual(c['length'], 2438, delta=1)
        self.assertAlmostEqual(c['depth'], 610, delta=1)

    def test_missing_catalogue_price_falls_back_and_warns(self):
        from catalog.models import Material
        Material.objects.filter(name='Handle').delete()
        r = estimator.calculate()
        handle = next(row for row in r['rows'] if row['basic_component'] == 'Handle')
        self.assertEqual(handle['source'], 'provisional')
        self.assertTrue(any('Handle' in w for w in r['warnings']))

    def test_parse_dimension(self):
        self.assertAlmostEqual(estimator.parse_dimension("2'6\""), 762, delta=0.1)
        self.assertEqual(estimator.parse_dimension('600mm'), 600)
        self.assertEqual(estimator.parse_dimension('1.2m'), 1200)
        self.assertAlmostEqual(estimator.parse_dimension('8'), 2438.4, delta=0.1)
        self.assertIsNone(estimator.parse_dimension('—'))


class ConfigureApiTests(APITestCase):
    def setUp(self):
        call_command('seed_catalog', verbosity=0)
        self.user = User.objects.create_user(
            email='admin@nicara.design', password=PASSWORD,
            first_name='N', last_name='A', role=User.Role.ADMIN)
        self.client.force_authenticate(self.user)
        self.project = Project.objects.create(name='Test Home', client_name='Client')
        self.estimate = Estimate.objects.create(
            project=self.project, type=Estimate.EstimateType.INTERMEDIATE, version=1)
        self.line = EstimateItem.objects.create(
            estimate=self.estimate, area='Kitchen', item='Kitchen Base Unit', qty=1, rate=0)

    def url(self):
        return reverse('estimate-item-configure',
                       args=[self.project.pk, self.estimate.pk, self.line.pk])

    def test_preview_does_not_save(self):
        res = self.client.post(reverse('catalog-estimator-preview'),
                               {'config': {'drawers': 3}}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data['quantities']['slides'], 6)
        self.assertEqual(self.line.components.count(), 0)

    def test_preview_reports_validation_errors(self):
        res = self.client.post(reverse('catalog-estimator-preview'),
                               {'config': {'length': 10}}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('length', res.data['errors'])

    def test_meta_lists_templates_and_boards(self):
        res = self.client.get(reverse('catalog-estimator-meta'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('1x1 m', res.data['boards'])
        self.assertTrue(any(t['key'] == 'drawer_unit' for t in res.data['templates']))

    def test_configure_replaces_breakdown_and_rolls_up(self):
        res = self.client.post(self.url(), {'config': {'drawers': 3}}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.line.refresh_from_db()
        self.assertEqual(self.line.config['drawers'], 3)
        slides = self.line.components.get(basic_component='Drawer Channel')
        self.assertEqual(slides.qty, Decimal('6.00'))
        self.assertEqual(self.line.amount, Decimal(res.data['result']['total']))

    def test_reconfigure_recalculates(self):
        self.client.post(self.url(), {'config': {'drawers': 2}}, format='json')
        first = EstimateItem.objects.get(pk=self.line.pk).amount
        res = self.client.post(self.url(), {'config': {'drawers': 3}}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        second = EstimateItem.objects.get(pk=self.line.pk).amount
        self.assertGreater(second, first)

    def test_auto_uses_default_template(self):
        res = self.client.post(self.url(), {'auto': True}, format='json')
        self.assertTrue(res.data['configured'])
        self.line.refresh_from_db()
        self.assertEqual(self.line.config['template'], 'base_cabinet')
        self.assertGreater(self.line.amount, 0)

    def test_auto_skips_non_cabinet_items(self):
        self.line.item = 'Painting'
        self.line.save()
        res = self.client.post(self.url(), {'auto': True}, format='json')
        self.assertFalse(res.data['configured'])
        self.assertEqual(self.line.components.count(), 0)

    def test_reconfigure_keeps_exact_dimensions(self):
        self.client.post(self.url(), {'config': {'height': 720}}, format='json')
        res = self.client.post(self.url(), {'config': {'drawers': 3}}, format='json')
        self.assertEqual(res.data['result']['config']['height'], 720)

    def test_add_from_catalog_auto_configures_unpriced_cabinet(self):
        from items.models import Item, ItemCategory
        cat = ItemCategory.objects.create(name='Carpentry')
        unpriced = Item.objects.create(name='Base Cabinet', category=cat, default_rate=0)
        priced = Item.objects.create(name='Drawer Unit', category=cat, default_rate=Decimal('20000'))
        url = reverse('estimate-item-from-catalog', args=[self.project.pk, self.estimate.pk])
        self.client.post(url, {'items': [{'item_id': unpriced.pk}, {'item_id': priced.pk}]}, format='json')

        auto = self.estimate.items.get(catalog_item=unpriced)
        self.assertEqual(auto.config['template'], 'base_cabinet')
        self.assertGreater(auto.components.count(), 0)

        kept = self.estimate.items.get(catalog_item=priced)
        self.assertIsNone(kept.config)                       # catalogue rate wins
        self.assertEqual(kept.amount, Decimal('20000.00'))

    def test_locked_estimate_cannot_be_configured(self):
        self.estimate.status = 'approved'
        self.estimate.save()
        res = self.client.post(self.url(), {'config': {}}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
