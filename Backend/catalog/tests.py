"""NICARA Catalogue — tests. Run: python manage.py test catalog"""
from decimal import Decimal

from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import PagePermission, User
from catalog.models import (
    Furniture, FurniturePart, Material, MaterialOption, PartMaterial, Room, Zone,
)

PASSWORD = 'Str0ng!Passw0rd'


def grant(user, module, level='full'):
    PagePermission.objects.update_or_create(
        user=user, page_id=module, defaults={'level': level})


class CatalogTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='designer@nicara.design', password=PASSWORD,
            first_name='Test', last_name='User',
        )
        grant(self.user, 'catalog')
        self.client.force_authenticate(self.user)


class CodeAndStructureTests(CatalogTestCase):
    def test_room_code_generated(self):
        room = Room.objects.create(name='Master Bedroom')
        self.assertTrue(room.code.startswith('ROOM-'))

    def test_furniture_code_generated(self):
        f = Furniture.objects.create(name='Wardrobe')
        self.assertTrue(f.code.startswith('FURN-'))

    def test_material_code_generated(self):
        m = Material.objects.create(name='Plywood')
        self.assertTrue(m.code.startswith('MAT-'))

    def test_duplicate_names_get_distinct_codes(self):
        a = Material.objects.create(name='Plywood')
        Material.objects.filter(pk=a.pk).update(name='Ply A')  # free the unique name
        b = Material.objects.create(name='Plywood')
        self.assertNotEqual(a.code, b.code)

    def test_option_label(self):
        m = Material.objects.create(name='Plywood')
        o = MaterialOption.objects.create(
            material=m, detail='18mm Plywood', brand='Austin', model_no='Lincoln', size='8x4')
        self.assertEqual(o.label, '18mm Plywood · Austin · Lincoln · 8x4')


class CostRollupTests(CatalogTestCase):
    def setUp(self):
        super().setUp()
        self.ply = Material.objects.create(name='Plywood', default_unit='sft')
        MaterialOption.objects.create(material=self.ply, detail='18mm', price=Decimal('100'), unit='sft')
        MaterialOption.objects.create(material=self.ply, detail='8mm', price=Decimal('60'), unit='sft')

        self.furniture = Furniture.objects.create(name='Wardrobe', margin_pct=Decimal('35'))
        self.part = FurniturePart.objects.create(furniture=self.furniture, name='Cabinet')

    def test_effective_option_is_cheapest_when_unpinned(self):
        pm = PartMaterial.objects.create(part=self.part, material=self.ply, qty_per_unit=Decimal('10'))
        self.assertEqual(pm.effective_option.price, Decimal('60'))

    def test_pinned_option_wins(self):
        pinned = self.ply.options.get(price=100)
        pm = PartMaterial.objects.create(
            part=self.part, material=self.ply, default_option=pinned, qty_per_unit=Decimal('10'))
        self.assertEqual(pm.unit_price, Decimal('100'))

    def test_line_cost_includes_wastage(self):
        pinned = self.ply.options.get(price=100)
        pm = PartMaterial.objects.create(
            part=self.part, material=self.ply, default_option=pinned,
            qty_per_unit=Decimal('10'), wastage_pct=Decimal('10'))
        # 10 × 1.10 × 100 = 1100
        self.assertEqual(pm.line_cost, Decimal('1100.00'))

    def test_furniture_cost_and_suggested_rate(self):
        pinned = self.ply.options.get(price=100)
        PartMaterial.objects.create(
            part=self.part, material=self.ply, default_option=pinned, qty_per_unit=Decimal('10'))
        self.assertEqual(self.furniture.material_cost, Decimal('1000.00'))
        # +35% margin
        self.assertEqual(self.furniture.suggested_rate, Decimal('1350.00'))

    def test_suggested_rate_zero_without_bom(self):
        self.assertEqual(self.furniture.suggested_rate, Decimal('0.00'))


