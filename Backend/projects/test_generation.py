"""
Initial Estimate generation from the catalogue (calculation sheet rows).

Run: python manage.py test projects.test_generation
"""
from decimal import Decimal

from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from catalog import rules
from catalog.models import Furniture
from library.models import MaterialBrand, MaterialItem
from projects import generation
from projects.models import DesignRequirement, Estimate, EstimateItem, Project

PASSWORD = 'Str0ng!Passw0rd'


class GenerationTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command('seed_catalog', verbosity=0)

    def setUp(self):
        self.user = User.objects.create_user(email='admin@nicara.design', password=PASSWORD,
                                             first_name='N', last_name='A', role=User.Role.ADMIN)
        self.client.force_authenticate(self.user)
        self.project = Project.objects.create(name='Rao Residence', client_name='Rao')
        self.estimate = Estimate.objects.create(project=self.project, type='initial', version=1)
        self.wardrobe = Furniture.objects.get(name='Wardrobe with Openable Shutters')

    def add_wardrobe(self, width=84, height=114, depth=24, **kw):
        rows, _ = generation.create_group(self.estimate, self.wardrobe, width, height, depth,
                                          area='Master Bedroom', zone='East Wall', **kw)
        return rows

    def by_spec(self, group_key):
        return {r.specification: r for r in generation.group_rows(self.estimate, group_key)}

    def parts(self, row):
        return {c.basic_component: c for c in row.components.all()}

    def url(self, name, *extra):
        return reverse(name, args=[self.project.pk, self.estimate.pk, *extra])


