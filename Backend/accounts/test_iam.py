"""
NICARA — IAM tests.

Covers the two halves of the requirement: an admin (or an IAM holder) can
configure module permissions, and those permissions are actually enforced on
the API rather than only shown in a matrix.

Run: python manage.py test accounts.test_iam
"""
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import PagePermission, User
from accounts.modules import MODULE_IDS, satisfies

PASSWORD = 'Str0ng!Passw0rd'


def grant(user, module, level='full'):
    PagePermission.objects.update_or_create(
        user=user, page_id=module, defaults={'level': level}
    )


class IAMTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(
            email='admin@nicara.design', password=PASSWORD,
            first_name='NICARA', last_name='Admin', role=User.Role.ADMIN,
        )
        self.designer = User.objects.create_user(
            email='designer@nicara.design', password=PASSWORD,
            first_name='Nishanth', last_name='K',
        )


class LevelOrderingTests(IAMTestCase):
    def test_levels_are_ordered(self):
        self.assertTrue(satisfies('full', 'view'))
        self.assertTrue(satisfies('edit', 'edit'))
        self.assertFalse(satisfies('view', 'edit'))
        self.assertFalse(satisfies('none', 'view'))
        self.assertFalse(satisfies('', 'view'))


class EnforcementTests(IAMTestCase):
    """The matrix has to gate real endpoints, not just render in a table."""

    def test_no_permission_is_forbidden(self):
        self.client.force_authenticate(self.designer)
        self.assertEqual(
            self.client.get(reverse('item-list')).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_view_level_allows_read_but_not_write(self):
        grant(self.designer, 'items', 'view')
        self.client.force_authenticate(self.designer)

        self.assertEqual(self.client.get(reverse('item-list')).status_code,
                         status.HTTP_200_OK)

        from items.models import ItemCategory
        category = ItemCategory.objects.create(name='Carpentry')
        res = self.client.post(reverse('item-list'),
                               {'name': 'X', 'category': category.pk}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_edit_level_allows_write(self):
        grant(self.designer, 'items', 'edit')
        self.client.force_authenticate(self.designer)

        from items.models import ItemCategory
        category = ItemCategory.objects.create(name='Carpentry')
        res = self.client.post(reverse('item-list'),
                               {'name': 'Wardrobe', 'category': category.pk}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_admin_needs_no_explicit_grants(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(reverse('item-list')).status_code,
                         status.HTTP_200_OK)
        self.assertEqual(PagePermission.objects.filter(user=self.admin).count(), 0)

    def test_modules_are_independent(self):
        """Access to items must not leak into vendors."""
        grant(self.designer, 'items', 'full')
        self.client.force_authenticate(self.designer)
        self.assertEqual(self.client.get(reverse('item-list')).status_code,
                         status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('supplier-list')).status_code,
                         status.HTTP_403_FORBIDDEN)

    def test_supplier_and_contractor_are_separate_modules(self):
        grant(self.designer, 'vendors_material', 'view')
        self.client.force_authenticate(self.designer)
        self.assertEqual(self.client.get(reverse('supplier-list')).status_code,
                         status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('contractor-list')).status_code,
                         status.HTTP_403_FORBIDDEN)

    def test_error_message_names_the_module_and_level(self):
        self.client.force_authenticate(self.designer)
        res = self.client.get(reverse('item-list'))
        self.assertIn('items', res.data['detail'])


class ConfigurationTests(IAMTestCase):
    """Who may configure the matrix."""

    def test_admin_can_read_the_matrix(self):
        self.client.force_authenticate(self.admin)
        res = self.client.get(reverse('permissions'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_plain_user_cannot_read_the_matrix(self):
        self.client.force_authenticate(self.designer)
        self.assertEqual(self.client.get(reverse('permissions')).status_code,
                         status.HTTP_403_FORBIDDEN)

    def test_iam_holder_can_configure(self):
        """'whosoever has this permission' — full access to the iam module."""
        grant(self.designer, 'iam', 'full')
        self.client.force_authenticate(self.designer)
        self.assertEqual(self.client.get(reverse('permissions')).status_code,
                         status.HTTP_200_OK)

    def test_partial_iam_access_is_not_enough(self):
        grant(self.designer, 'iam', 'view')
        self.client.force_authenticate(self.designer)
        self.assertEqual(self.client.get(reverse('permissions')).status_code,
                         status.HTTP_403_FORBIDDEN)

    def test_admin_can_grant_permissions(self):
        self.client.force_authenticate(self.admin)
        res = self.client.put(reverse('permissions'), {'permissions': [
            {'user_id': str(self.designer.pk), 'page_id': 'items', 'level': 'edit'},
            {'user_id': str(self.designer.pk), 'page_id': 'leads', 'level': 'view'},
        ]}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        levels = dict(
            PagePermission.objects.filter(user=self.designer)
            .values_list('page_id', 'level')
        )
        self.assertEqual(levels, {'items': 'edit', 'leads': 'view'})

    def test_setting_none_removes_the_row(self):
        grant(self.designer, 'items', 'edit')
        self.client.force_authenticate(self.admin)
        self.client.put(reverse('permissions'), {'permissions': [
            {'user_id': str(self.designer.pk), 'page_id': 'items', 'level': 'none'},
        ]}, format='json')
        self.assertFalse(
            PagePermission.objects.filter(user=self.designer, page_id='items').exists()
        )

    def test_unknown_module_is_rejected(self):
        self.client.force_authenticate(self.admin)
        res = self.client.put(reverse('permissions'), {'permissions': [
            {'user_id': str(self.designer.pk), 'page_id': 'not_a_module', 'level': 'edit'},
        ]}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unknown_user_is_rejected(self):
        self.client.force_authenticate(self.admin)
        res = self.client.put(reverse('permissions'), {'permissions': [
            {'user_id': '99999', 'page_id': 'items', 'level': 'edit'},
        ]}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class RoleTemplateTests(IAMTestCase):
    def test_apply_template_replaces_the_matrix(self):
        grant(self.designer, 'iam', 'full')  # should be wiped by the template
        self.client.force_authenticate(self.admin)

        res = self.client.post(reverse('iam-apply-template'), {
            'user_id': self.designer.pk, 'role': 'designer',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)

        levels = res.data['permissions']
        self.assertEqual(levels.get('furniture'), 'full')
        self.assertNotIn('iam', levels)

    def test_unknown_role_is_rejected(self):
        self.client.force_authenticate(self.admin)
        res = self.client.post(reverse('iam-apply-template'), {
            'user_id': self.designer.pk, 'role': 'wizard',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invited_user_gets_the_role_template(self):
        self.client.force_authenticate(self.admin)
        res = self.client.post(reverse('invite'), {
            'email': 'new@nicara.design', 'first_name': 'New',
            'last_name': 'Designer', 'role': 'designer',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        invited = User.objects.get(email='new@nicara.design')
        self.assertTrue(invited.page_permissions.exists())


class MyPermissionsTests(IAMTestCase):
    def test_returns_the_users_own_map(self):
        grant(self.designer, 'items', 'view')
        self.client.force_authenticate(self.designer)
        res = self.client.get(reverse('iam-my-permissions'))
        self.assertEqual(res.data['permissions'], {'items': 'view'})
        self.assertFalse(res.data['is_admin'])
        self.assertFalse(res.data['can_manage_iam'])

    def test_admin_sees_every_module(self):
        self.client.force_authenticate(self.admin)
        res = self.client.get(reverse('iam-my-permissions'))
        self.assertTrue(res.data['is_admin'])
        self.assertTrue(res.data['can_manage_iam'])
        self.assertEqual(set(res.data['permissions']), MODULE_IDS)

    def test_module_registry_is_exposed(self):
        self.client.force_authenticate(self.designer)
        res = self.client.get(reverse('iam-modules'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = {m['id'] for group in res.data['groups'] for m in group['modules']}
        self.assertEqual(ids, MODULE_IDS)
        self.assertIn('designer', res.data['role_templates'])
