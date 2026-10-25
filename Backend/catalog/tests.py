"""NICARA Catalogue — tests. Run: python manage.py test catalog"""
from decimal import Decimal

from django.core.management import call_command
from django.test import SimpleTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import PagePermission, User
from catalog import rules
from catalog.models import BasicComponent, Furniture, FurnitureComponent, Room
from library.models import MaterialBrand, MaterialCategory, MaterialItem

PASSWORD = 'Str0ng!Passw0rd'


def grant(user, module, level='full'):
    PagePermission.objects.update_or_create(user=user, page_id=module, defaults={'level': level})


def q(calc, rule):
    return float(calc.results[rule][0])


# ════════════════════════════════════════════════════════════════
# Rules (Calculations.xlsx → Sheet1 / Sheet3)
# ════════════════════════════════════════════════════════════════

class RulesTests(SimpleTestCase):
    def tearDown(self):
        rules.RULES['between_mode'] = 'inclusive_min'
        rules.RULES['ply_round_sft'] = 32

    def test_worked_sheet_master_wardrobe(self):
        """7'0" × 9'6" × 2'0" openable wardrobe — the sheet's Master bedroom row."""
        c = rules.compute('wardrobe_openable', 84, 114, 24)
        self.assertEqual(c.counts, {'doors': 4, 'drawers': 4, 'shelves': 2, 'verticals': 3})
        self.assertEqual(q(c, 'back_panel_ply'), 96)       # sheet: 16mm B Board 96 sft
        self.assertEqual(q(c, 'carpentry'), 66.5)          # sheet: 66.5 sft
        self.assertEqual(q(c, 'drawer_channels'), 4)       # sheet: 4 sets
        self.assertEqual(q(c, 'handles'), 4)
        self.assertEqual(q(c, 'knobs'), 4)
        self.assertEqual(q(c, 'drawer_locks'), 2)

    def test_verticals_follow_sheet3(self):
        expected = {2: 2, 3: 3, 4: 3, 5: 4, 6: 4, 7: 5, 8: 5, 9: 6, 10: 6}   # Sheet3 column C
        for doors, verticals in expected.items():
            c = rules.compute('wardrobe_openable', 120, 96, 24, {'overrides': {'doors': doors}})
            self.assertEqual(c.counts['verticals'], verticals, doors)

    def test_openable_doors_between_width_over_24_and_16(self):
        self.assertEqual(rules.compute('wardrobe_openable', 96, 96, 24).counts['doors'], 4)   # 4–6
        self.assertEqual(rules.compute('wardrobe_openable', 65, 96, 24).counts['doors'], 3)   # 2.7–4.1

    def test_max_reading_matches_the_sample_estimate(self):
        """The sample estimate's 8-ft and 9-ft wardrobes have 6 doors each."""
        rules.RULES['between_mode'] = 'max'
        self.assertEqual(rules.compute('wardrobe_openable', 96, 96, 24).counts['doors'], 6)
        self.assertEqual(rules.compute('wardrobe_openable', 108, 108, 24).counts['doors'], 6)
        self.assertEqual(rules.compute('wardrobe_openable', 30, 78, 15).counts['doors'], 2)   # no whole no. in 1.25–1.9

    def test_shelf_spans_one_section(self):
        c = rules.compute('wardrobe_openable', 84, 114, 24)       # 4 doors → 3 verticals → 2 sections
        self.assertEqual(c.geometry['shelf_width'], 42)

    def test_piece_shares_cover_door_drawer_and_shelf_material(self):
        c = rules.compute('wardrobe_openable', 84, 114, 24)
        door_area = 4 * 21 * 114
        self.assertEqual(c.shares['carcass_ply']['doors'], door_area)
        self.assertEqual(c.shares['carcass_ply']['shelves'], 2 * 42 * 24)
        self.assertEqual(c.shares['finish_sheets'], {'doors': door_area, '_total': door_area})
        self.assertEqual(c.shares['hinges'], {'doors': 1, '_total': 1})
        self.assertNotIn('doors', c.shares['drawer_box_ply'])
        glass = rules.compute('wardrobe_openable', 84, 114, 24, {'shelf_type': 'glass'})
        self.assertEqual(glass.shares['carcass_ply']['shelves'], 0)
        self.assertEqual(glass.shares['glass_shelves'], {'shelves': 1, '_total': 1})

    def test_sliding_wardrobe(self):
        c = rules.compute('wardrobe_sliding', 96, 96, 24)
        self.assertEqual(c.counts['doors'], 3)                      # between 96/42 and 96/30
        self.assertEqual(c.counts['drawers'], 6)                    # doors × 2
        self.assertEqual(q(c, 'hinges'), 0)

    def test_kitchen_subtracts_basket_and_bottle_pullout(self):
        c = rules.compute('kitchen_base', 120, 34, 24)
        self.assertEqual(c.counts['doors'], 4)                      # (120 − 36 − 10) = 74 → 3.1–4.6
        self.assertEqual(c.counts['drawers'], 0)

    def test_pooja_drawers(self):
        self.assertEqual(rules.compute('pooja', 20, 48, 15).counts['drawers'], 1)   # under 24"
        self.assertEqual(rules.compute('pooja', 48, 48, 15).counts['drawers'], 2)   # inclusive
        rules.RULES['between_mode'] = 'strict'
        self.assertEqual(rules.compute('pooja', 48, 48, 15).counts['drawers'], 3)   # video's example

    def test_hinges_by_door_height(self):
        def per_door(h):
            return q(rules.compute('wardrobe_openable', 24, h, 24, {'overrides': {'doors': 1}}), 'hinges')
        self.assertEqual(per_door(24), 2)
        self.assertEqual(per_door(25), 3)
        self.assertEqual(per_door(48), 3)
        self.assertEqual(per_door(49), 4)

    def test_ply_rounds_to_whole_sheets_or_half_sheets(self):
        c = rules.compute('wardrobe_openable', 84, 114, 24)
        self.assertEqual(q(c, 'carcass_ply') % 32, 0)
        rules.RULES['ply_round_sft'] = 16
        c16 = rules.compute('wardrobe_openable', 84, 114, 24)
        self.assertEqual(q(c16, 'carcass_ply') % 16, 0)
        self.assertLessEqual(q(c16, 'carcass_ply'), q(c, 'carcass_ply'))

    def test_inner_liner_is_ply_twice_minus_finish(self):
        c = rules.compute('wardrobe_openable', 84, 114, 24)
        ply_sheets = sum(q(c, k) for k in ('carcass_ply', 'back_panel_ply', 'drawer_box_ply')) / 32
        finish = q(c, 'finish_sheets') / 32
        self.assertEqual(q(c, 'inner_liner'), (ply_sheets * 2 - finish) * 32)
        self.assertEqual(float(q(c, 'adhesive_bonding')), ply_sheets * 1.5)

    def test_glass_shelves_leave_the_ply(self):
        ply = rules.compute('crockery_base', 72, 60, 15)
        glass = rules.compute('crockery_base', 72, 60, 15, {'shelf_type': 'glass'})
        self.assertGreater(q(glass, 'glass_shelves'), 0)
        self.assertEqual(q(ply, 'glass_shelves'), 0)

    def test_handleless_drops_handles_and_knobs(self):
        c = rules.compute('wardrobe_openable', 84, 114, 24, {'handleless': True})
        self.assertEqual((q(c, 'handles'), q(c, 'knobs')), (0, 0))

    def test_drawer_override_cascades(self):
        c = rules.compute('wardrobe_openable', 84, 114, 24, {'overrides': {'drawers': 6}})
        self.assertEqual(c.counts['drawers'], 6)
        self.assertEqual(q(c, 'drawer_channels'), 6)
        self.assertEqual(q(c, 'drawer_locks'), 3)

    def test_visible_side_adds_finish(self):
        plain = rules.compute('crockery_base', 72, 60, 15)
        visible = rules.compute('crockery_base', 72, 60, 15, {'one_side_visible': True})
        self.assertGreaterEqual(q(visible, 'finish_sheets'), q(plain, 'finish_sheets'))

    def test_loft_and_panel(self):
        self.assertEqual(rules.compute('loft_box', 84, 24, 24).counts['shelves'], 0)
        panel = rules.compute('panel', 0, 0, 0)
        self.assertEqual(panel.counts['doors'], 0)

    def test_unit_top_and_dado(self):
        c = rules.compute('kitchen_base', 120, 34, 24)
        self.assertAlmostEqual(q(c, 'unit_top'), 120 * 24 / 144 * 1.15, places=2)
        self.assertEqual(q(c, 'dado_tiles'), 20)

    def test_fixed_and_manual_quantities(self):
        c = rules.compute('wardrobe_openable', 84, 114, 24)
        self.assertEqual(c.quantity('fixed', None, 2)[0], Decimal('2.00'))
        qty, _, needs = c.quantity('manual', None, 0)
        self.assertTrue(needs)
        self.assertEqual(c.quantity('hinges', Decimal('5'))[0], Decimal('5.00'))   # fixed per furniture

    def test_parse_inches(self):
        self.assertEqual(rules.parse_inches("7'0\""), 84)
        self.assertEqual(rules.parse_inches("2'3\""), 27)        # the video's example
        self.assertEqual(rules.parse_inches('30"'), 30)
        self.assertEqual(rules.parse_inches('8'), 96)            # bare number ≤ 20 → feet
        self.assertAlmostEqual(rules.parse_inches('600mm'), 23.62, places=2)
        self.assertIsNone(rules.parse_inches('—'))
        self.assertEqual(rules.ft_in(114), (9, 6))

    def test_missing_size_warns(self):
        self.assertTrue(rules.compute('wardrobe_openable', 0, 0, 0).warnings)