class CreateGroupTests(GenerationTestCase):
    def test_rows_follow_the_sheet_layout(self):
        rows = self.add_wardrobe()
        self.assertEqual(rows[0].specification, 'Doors')
        types = [r.item_type for r in rows]
        self.assertEqual(types[:3], ['Spec Purpose'] * 3)
        self.assertIn('Service', types)
        self.assertEqual(len({r.group_key for r in rows}), 1)
        first = rows[0]
        self.assertEqual((first.width_ft, first.width_in, first.height_ft, first.height_in,
                          first.depth_ft), (7, 0, 9, 6, 2))
        self.assertEqual((first.area, first.zone, first.item),
                         ('Master Bedroom', 'East Wall', 'Wardrobe with Openable Shutters'))

    def test_procurement_row_is_priced_and_charged_like_the_sheet(self):
        rows = self.by_spec(self.add_wardrobe()[0].group_key)
        ply = rows['Core Material(16mm BWP B Board)']
        self.assertEqual((ply.brand, ply.model_name, ply.qty, ply.rate), ('Gurjan', '710 BWP', Decimal('96.00'), Decimal('80.00')))
        self.assertEqual(ply.cost, Decimal('7680.00'))
        self.assertEqual(ply.margin_amount, Decimal('1152.00'))                 # 15%
        self.assertEqual(ply.total_amount, Decimal('10421.76'))                 # + 18% GST
        self.assertEqual(ply.calc_basis[:4], 'back')

    def test_doors_are_priced_per_piece(self):
        rows = self.by_spec(self.add_wardrobe()[0].group_key)
        doors = rows['Doors']
        parts = self.parts(doors)
        self.assertEqual(set(parts), {'Core Material(16mm BWP Ply)', 'Box Hinges', 'Inner Liner(Fabric)',
                                      'Edge Banding', 'Finishing - Laminate', 'Handles/Knobs'})
        self.assertEqual(parts['Box Hinges'].qty, Decimal('24.00'))           # 6 per 9'6" door × 4
        self.assertEqual(parts['Handles/Knobs'].qty, Decimal('4.00'))
        self.assertEqual(parts['Finishing - Laminate'].qty, Decimal('96.00'))  # 3 sheets, no visible side
        self.assertEqual(doors.qty, Decimal('4.00'))
        self.assertEqual(doors.cost, sum(c.amount for c in parts.values()))
        self.assertEqual(doors.rate, (doors.cost / 4).quantize(Decimal('0.01')))
        self.assertEqual(doors.gst_pct, Decimal('18.00'))

    def test_piece_materials_leave_the_material_rows(self):
        rows = self.by_spec(self.add_wardrobe()[0].group_key)
        for gone in ('Box Hinges', 'Handles/Knobs', 'Knobs', 'Edge Banding', 'Finishing - Laminate',
                     'Draw Channels', 'Core Material(12mm BWP Ply)'):
            self.assertNotIn(gone, rows)
        # The carcass ply row keeps only what isn't in the shutters and shelves.
        calc = rules.compute('wardrobe_openable', 84, 114, 24)
        total = rules.d2(calc.results['carcass_ply'][0])
        ply = 'Core Material(16mm BWP Ply)'
        in_pieces = self.parts(rows['Doors'])[ply].qty + self.parts(rows['Shelves'])[ply].qty
        self.assertEqual(rows[ply].qty + in_pieces, total)
        liner = 'Inner Liner(Fabric)'
        lined = sum(self.parts(rows[p])[liner].qty for p in ('Doors', 'Drawers', 'Shelves'))
        self.assertEqual(rows[liner].qty + lined, rules.d2(calc.results['inner_liner'][0]))
        drawers = self.parts(rows['Drawers'])
        self.assertEqual(drawers['Draw Channels'].qty, Decimal('4.00'))
        self.assertEqual(drawers['Knobs'].qty, Decimal('4.00'))
        self.assertEqual(rows['Drawers'].application, '4 nos')
        self.assertEqual(rows['Carpentry'].gst_pct, Decimal('0.00'))

    def test_a_visible_side_keeps_a_laminate_row(self):
        rows = self.by_spec(self.add_wardrobe(options={'one_side_visible': True})[0].group_key)
        self.assertIn('Finishing - Laminate', rows)
        door_lam = self.parts(rows['Doors'])['Finishing - Laminate'].qty
        # door 66.5 + side 19 sft → 3 sheets, shared by area
        self.assertEqual(rows['Finishing - Laminate'].qty + door_lam, Decimal('96.00'))
        self.assertGreater(rows['Finishing - Laminate'].qty, 0)

    def test_add_furniture_endpoint(self):
        res = self.client.post(self.url('estimate-add-furniture'), {
            'furniture_id': self.wardrobe.pk, 'area': 'Kids Room', 'width': "8'0\"",
            'height_ft': 9, 'height_in': 6}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        rows = self.by_spec(res.data['group_key'])
        self.assertEqual(rows['Doors'].qty, Decimal('4.00'))
        self.assertEqual((rows['Doors'].width_ft, rows['Doors'].depth_ft), (8, 2))   # depth defaulted


class EditTests(GenerationTestCase):
    def setUp(self):
        super().setUp()
        self.key = self.add_wardrobe()[0].group_key

    def patch(self, row, data):
        return self.client.patch(self.url('estimate-item-detail', row.pk), data, format='json')

    def test_typing_drawers_cascades_through_the_group(self):
        rows = self.by_spec(self.key)
        per_drawer = rows['Drawers'].rate
        res = self.patch(rows['Drawers'], {'qty': 6})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        rows = self.by_spec(self.key)
        self.assertEqual(rows['Drawers'].qty, Decimal('6.00'))
        drawers = self.parts(rows['Drawers'])
        self.assertEqual(drawers['Draw Channels'].qty, Decimal('6.00'))
        self.assertEqual(drawers['Knobs'].qty, Decimal('6.00'))
        self.assertEqual(rows['Draw Locks'].qty, Decimal('3.00'))
        self.assertEqual(rows['Drawers'].config['overrides'], {'drawers': 6})
        # Still a price per drawer: 6 boxes need a second 12mm sheet, whose off-cut they share.
        self.assertEqual(rows['Drawers'].rate, (rows['Drawers'].cost / 6).quantize(Decimal('0.01')))
        self.assertGreater(rows['Drawers'].rate, per_drawer)

    def test_typed_quantity_survives_a_resize(self):
        rows = self.by_spec(self.key)
        self.patch(rows['Adhesive(Bonding)'], {'qty': 20})
        rows = self.by_spec(self.key)
        self.assertTrue(rows['Adhesive(Bonding)'].qty_overridden)
        self.client.post(self.url('estimate-group', self.key), {'width': "10'0\""}, format='json')
        rows = self.by_spec(self.key)
        self.assertEqual(rows['Adhesive(Bonding)'].qty, Decimal('20.00'))   # kept
        self.assertEqual(rows['Doors'].qty, Decimal('5.00'))                # 120" → between 5 and 7.5
        self.assertNotEqual(rows['Adhesive(Bonding)'].calculated_qty, Decimal('20.00'))

    def test_option_change_keeps_typed_counts(self):
        """Regression: toggling an option or resizing must not drop a typed drawer count."""
        self.patch(self.by_spec(self.key)['Drawers'], {'qty': 6})
        self.client.post(self.url('estimate-group', self.key),
                         {'width_ft': 10, 'width_in': 0, 'options': {'handleless': True}}, format='json')
        rows = self.by_spec(self.key)
        self.assertEqual(rows['Drawers'].qty, Decimal('6.00'))
        self.assertEqual(self.parts(rows['Drawers'])['Draw Channels'].qty, Decimal('6.00'))
        self.assertNotIn('Handles/Knobs', self.parts(rows['Doors']))
        self.assertEqual(rows['Doors'].qty, Decimal('5.00'))

    def test_empty_overrides_clear_typed_counts(self):
        self.patch(self.by_spec(self.key)['Drawers'], {'qty': 6})
        self.client.post(self.url('estimate-group', self.key), {'options': {'overrides': {}}}, format='json')
        self.assertEqual(self.by_spec(self.key)['Drawers'].qty, Decimal('4.00'))

    def test_reset_returns_to_the_calculated_quantity(self):
        glue = self.by_spec(self.key)['Adhesive(Bonding)']
        self.patch(glue, {'qty': 20})
        res = self.client.post(self.url('estimate-item-reset-qty', glue.pk))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        glue.refresh_from_db()
        self.assertFalse(glue.qty_overridden)
        self.assertEqual(glue.qty, glue.calculated_qty)

    def test_reset_a_drawer_count_removes_the_override(self):
        drawers = self.by_spec(self.key)['Drawers']
        self.patch(drawers, {'qty': 6})
        self.client.post(self.url('estimate-item-reset-qty', drawers.pk))
        drawers = self.by_spec(self.key)['Drawers']
        self.assertEqual(self.parts(drawers)['Draw Channels'].qty, Decimal('4.00'))

    def test_choosing_a_raw_material_reprices_the_row(self):
        ply = self.by_spec(self.key)['Core Material(16mm BWP Ply)']
        other = MaterialItem.objects.create(category=ply.basic_component.library_category,
                                            model_name='Premium', default_rate=Decimal('95'))
        res = self.patch(ply, {'raw_material': other.pk})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        ply.refresh_from_db()
        self.assertEqual((ply.model_name, ply.rate), ('Premium', Decimal('95.00')))

    def test_choosing_a_part_material_reprices_the_piece(self):
        doors = self.by_spec(self.key)['Doors']
        hinge = self.parts(doors)['Box Hinges']
        better = MaterialItem.objects.get(category__name='Box Hinges', model_name='Onsys - 0 Crank Soft Close')
        url = reverse('estimate-item-component-detail',
                      args=[self.project.pk, self.estimate.pk, doors.pk, hinge.pk])
        res = self.client.patch(url, {'library_material_item': better.pk}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        hinge.refresh_from_db()
        self.assertEqual((hinge.brand, hinge.price), ('Hettich', Decimal('260.00')))
        before = doors.cost
        doors.refresh_from_db()
        self.assertEqual(doors.cost - before, Decimal('24') * (Decimal('260') - Decimal('220')))
        # …and the choice survives a recalculation.
        self.client.post(self.url('estimate-group', self.key), {'width': "8'0\""}, format='json')
        self.assertEqual(self.parts(self.by_spec(self.key)['Doors'])['Box Hinges'].brand, 'Hettich')

    def test_raw_material_must_match_the_component(self):
        ply = self.by_spec(self.key)['Core Material(16mm BWP Ply)']
        hinge = MaterialItem.objects.filter(category__name='Box Hinges').first()
        res = self.patch(ply, {'raw_material': hinge.pk})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_recalculating_an_old_group_moves_its_hardware_into_the_pieces(self):
        """Estimates made before per-piece pricing had a Box Hinges row of their own."""
        bc = self.wardrobe.components.get(basic_component__name='Box Hinges').basic_component
        EstimateItem.objects.create(estimate=self.estimate, group_key=self.key, furniture=self.wardrobe,
                                    basic_component=bc, specification='Box Hinges', item_type='Procurement',
                                    quantity_rule='hinges', qty=24, rate=220)
        self.client.post(self.url('estimate-group', self.key), {}, format='json')
        rows = self.by_spec(self.key)
        self.assertNotIn('Box Hinges', rows)
        self.assertIn('Box Hinges', self.parts(rows['Doors']))

    def test_delete_group(self):
        res = self.client.delete(self.url('estimate-group', self.key))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(EstimateItem.objects.filter(group_key=self.key).exists())

    def test_locked_estimate_cannot_be_recalculated(self):
        self.estimate.status = 'approved'
        self.estimate.save()
        res = self.client.post(self.url('estimate-group', self.key), {'width': "5'0\""}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class DesignRequirementTests(GenerationTestCase):
    def setUp(self):
        super().setUp()
        self.dr = DesignRequirement.objects.create(
            project=self.project, room='Master Bedroom', zone='East Wall', unit='Wardrobe',
            furniture=self.wardrobe, length="7'0\"", height="9'6\"", breadth="2'0\"")
        DesignRequirement.objects.create(project=self.project, room='Living', unit='Sofa')  # unlinked

    def generate(self):
        return self.client.post(self.url('estimate-generate-from-design'))

    def test_generate_creates_groups_and_reports_unlinked(self):
        res = self.generate()
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual((res.data['created'], res.data['updated'], res.data['skipped']), (1, 0, ['Sofa']))
        rows = EstimateItem.objects.filter(estimate=self.estimate, design_requirement=self.dr)
        self.assertTrue(rows.exists())
        self.assertEqual(rows.first().item, 'Wardrobe')

    def test_regenerating_follows_size_edits_and_keeps_choices(self):
        self.generate()
        doors = EstimateItem.objects.get(estimate=self.estimate, specification='Doors')
        hinge = doors.components.get(basic_component='Box Hinges')
        hinge.price = Decimal('300')                    # a chosen price
        hinge.save()
        self.dr.length = "10'0\""
        self.dr.save()
        res = self.generate()
        self.assertEqual((res.data['created'], res.data['updated']), (0, 1))
        doors = EstimateItem.objects.get(estimate=self.estimate, specification='Doors')
        self.assertEqual(doors.qty, Decimal('5.00'))
        self.assertEqual(doors.components.get(basic_component='Box Hinges').price, Decimal('300.00'))

    def test_requirement_options_reach_the_rules(self):
        self.dr.options = {'handleless': True}
        self.dr.save()
        self.generate()
        doors = EstimateItem.objects.get(estimate=self.estimate, specification='Doors')
        self.assertFalse(doors.components.filter(basic_component='Handles/Knobs').exists())

    def test_bulk_save_keeps_requirement_ids(self):
        url = reverse('design-req-bulk', args=[self.project.pk])
        res = self.client.put(url, {'rows': [
            {'id': self.dr.pk, 'room': 'Master Bedroom', 'unit': 'Wardrobe', 'furniture': self.wardrobe.pk,
             'length': "8'0\"", 'height': "9'6\"", 'breadth': "2'0\""},
            {'room': 'Kids Room', 'unit': 'Study', 'length': '4'},
        ]}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data[0]['id'], self.dr.pk)
        self.assertEqual(res.data[0]['furniture_name'], 'Wardrobe with Openable Shutters')
        self.assertEqual(DesignRequirement.objects.filter(project=self.project).count(), 2)   # Sofa removed


class SmartMaterialRowTests(GenerationTestCase):
    def setUp(self):
        super().setUp()
        self.key = self.add_wardrobe()[0].group_key
        rows = self.by_spec(self.key)
        self.century = MaterialBrand.objects.create(name='Century')
        self.century16 = MaterialItem.objects.create(
            category=rows['Core Material(16mm BWP Ply)'].basic_component.library_category,
            brand=self.century, model_name='Club Prime', default_rate=Decimal('110'))
        self.century12 = MaterialItem.objects.create(
            category=self.wardrobe.components.get(basic_component__name='Core Material(12mm BWP Ply)')
            .basic_component.library_category,
            brand=self.century, model_name='Club Prime', default_rate=Decimal('100'))

    def test_a_brand_applies_to_rows_and_piece_parts(self):
        doors_before = self.by_spec(self.key)['Doors'].cost
        res = self.client.post(self.url('estimate-apply-materials'),
                               {'brands': [{'group': 'plywood', 'brand_id': self.century.pk}]}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        rows = self.by_spec(self.key)
        ply = rows['Core Material(16mm BWP Ply)']
        self.assertEqual((ply.brand, ply.rate), ('Century', Decimal('110.00')))
        self.assertEqual(self.parts(rows['Doors'])['Core Material(16mm BWP Ply)'].library_material_item, self.century16)
        self.assertEqual(self.parts(rows['Drawers'])['Core Material(12mm BWP Ply)'].library_material_item, self.century12)
        self.assertGreater(rows['Doors'].cost, doors_before)
        # No Century B Board → that row keeps its brand; hardware is another group.
        self.assertEqual(rows['Core Material(16mm BWP B Board)'].brand, 'Gurjan')
        self.assertEqual(self.parts(rows['Doors'])['Box Hinges'].brand, 'Hafele')
        self.assertGreaterEqual(res.data['brand_result']['unchanged'], 1)

    def test_a_model_choice_still_carries_to_every_ply_thickness(self):
        res = self.client.post(self.url('estimate-apply-materials'),
                               {'materials': [{'library_item_id': self.century16.pk}]}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        rows = self.by_spec(self.key)
        self.assertEqual(rows['Core Material(16mm BWP Ply)'].raw_material, self.century16)
        self.assertEqual(self.parts(rows['Drawers'])['Core Material(12mm BWP Ply)'].library_material_item, self.century12)

    def test_unknown_brand_is_rejected(self):
        res = self.client.post(self.url('estimate-apply-materials'),
                               {'brands': [{'group': 'plywood', 'brand_id': 99999}]}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_smart_options_list_brands_per_group(self):
        res = self.client.get(reverse('smart-estimate-options'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        plywood = {b['name']: b for b in res.data['plywood']}
        self.assertIn('Century', plywood)
        self.assertIn('Austin', plywood)              # from the sample estimate
        self.assertIn('Core Material(16mm BWP Ply)', plywood['Gurjan']['categories'])
        self.assertIn('Hettich', {b['name'] for b in res.data['hardware']})


class DuplicateTests(GenerationTestCase):
    def test_duplicate_keeps_every_column_and_the_breakdowns(self):
        rows = self.add_wardrobe()
        glue = next(r for r in rows if r.specification == 'Adhesive(Bonding)')
        glue.qty, glue.qty_overridden, glue.referral_pct = Decimal('20'), True, Decimal('5')
        glue.save()
        res = self.client.post(reverse('estimate-duplicate', args=[self.project.pk, self.estimate.pk]),
                               {'type': 'final'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        clone = Estimate.objects.get(pk=res.data['id'])
        copy = clone.items.get(specification='Adhesive(Bonding)')
        self.assertEqual((copy.qty, copy.qty_overridden, copy.referral_pct, copy.brand, copy.width_ft),
                         (Decimal('20.00'), True, Decimal('5.00'), 'Fevicol', 7))
        self.assertEqual(clone.items.count(), len(rows))
        self.assertEqual(clone.items.get(specification='Doors').components.count(), 6)
        self.assertEqual(clone.grand_total, self.estimate.grand_total)
