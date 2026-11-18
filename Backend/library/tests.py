"""
Brand master list — one brand shared by every raw-material category.

Run: python manage.py test library
"""
from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import PagePermission, User
from library.models import MaterialBrand, MaterialCategory, MaterialItem

PASSWORD = 'Str0ng!Passw0rd'


class BrandApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='designer@nicara.design', password=PASSWORD,
                                             first_name='Test', last_name='User')
        PagePermission.objects.create(user=self.user, page_id='library', level='full')
        self.client.force_authenticate(self.user)
        self.ply16 = MaterialCategory.objects.create(name='Core Material(16mm BWP Ply)', product_group='plywood')
        self.ply12 = MaterialCategory.objects.create(name='Core Material(12mm BWP Ply)', product_group='plywood')
        self.austin = MaterialBrand.objects.create(name='Austin')
        MaterialItem.objects.create(category=self.ply16, brand=self.austin, model_name='Lincoln BWP',
                                    default_rate=Decimal('110'))
        MaterialItem.objects.create(category=self.ply12, brand=self.austin, model_name='Lincoln BWP',
                                    default_rate=Decimal('95'))

    def test_one_brand_serves_every_category(self):
        res = self.client.get('/api/library/brands/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        austin = next(b for b in res.data['results'] if b['name'] == 'Austin')
        self.assertEqual(austin['item_count'], 2)
        self.assertEqual(austin['categories'], ['Core Material(12mm BWP Ply)', 'Core Material(16mm BWP Ply)'])

    def test_filter_brands_by_category(self):
        MaterialBrand.objects.create(name='Century')
        res = self.client.get('/api/library/brands/', {'category': self.ply16.pk})
        self.assertEqual([b['name'] for b in res.data['results']], ['Austin'])

    def test_brand_names_are_unique_ignoring_case(self):
        res = self.client.post('/api/library/brands/', {'name': ' austin '}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        res = self.client.post('/api/library/brands/', {'name': 'Century'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_a_brand_in_use_cannot_be_deleted(self):
        res = self.client.delete(f'/api/library/brands/{self.austin.pk}/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(MaterialBrand.objects.filter(pk=self.austin.pk).exists())

    def test_any_brand_can_go_with_any_category(self):
        res = self.client.post('/api/library/items/', {
            'category': self.ply12.pk, 'brand': MaterialBrand.objects.create(name='Century').pk,
            'model_name': 'Club Prime', 'default_rate': '100', 'default_unit': 'sft'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_meta_lists_where_each_brand_is_used(self):
        res = self.client.get('/api/library/meta/')
        austin = next(b for b in res.data['brands'] if b['name'] == 'Austin')
        self.assertEqual(sorted(austin['category_ids']), sorted([self.ply16.pk, self.ply12.pk]))