# ════════════════════════════════════════════════════════════════
# API
# ════════════════════════════════════════════════════════════════

class CatalogTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='designer@nicara.design', password=PASSWORD,
                                             first_name='Test', last_name='User')
        grant(self.user, 'catalog')
        self.client.force_authenticate(self.user)
        self.ply = MaterialCategory.objects.create(name='Core Material(18mm BWP Ply)', product_group='plywood')
        brand = MaterialBrand.objects.create(name='Gurjan')
        self.gurjan = MaterialItem.objects.create(category=self.ply, brand=brand, model_name='710 BWP',
                                                  default_rate=Decimal('80'), default_unit='sft')
        self.hinge_cat = MaterialCategory.objects.create(name='Box Hinges', product_group='hardware')
        self.bc_ply = BasicComponent.objects.create(
            name='Core Material(18mm BWP Ply)', library_category=self.ply, unit='sft',
            quantity_rule='carcass_ply')
        self.bc_doors = BasicComponent.objects.create(
            name='Doors', item_type='Spec Purpose', quantity_rule='doors', gst_pct=0)
        self.wardrobe = Furniture.objects.create(
            name='Wardrobe', cabinet_type='wardrobe_openable',
            default_length="7'0\"", default_height="9'6\"", default_breadth="2'0\"")
        FurnitureComponent.objects.create(furniture=self.wardrobe, basic_component=self.bc_doors, sort_order=1)
        FurnitureComponent.objects.create(furniture=self.wardrobe, basic_component=self.bc_ply, sort_order=2)


