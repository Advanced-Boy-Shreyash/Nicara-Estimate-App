"""NICARA Vendors — API tests. Run: python manage.py test vendors"""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import PagePermission, User
from vendors.models import Vendor, VendorContact

PASSWORD = 'Str0ng!Passw0rd'


def grant(user, module, level='full'):
    """Give a non-admin test user access to a module in the IAM matrix."""
    PagePermission.objects.update_or_create(
        user=user, page_id=module, defaults={'level': level}
    )


class VendorAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='designer@nicara.design', password=PASSWORD,
            first_name='Test', last_name='User',
        )
        grant(self.user, 'vendors_material')
        grant(self.user, 'vendors_contract')
        self.client.force_authenticate(self.user)

        self.supplier = Vendor.objects.create(
            name='Raj Timber', vendor_type=Vendor.VendorType.MATERIAL_SUPPLIER,
            city='Mumbai', brands_supplied='Austin, Century', lead_time_days=3,
        )
        self.contractor = Vendor.objects.create(
            name='Shree Furniture Works', vendor_type=Vendor.VendorType.CONTRACTOR,
            city='Bangalore', trade=Vendor.Trade.CARPENTRY, team_size=18,
        )

    def test_requires_authentication(self):
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.get(reverse('vendor-list')).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_codes_are_generated_with_type_prefix(self):
        self.assertTrue(self.supplier.code.startswith('SUP-'))
        self.assertTrue(self.contractor.code.startswith('CON-'))

    def test_duplicate_names_get_distinct_codes(self):
        twin = Vendor.objects.create(
            name='Raj Timber', vendor_type=Vendor.VendorType.MATERIAL_SUPPLIER,
        )
        self.assertNotEqual(twin.code, self.supplier.code)

    def test_supplier_endpoint_returns_only_suppliers(self):
        res = self.client.get(reverse('supplier-list'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        names = [r['name'] for r in res.data['results']]
        self.assertIn('Raj Timber', names)
        self.assertNotIn('Shree Furniture Works', names)

    def test_contractor_endpoint_returns_only_contractors(self):
        res = self.client.get(reverse('contractor-list'))
        names = [r['name'] for r in res.data['results']]
        self.assertEqual(names, ['Shree Furniture Works'])

    def test_posting_to_supplier_endpoint_forces_type(self):
        res = self.client.post(reverse('supplier-list'), {
            'name': 'New Laminates Co', 'city': 'Pune',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            Vendor.objects.get(name='New Laminates Co').vendor_type,
            Vendor.VendorType.MATERIAL_SUPPLIER,
        )

    def test_contractor_requires_a_trade(self):
        res = self.client.post(reverse('contractor-list'), {
            'name': 'No Trade Co', 'trade': '',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_gst_number_length_is_validated(self):
        res = self.client.patch(
            reverse('vendor-detail', args=[self.supplier.pk]),
            {'gst_number': 'TOOSHORT'}, format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('gst_number', res.data['errors'])

    def test_rating_is_bounded(self):
        res = self.client.patch(
            reverse('vendor-detail', args=[self.supplier.pk]),
            {'rating': 9}, format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_deactivates_instead_of_removing(self):
        res = self.client.delete(reverse('vendor-detail', args=[self.supplier.pk]))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.supplier.refresh_from_db()
        self.assertFalse(self.supplier.is_active)

    def test_search_matches_brands(self):
        res = self.client.get(reverse('vendor-list'), {'search': 'Century'})
        self.assertEqual(len(res.data['results']), 1)

    def test_filter_by_trade(self):
        res = self.client.get(reverse('vendor-list'), {'trade': 'carpentry'})
        self.assertEqual(len(res.data['results']), 1)

    def test_contacts_are_nested_under_a_vendor(self):
        res = self.client.post(
            reverse('vendor-contact-list', args=[self.supplier.pk]),
            {'name': 'Accounts Desk', 'phone': '+91 99999 00000', 'is_primary': True},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(VendorContact.objects.filter(vendor=self.supplier).count(), 1)

    def test_brand_list_splits_on_commas(self):
        self.assertEqual(self.supplier.brand_list, ['Austin', 'Century'])

    def test_meta_lists_choices_and_counts(self):
        res = self.client.get(reverse('vendor-meta'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['counts'], {'suppliers': 1, 'contractors': 1})
        self.assertTrue(any(t['value'] == 'carpentry' for t in res.data['trades']))
