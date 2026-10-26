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

    def test_service_rows_carry_no_gst_and_spec_rows_cost_nothing(self):
        rows = self.by_spec(self.add_wardrobe()[0].group_key)
        self.assertEqual(rows['Carpentry'].gst_pct, Decimal('0.00'))
        self.assertEqual(rows['Carpentry'].qty, Decimal('66.50'))
        self.assertEqual(rows['Drawers'].cost, Decimal('0.00'))
        self.assertEqual(rows['Drawers'].application, '4 nos')

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
        res = self.patch(rows['Drawers'], {'qty': 6})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        rows = self.by_spec(self.key)
        self.assertEqual(rows['Drawers'].qty, Decimal('6.00'))
        self.assertEqual(rows['Draw Channels'].qty, Decimal('6.00'))
        self.assertEqual(rows['Knobs'].qty, Decimal('6.00'))
        self.assertEqual(rows['Draw Locks'].qty, Decimal('3.00'))
        self.assertEqual(rows['Drawers'].config['overrides'], {'drawers': 6})

    def test_typed_quantity_survives_a_resize(self):
        rows = self.by_spec(self.key)
        self.patch(rows['Box Hinges'], {'qty': 14})                 # the sheet's figure
        rows = self.by_spec(self.key)
        self.assertTrue(rows['Box Hinges'].qty_overridden)
        self.client.post(self.url('estimate-group', self.key), {'width': "10'0\""}, format='json')
        rows = self.by_spec(self.key)
        self.assertEqual(rows['Box Hinges'].qty, Decimal('14.00'))   # kept
        self.assertEqual(rows['Doors'].qty, Decimal('5.00'))         # 120" → between 5 and 7.5
        self.assertNotEqual(rows['Box Hinges'].calculated_qty, Decimal('14.00'))

    def test_option_change_keeps_typed_counts(self):
        """Regression: toggling an option or resizing must not drop a typed drawer count."""
        self.patch(self.by_spec(self.key)['Drawers'], {'qty': 6})
        self.client.post(self.url('estimate-group', self.key),
                         {'width_ft': 10, 'width_in': 0, 'options': {'handleless': True}}, format='json')
        rows = self.by_spec(self.key)
        self.assertEqual(rows['Drawers'].qty, Decimal('6.00'))
        self.assertEqual(rows['Draw Channels'].qty, Decimal('6.00'))
        self.assertEqual(rows['Handles/Knobs'].qty, Decimal('0.00'))
        self.assertEqual(rows['Doors'].qty, Decimal('5.00'))

    def test_empty_overrides_clear_typed_counts(self):
        self.patch(self.by_spec(self.key)['Drawers'], {'qty': 6})
        self.client.post(self.url('estimate-group', self.key), {'options': {'overrides': {}}}, format='json')
        self.assertEqual(self.by_spec(self.key)['Drawers'].qty, Decimal('4.00'))

    def test_reset_returns_to_the_calculated_quantity(self):
        hinges = self.by_spec(self.key)['Box Hinges']
        self.patch(hinges, {'qty': 14})
        res = self.client.post(self.url('estimate-item-reset-qty', hinges.pk))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        hinges.refresh_from_db()
        self.assertFalse(hinges.qty_overridden)
        self.assertEqual(hinges.qty, hinges.calculated_qty)

    def test_reset_a_drawer_count_removes_the_override(self):
        drawers = self.by_spec(self.key)['Drawers']
        self.patch(drawers, {'qty': 6})
        self.client.post(self.url('estimate-item-reset-qty', drawers.pk))
        self.assertEqual(self.by_spec(self.key)['Draw Channels'].qty, Decimal('4.00'))

    def test_choosing_a_raw_material_reprices_the_row(self):
        ply = self.by_spec(self.key)['Core Material(16mm BWP Ply)']
        other = MaterialItem.objects.create(category=ply.basic_component.library_category,
                                            model_name='Premium', default_rate=Decimal('95'))
        res = self.patch(ply, {'raw_material': other.pk})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        ply.refresh_from_db()
        self.assertEqual((ply.model_name, ply.rate), ('Premium', Decimal('95.00')))

    def test_raw_material_must_match_the_component(self):
        ply = self.by_spec(self.key)['Core Material(16mm BWP Ply)']
        hinge = MaterialItem.objects.filter(category__name='Box Hinges').first()
        res = self.patch(ply, {'raw_material': hinge.pk})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

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
        hinge = EstimateItem.objects.get(estimate=self.estimate, specification='Box Hinges')
        hinge.rate = Decimal('300')                     # a chosen price
        hinge.save()
        self.dr.length = "10'0\""
        self.dr.save()
        res = self.generate()
        self.assertEqual((res.data['created'], res.data['updated']), (0, 1))
        doors = EstimateItem.objects.get(estimate=self.estimate, specification='Doors')
        self.assertEqual(doors.qty, Decimal('5.00'))
        hinge.refresh_from_db()
        self.assertEqual(hinge.rate, Decimal('300.00'))

    def test_requirement_options_reach_the_rules(self):
        self.dr.options = {'handleless': True}
        self.dr.save()
        self.generate()
        handles = EstimateItem.objects.get(estimate=self.estimate, specification='Handles/Knobs')
        self.assertEqual(handles.qty, Decimal('0.00'))

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
    def test_brand_choice_carries_to_every_ply_thickness(self):
        key = self.add_wardrobe()[0].group_key
        century = MaterialBrand.objects.create(name='Century')
        ply16 = self.by_spec(key)['Core Material(16mm BWP Ply)'].basic_component.library_category
        century16 = MaterialItem.objects.create(
            category=ply16, brand=century, model_name='Club Prime', default_rate=Decimal('110'))
        ply12 = self.by_spec(key)['Core Material(12mm BWP Ply)'].basic_component.library_category
        century12 = MaterialItem.objects.create(
            category=ply12, brand=century, model_name='Club Prime', default_rate=Decimal('100'))
        res = self.client.post(self.url('estimate-apply-materials'),
                               {'materials': [{'library_item_id': century16.pk}]}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        rows = self.by_spec(key)
        self.assertEqual((rows['Core Material(16mm BWP Ply)'].brand, rows['Core Material(16mm BWP Ply)'].rate),
                         ('Century', Decimal('110.00')))
        self.assertEqual(rows['Core Material(12mm BWP Ply)'].raw_material, century12)
        # No Century B Board → that row keeps its brand.
        self.assertEqual(rows['Core Material(16mm BWP B Board)'].brand, 'Gurjan')
        self.assertEqual(rows['Box Hinges'].brand, 'Hafele')


    def test_a_brand_per_group_applies_to_matching_rows(self):
        key = self.add_wardrobe()[0].group_key
        century = MaterialBrand.objects.create(name='Century')
        ply12 = self.by_spec(key)['Core Material(12mm BWP Ply)'].basic_component.library_category
        MaterialItem.objects.create(category=ply12, brand=century, model_name='Club Prime',
                                    default_rate=Decimal('100'))
        res = self.client.post(self.url('estimate-apply-materials'),
                               {'brands': [{'group': 'plywood', 'brand_id': century.pk}]}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        rows = self.by_spec(key)
        self.assertEqual((rows['Core Material(12mm BWP Ply)'].brand, rows['Core Material(12mm BWP Ply)'].rate),
                         ('Century', Decimal('100.00')))
        self.assertEqual(rows['Core Material(16mm BWP Ply)'].brand, 'Gurjan')   # no Century 16mm
        self.assertEqual(res.data['brand_result'], {'changed': 1, 'unchanged': 2})

    def test_smart_options_list_brands_per_group(self):
        res = self.client.get(reverse('smart-estimate-options'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        plywood = {b['name']: b for b in res.data['plywood']}
        self.assertIn('Austin', plywood)                  # from the sample estimate
        self.assertIn('Core Material(16mm BWP Ply)', plywood['Gurjan']['categories'])
        self.assertIn('Hettich', {b['name'] for b in res.data['hardware']})


class PerPieceCleanupTests(GenerationTestCase):
    def test_recalculating_restores_rows_folded_into_doors(self):
        """Groups made while Doors were priced per piece go back to the sheet layout."""
        rows = self.add_wardrobe()
        key = rows[0].group_key
        doors = self.by_spec(key)['Doors']
        doors.components.create(basic_component='Box Hinges', qty=24, price=220)
        doors.refresh_from_db()
        doors.rate = Decimal('1320')
        doors.save()
        EstimateItem.objects.filter(group_key=key, specification__in=['Box Hinges', 'Edge Banding']).delete()
        call_command('recalculate_groups', verbosity=0)
        rows = self.by_spec(key)
        self.assertEqual(rows['Box Hinges'].qty, Decimal('24.00'))
        self.assertIn('Edge Banding', rows)
        self.assertFalse(rows['Doors'].components.exists())
        self.assertEqual((rows['Doors'].rate, rows['Doors'].cost), (Decimal('0.00'), Decimal('0.00')))
        self.assertEqual(len(rows), len(self.wardrobe.components.all()))


class DuplicateTests(GenerationTestCase):
    def test_duplicate_keeps_every_column(self):
        rows = self.add_wardrobe()
        hinges = next(r for r in rows if r.specification == 'Box Hinges')
        hinges.qty, hinges.qty_overridden, hinges.referral_pct = Decimal('14'), True, Decimal('5')
        hinges.save()
        res = self.client.post(reverse('estimate-duplicate', args=[self.project.pk, self.estimate.pk]),
                               {'type': 'final'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        clone = Estimate.objects.get(pk=res.data['id'])
        copy = clone.items.get(specification='Box Hinges')
        self.assertEqual((copy.qty, copy.qty_overridden, copy.referral_pct, copy.brand, copy.width_ft),
                         (Decimal('14.00'), True, Decimal('5.00'), 'Hafele', 7))
        self.assertEqual(clone.items.count(), len(rows))
        self.assertEqual(clone.grand_total, self.estimate.grand_total)
