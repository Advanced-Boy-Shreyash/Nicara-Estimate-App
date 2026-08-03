"""
NICARA Accounts — Authentication test suite.

Run: python manage.py test accounts
"""
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase

from .models import LoginAttempt, User

PASSWORD = 'Str0ng!Passw0rd'
NEW_PASSWORD = 'Ev3n!Str0nger'


def make_user(email='designer@nicara.design', password=PASSWORD, **extra):
    extra.setdefault('first_name', 'Test')
    extra.setdefault('last_name', 'User')
    return User.objects.create_user(email=email, password=password, **extra)


class AuthTestCase(APITestCase):
    """
    Base case that resets the throttle cache between tests.

    DRF binds `throttle_classes` and `THROTTLE_RATES` at import time, so
    `override_settings(REST_FRAMEWORK=...)` cannot switch throttling off —
    clearing the rate-limit cache is the reliable way to isolate tests.
    """

    def setUp(self):
        cache.clear()
        super().setUp()


class LoginTests(AuthTestCase):
    def setUp(self):
        super().setUp()
        self.user = make_user()
        self.url = reverse('login')

    def test_error_response_has_uniform_shape(self):
        res = self.client.post(self.url, {'email': 'not-an-email'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIsInstance(res.data['detail'], str)
        self.assertIn('password', res.data['errors'])

    def test_login_returns_tokens_and_user(self):
        res = self.client.post(self.url, {'email': self.user.email, 'password': PASSWORD}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data['token'])
        self.assertIn('refresh', res.data['token'])
        self.assertEqual(res.data['user']['email'], self.user.email)
        self.assertNotIn('password', res.data['user'])

    def test_login_is_case_insensitive_on_email(self):
        res = self.client.post(self.url, {'email': 'DESIGNER@NICARA.DESIGN', 'password': PASSWORD}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_wrong_password_rejected(self):
        res = self.client.post(self.url, {'email': self.user.email, 'password': 'wrong'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unknown_email_gives_same_message_as_wrong_password(self):
        unknown = self.client.post(self.url, {'email': 'nobody@nicara.design', 'password': 'wrong'}, format='json')
        wrong = self.client.post(self.url, {'email': self.user.email, 'password': 'wrong'}, format='json')
        self.assertEqual(unknown.data['detail'], wrong.data['detail'])

    def test_inactive_account_cannot_log_in(self):
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])
        res = self.client.post(self.url, {'email': self.user.email, 'password': PASSWORD}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('disabled', str(res.data['detail']).lower())

    def test_attempts_are_audited(self):
        self.client.post(self.url, {'email': self.user.email, 'password': 'wrong'}, format='json')
        self.client.post(self.url, {'email': self.user.email, 'password': PASSWORD}, format='json')
        self.assertEqual(LoginAttempt.objects.filter(successful=False).count(), 1)
        self.assertEqual(LoginAttempt.objects.filter(successful=True).count(), 1)

    @override_settings(LOGIN_MAX_FAILED_ATTEMPTS=3)
    def test_account_locks_after_repeated_failures(self):
        for _ in range(3):
            self.client.post(self.url, {'email': self.user.email, 'password': 'wrong'}, format='json')
        # Correct password is now refused because the account is locked.
        res = self.client.post(self.url, {'email': self.user.email, 'password': PASSWORD}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('locked', str(res.data['detail']).lower())


class TokenLifecycleTests(AuthTestCase):
    def setUp(self):
        super().setUp()
        self.user = make_user()
        res = self.client.post(reverse('login'), {'email': self.user.email, 'password': PASSWORD}, format='json')
        self.access = res.data['token']['access']
        self.refresh = res.data['token']['refresh']

    def auth(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access}')

    def test_me_requires_authentication(self):
        self.assertEqual(self.client.get(reverse('me')).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_profile(self):
        self.auth()
        res = self.client.get(reverse('me'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['email'], self.user.email)

    def test_me_can_patch_profile_but_not_role(self):
        self.auth()
        res = self.client.patch(reverse('me'), {'first_name': 'Renamed', 'role': 'admin'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Renamed')
        self.assertEqual(self.user.role, User.Role.DESIGNER)

    def test_refresh_rotates_and_blacklists_old_token(self):
        res = self.client.post(reverse('token_refresh'), {'refresh': self.refresh}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        # Old refresh token must not work a second time.
        replay = self.client.post(reverse('token_refresh'), {'refresh': self.refresh}, format='json')
        self.assertEqual(replay.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_blacklists_refresh_token(self):
        self.auth()
        res = self.client.post(reverse('logout'), {'refresh': self.refresh}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        after = self.client.post(reverse('token_refresh'), {'refresh': self.refresh}, format='json')
        self.assertEqual(after.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_requires_refresh_token(self):
        self.auth()
        res = self.client.post(reverse('logout'), {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class PasswordTests(AuthTestCase):
    def setUp(self):
        super().setUp()
        self.user = make_user()
        res = self.client.post(reverse('login'), {'email': self.user.email, 'password': PASSWORD}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['token']['access']}")

    def test_change_password(self):
        res = self.client.post(reverse('change-password'), {
            'current_password': PASSWORD, 'new_password': NEW_PASSWORD,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW_PASSWORD))

    def test_change_password_rejects_wrong_current(self):
        res = self.client.post(reverse('change-password'), {
            'current_password': 'nope', 'new_password': NEW_PASSWORD,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_change_password_enforces_strength(self):
        res = self.client.post(reverse('change-password'), {
            'current_password': PASSWORD, 'new_password': 'password',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('new_password', res.data['errors'])

    def test_reset_request_is_silent_about_unknown_emails(self):
        self.client.credentials()
        known = self.client.post(reverse('password-reset'), {'email': self.user.email}, format='json')
        unknown = self.client.post(reverse('password-reset'), {'email': 'ghost@nicara.design'}, format='json')
        self.assertEqual(known.status_code, status.HTTP_200_OK)
        self.assertEqual(known.data['detail'], unknown.data['detail'])
        self.assertEqual(len(mail.outbox), 1)  # only the real address got mail

    def reset_payload(self):
        # Login in setUp bumped last_login, which is part of the token hash.
        self.user.refresh_from_db()
        return {
            'uid': urlsafe_base64_encode(force_bytes(self.user.pk)),
            'token': default_token_generator.make_token(self.user),
            'new_password': NEW_PASSWORD,
        }

    def test_reset_confirm_sets_new_password(self):
        self.client.credentials()
        res = self.client.post(reverse('password-reset-confirm'), self.reset_payload(), format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW_PASSWORD))

    def test_reset_confirm_rejects_reused_token(self):
        self.client.credentials()
        payload = self.reset_payload()
        first = self.client.post(reverse('password-reset-confirm'), payload, format='json')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        # The password hash changed, which invalidates the token.
        replay = self.client.post(reverse('password-reset-confirm'), payload, format='json')
        self.assertEqual(replay.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reset_confirm_rejects_tampered_token(self):
        self.client.credentials()
        payload = self.reset_payload()
        payload['token'] = payload['token'][:-2] + 'zz'
        res = self.client.post(reverse('password-reset-confirm'), payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class InviteTests(AuthTestCase):
    def setUp(self):
        super().setUp()
        self.admin = make_user(email='admin@nicara.design', role=User.Role.ADMIN)
        self.designer = make_user()

    def login_as(self, user):
        res = self.client.post(reverse('login'), {'email': user.email, 'password': PASSWORD}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['token']['access']}")

    def test_only_admins_can_invite(self):
        self.login_as(self.designer)
        res = self.client.post(reverse('invite'), {
            'email': 'new@nicara.design', 'first_name': 'New', 'last_name': 'Hire', 'role': 'designer',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_invite_then_accept(self):
        self.login_as(self.admin)
        res = self.client.post(reverse('invite'), {
            'email': 'new@nicara.design', 'first_name': 'New', 'last_name': 'Hire', 'role': 'designer',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        invited = User.objects.get(email='new@nicara.design')
        self.assertFalse(invited.is_active)
        self.assertTrue(invited.invite_token)

        self.client.credentials()
        accept = self.client.post(reverse('accept-invite'), {
            'token': invited.invite_token, 'password': NEW_PASSWORD,
        }, format='json')
        self.assertEqual(accept.status_code, status.HTTP_200_OK)
        self.assertIn('access', accept.data['token'])

        invited.refresh_from_db()
        self.assertTrue(invited.is_active)
        self.assertTrue(invited.invite_accepted)
        self.assertEqual(invited.invite_token, '')

    def test_accept_invite_rejects_weak_password(self):
        self.login_as(self.admin)
        self.client.post(reverse('invite'), {
            'email': 'new@nicara.design', 'first_name': 'New', 'last_name': 'Hire', 'role': 'designer',
        }, format='json')
        invited = User.objects.get(email='new@nicara.design')

        self.client.credentials()
        res = self.client.post(reverse('accept-invite'), {
            'token': invited.invite_token, 'password': '12345678',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_invite_rejected(self):
        self.login_as(self.admin)
        res = self.client.post(reverse('invite'), {
            'email': self.designer.email, 'first_name': 'Dup', 'last_name': 'User', 'role': 'designer',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_list_is_admin_only(self):
        self.login_as(self.designer)
        self.assertEqual(self.client.get(reverse('user-list')).status_code, status.HTTP_403_FORBIDDEN)
        self.login_as(self.admin)
        self.assertEqual(self.client.get(reverse('user-list')).status_code, status.HTTP_200_OK)


class ThrottleTests(AuthTestCase):
    def test_login_endpoint_is_throttled(self):
        """Brute force against the login endpoint is rate limited (10/min)."""
        url = reverse('login')
        payload = {'email': 'a@nicara.design', 'password': 'x'}
        codes = [self.client.post(url, payload, format='json').status_code for _ in range(11)]
        self.assertNotIn(status.HTTP_429_TOO_MANY_REQUESTS, codes[:10])
        self.assertEqual(codes[10], status.HTTP_429_TOO_MANY_REQUESTS)


class UserModelTests(AuthTestCase):
    def test_email_is_normalised_to_lowercase(self):
        user = make_user(email='MiXeD@Nicara.Design')
        self.assertEqual(user.email, 'mixed@nicara.design')

    def test_create_user_requires_email(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(email='', password=PASSWORD)

    def test_superuser_flags(self):
        admin = User.objects.create_superuser(email='root@nicara.design', password=PASSWORD)
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)
        self.assertEqual(admin.role, User.Role.ADMIN)
        self.assertTrue(admin.is_admin)