class ApiTests(CatalogTestCase):
    def test_requires_authentication(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(reverse('catalog-furniture-list')).status_code,
                         status.HTTP_401_UNAUTHORIZED)

    def test_view_only_users_cannot_edit(self):
        viewer = User.objects.create_user(email='v@nicara.design', password=PASSWORD,
                                          first_name='V', last_name='W')
        grant(viewer, 'catalog', 'view')
        self.client.force_authenticate(viewer)
        self.assertEqual(self.client.get(reverse('catalog-basic-component-list')).status_code,
                         status.HTTP_200_OK)
        res = self.client.post(reverse('catalog-basic-component-list'), {'name': 'X'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_basic_component_and_reject_unknown_rule(self):
        ok = self.client.post(reverse('catalog-basic-component-list'), {
            'name': 'Box Hinges', 'library_category': self.hinge_cat.pk, 'unit': 'sets',
            'quantity_rule': 'hinges'}, format='json')
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED, ok.data)
        self.assertTrue(ok.data['code'].startswith('BC-'))
        bad = self.client.post(reverse('catalog-basic-component-list'),
                               {'name': 'Mystery', 'quantity_rule': 'guess'}, format='json')
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

    def test_furniture_detail_lists_components_with_rates(self):
        res = self.client.get(reverse('catalog-furniture-detail', args=[self.wardrobe.pk]))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        names = [c['basic_component_name'] for c in res.data['components']]
        self.assertEqual(names, ['Doors', 'Core Material(18mm BWP Ply)'])
        self.assertEqual(res.data['components'][1]['rate'], 80.0)   # cheapest in the category

    def test_add_component_and_reject_wrong_material(self):
        url = reverse('catalog-furniture-component-list', args=[self.wardrobe.pk])
        bc = BasicComponent.objects.create(name='Box Hinges', library_category=self.hinge_cat,
                                           quantity_rule='hinges', unit='sets')
        ok = self.client.post(url, {'basic_component': bc.pk}, format='json')
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED, ok.data)
        self.assertEqual(ok.data['sort_order'], 3)
        bad = self.client.post(url, {'basic_component': bc.pk, 'default_material': self.gurjan.pk},
                               format='json')
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

    def test_calculate_preview_uses_default_size(self):
        res = self.client.post(reverse('catalog-furniture-calculate', args=[self.wardrobe.pk]), {},
                               format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data['calculation']['counts']['doors'], 4)
        doors, ply = res.data['rows'][0], res.data['rows'][1]
        # 192 sft of carcass ply: the shutters' share is priced in the Doors row.
        shutters = doors['parts'][0]
        self.assertEqual(shutters['basic_component'], 'Core Material(18mm BWP Ply)')
        self.assertAlmostEqual(ply['qty'] + shutters['qty'], 192.0)
        self.assertEqual((ply['rate'], ply['brand']), (80.0, 'Gurjan'))
        self.assertEqual(doors['rate'], round(shutters['qty'] * 80 / 4, 2))
        self.assertEqual(res.data['total_cost'], 15360.0)

    def test_calculate_with_size_and_override(self):
        res = self.client.post(reverse('catalog-furniture-calculate', args=[self.wardrobe.pk]),
                               {'width': "4'0\"", 'options': {'overrides': {'doors': 3}}}, format='json')
        self.assertEqual(res.data['rows'][0]['qty'], 3.0)
        self.assertEqual(res.data['rows'][0]['application'], 'Ply - 3 nos')

    def test_room_scoping(self):
        kitchen = Room.objects.create(name='Kitchen')
        base = Furniture.objects.create(name='Kitchen Base', cabinet_type='kitchen_base')
        base.rooms.add(kitchen)
        bedroom = Room.objects.create(name='Bedroom')
        res = self.client.get(reverse('catalog-furniture-list'), {'room': bedroom.pk})
        names = {r['name'] for r in res.data['results']}
        self.assertIn('Wardrobe', names)          # no rooms set → available everywhere
        self.assertNotIn('Kitchen Base', names)

    def test_soft_delete(self):
        self.client.delete(reverse('catalog-furniture-detail', args=[self.wardrobe.pk]))
        self.wardrobe.refresh_from_db()
        self.assertFalse(self.wardrobe.is_active)

    def test_meta_lists_rules_and_cabinet_types(self):
        res = self.client.get(reverse('catalog-meta'))
        self.assertIn('hinges', [r['value'] for r in res.data['rules']])
        self.assertIn('wardrobe_sliding', [c['value'] for c in res.data['cabinet_types']])
        self.assertEqual(res.data['spec_rules'], ['doors', 'drawers', 'shelves'])

    def test_tree(self):
        res = self.client.get(reverse('catalog-tree'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('Wardrobe', [f['name'] for f in res.data['furniture']])


class SeedTests(APITestCase):
    def test_seed_is_idempotent_and_priced_from_the_sheet(self):
        call_command('seed_catalog', verbosity=0)
        counts = (Furniture.objects.count(), BasicComponent.objects.count(), FurnitureComponent.objects.count())
        call_command('seed_catalog', verbosity=0)
        self.assertEqual(counts, (Furniture.objects.count(), BasicComponent.objects.count(),
                                  FurnitureComponent.objects.count()))
        gurjan = MaterialItem.objects.get(category__name='Core Material(16mm BWP Ply)', model_name='710 BWP')
        self.assertEqual(gurjan.default_rate, Decimal('80.00'))
        carpentry = BasicComponent.objects.get(name='Carpentry')
        self.assertEqual((carpentry.item_type, carpentry.gst_pct), ('Service', Decimal('0.00')))

    def test_seeded_wardrobe_matches_the_worked_sheet(self):
        call_command('seed_catalog', verbosity=0)
        user = User.objects.create_user(email='a@nicara.design', password=PASSWORD,
                                        first_name='A', last_name='B', role=User.Role.ADMIN)
        self.client.force_authenticate(user)
        wardrobe = Furniture.objects.get(name='Wardrobe with Openable Shutters')
        res = self.client.post(reverse('catalog-furniture-calculate', args=[wardrobe.pk]), {},
                               format='json')
        rows = {r['specification']: r for r in res.data['rows']}
        self.assertEqual(rows['Drawers']['qty'], 4)
        self.assertEqual(rows['Core Material(16mm BWP B Board)']['qty'], 96)
        self.assertEqual(rows['Carpentry']['qty'], 66.5)
        self.assertEqual(rows['Carpentry']['rate'], 350)
        self.assertEqual(rows['Draw Locks']['qty'], 2)