class RoomScopingTests(CatalogTestCase):
    def setUp(self):
        super().setUp()
        self.kitchen = Room.objects.create(name='Kitchen')
        self.bedroom = Room.objects.create(name='Master Bedroom')

        self.base_unit = Furniture.objects.create(name='Kitchen Base Unit')
        self.base_unit.rooms.set([self.kitchen])
        self.wardrobe = Furniture.objects.create(name='Wardrobe')
        self.wardrobe.rooms.set([self.bedroom])
        self.paint = Furniture.objects.create(name='Paint')  # universal, no rooms

    def test_room_filter_returns_scoped_plus_universal(self):
        res = self.client.get(reverse('catalog-furniture-list'), {'room': self.kitchen.pk})
        names = {f['name'] for f in res.data['results']}
        self.assertIn('Kitchen Base Unit', names)
        self.assertIn('Paint', names)               # universal shows everywhere
        self.assertNotIn('Wardrobe', names)          # bedroom-only, hidden

    def test_unfiltered_returns_all(self):
        res = self.client.get(reverse('catalog-furniture-list'))
        self.assertEqual(res.data['count'], 3)


class ApiTests(CatalogTestCase):
    def test_requires_permission(self):
        stranger = User.objects.create_user(
            email='nobody@nicara.design', password=PASSWORD,
            first_name='No', last_name='Access')
        self.client.force_authenticate(stranger)
        self.assertEqual(
            self.client.get(reverse('catalog-room-list')).status_code,
            status.HTTP_403_FORBIDDEN)

    def test_view_only_blocks_writes(self):
        viewer = User.objects.create_user(
            email='viewer@nicara.design', password=PASSWORD,
            first_name='View', last_name='Only')
        grant(viewer, 'catalog', 'view')
        self.client.force_authenticate(viewer)
        self.assertEqual(self.client.get(reverse('catalog-room-list')).status_code,
                         status.HTTP_200_OK)
        res = self.client.post(reverse('catalog-room-list'), {'name': 'Study'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_material_with_options(self):
        material = self.client.post(reverse('catalog-material-list'),
                                    {'name': 'Plywood', 'default_unit': 'sft'}, format='json')
        self.assertEqual(material.status_code, status.HTTP_201_CREATED, material.data)
        mid = material.data['id']
        option = self.client.post(
            reverse('catalog-option-list', args=[mid]),
            {'detail': '18mm Plywood', 'brand': 'Austin', 'model_no': 'Lincoln',
             'size': '8x4', 'price': '100', 'unit': 'sft'}, format='json')
        self.assertEqual(option.status_code, status.HTTP_201_CREATED, option.data)

    def test_negative_price_rejected(self):
        m = Material.objects.create(name='Plywood')
        res = self.client.post(reverse('catalog-option-list', args=[m.pk]),
                               {'detail': 'x', 'price': '-5'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_option_must_match_material(self):
        ply = Material.objects.create(name='Plywood')
        hardware = Material.objects.create(name='Hardware')
        ply_option = MaterialOption.objects.create(material=ply, detail='18mm', price=100)
        furniture = Furniture.objects.create(name='Wardrobe')
        part = FurniturePart.objects.create(furniture=furniture, name='Cabinet')

        res = self.client.post(
            reverse('catalog-partmaterial-list', args=[part.pk]),
            {'material': hardware.pk, 'default_option': ply_option.pk, 'qty_per_unit': '2'},
            format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_deactivates(self):
        room = Room.objects.create(name='Study')
        res = self.client.delete(reverse('catalog-room-detail', args=[room.pk]))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        room.refresh_from_db()
        self.assertFalse(room.is_active)

    def test_tree_endpoint(self):
        room = Room.objects.create(name='Kitchen')
        Zone.objects.create(name='Island')
        f = Furniture.objects.create(name='Kitchen Base Unit')
        f.rooms.set([room])
        res = self.client.get(reverse('catalog-tree'), {'room': room.pk})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['rooms']), 1)
        self.assertEqual(len(res.data['zones']), 1)
        self.assertEqual(len(res.data['furniture']), 1)

    def test_meta_counts(self):
        Room.objects.create(name='Kitchen')
        res = self.client.get(reverse('catalog-meta'))
        self.assertEqual(res.data['counts']['rooms'], 1)
        self.assertTrue(any(u['value'] == 'sft' for u in res.data['units']))


class SeedTests(CatalogTestCase):
    def test_seed_is_idempotent(self):
        call_command('seed_catalog', verbosity=0)
        first = Furniture.objects.count()
        self.assertGreater(first, 10)
        call_command('seed_catalog', verbosity=0)
        self.assertEqual(Furniture.objects.count(), first)

    def test_seeded_wardrobe_has_a_cost(self):
        call_command('seed_catalog', verbosity=0)
        wardrobe = Furniture.objects.get(name='Wardrobe')
        self.assertGreater(wardrobe.material_cost, 0)
        self.assertGreater(wardrobe.suggested_rate, wardrobe.material_cost)
