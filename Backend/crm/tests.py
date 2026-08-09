"""NICARA CRM — Lead and Client tests. Run: python manage.py test crm"""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import PagePermission, User
from crm.models import Client, CrmNote, Lead
from projects.models import Project

PASSWORD = 'Str0ng!Passw0rd'


def grant(user, module, level='full'):
    PagePermission.objects.update_or_create(
        user=user, page_id=module, defaults={'level': level}
    )


class CrmTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='designer@nicara.design', password=PASSWORD,
            first_name='Nishanth', last_name='K',
        )
        grant(self.user, 'leads')
        grant(self.user, 'clients')
        self.client.force_authenticate(self.user)


class LeadTests(CrmTestCase):
    def make_lead(self, **kwargs):
        defaults = {'name': 'Anita Sharma', 'phone': '+91 98765 43210',
                    'project_name': 'Sharma Residence', 'city': 'Mumbai'}
        defaults.update(kwargs)
        return Lead.objects.create(**defaults)

    def test_requires_permission(self):
        stranger = User.objects.create_user(
            email='nobody@nicara.design', password=PASSWORD,
            first_name='No', last_name='Access',
        )
        self.client.force_authenticate(stranger)
        res = self.client.get(reverse('lead-list'))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_code_is_generated(self):
        lead = self.make_lead()
        self.assertTrue(lead.code.startswith('LD-'))

    def test_codes_are_unique(self):
        first, second = self.make_lead(), self.make_lead(name='Other')
        self.assertNotEqual(first.code, second.code)

    def test_create_and_list(self):
        res = self.client.post(reverse('lead-list'), {
            'name': 'Rajesh Kapoor', 'phone': '+91 99001 22334',
            'project_name': 'Kapoor Villa', 'city': 'Bangalore',
            'source': 'referral', 'estimated_budget': '4600000',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(self.client.get(reverse('lead-list')).data['count'], 1)

    def test_stage_change_is_logged(self):
        lead = self.make_lead()
        res = self.client.patch(reverse('lead-detail', args=[lead.pk]),
                                {'stage': 'mood_board'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        note = CrmNote.objects.filter(lead=lead, kind='stage_change').first()
        self.assertIsNotNone(note)
        self.assertIn('mood_board', note.body)

    def test_closing_lost_requires_a_reason(self):
        lead = self.make_lead()
        res = self.client.patch(reverse('lead-detail', args=[lead.pk]),
                                {'stage': 'lost'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('lost_reason', res.data['errors'])

    def test_pipeline_counts(self):
        self.make_lead()
        self.make_lead(name='B', stage=Lead.Stage.WON)
        res = self.client.get(reverse('lead-pipeline'))
        self.assertEqual(res.data['open'], 1)
        self.assertEqual(res.data['won'], 1)

    def test_notes_can_be_added(self):
        lead = self.make_lead()
        res = self.client.post(reverse('lead-notes', args=[lead.pk]),
                               {'kind': 'call', 'body': 'Discussed budget'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['created_by_name'], 'Nishanth K')

    # ── Conversion ───────────────────────────────────────────
    def test_convert_creates_client_and_project(self):
        lead = self.make_lead(estimated_budget='1850000', area='1,850 sqft')
        res = self.client.post(reverse('lead-convert', args=[lead.pk]), {}, format='json')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        project = Project.objects.get(pk=res.data['project_id'])
        self.assertEqual(project.name, 'Sharma Residence')
        self.assertEqual(project.client_name, 'Anita Sharma')
        self.assertEqual(project.stage, Project.Stage.LEAD)

        client = Client.objects.get(pk=res.data['client_id'])
        self.assertEqual(project.client, client)

        lead.refresh_from_db()
        self.assertEqual(lead.stage, Lead.Stage.WON)
        self.assertIsNotNone(lead.converted_at)

    def test_convert_is_not_repeatable(self):
        lead = self.make_lead()
        self.client.post(reverse('lead-convert', args=[lead.pk]), {}, format='json')
        again = self.client.post(reverse('lead-convert', args=[lead.pk]), {}, format='json')
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Project.objects.count(), 1)

    def test_convert_can_reuse_an_existing_client(self):
        existing = Client.objects.create(name='Sharma Group')
        lead = self.make_lead()
        res = self.client.post(reverse('lead-convert', args=[lead.pk]),
                               {'existing_client_id': existing.pk}, format='json')
        self.assertEqual(res.data['client_id'], existing.pk)
        self.assertEqual(Client.objects.count(), 1)

    def test_convert_accepts_a_project_name_override(self):
        lead = self.make_lead()
        res = self.client.post(reverse('lead-convert', args=[lead.pk]),
                               {'project_name': 'Sharma Penthouse'}, format='json')
        self.assertEqual(Project.objects.get(pk=res.data['project_id']).name,
                         'Sharma Penthouse')


class ClientTests(CrmTestCase):
    def test_create_and_code(self):
        res = self.client.post(reverse('client-list'), {
            'name': 'Anita Sharma', 'phone': '+91 98765 43210', 'city': 'Mumbai',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertTrue(res.data['code'].startswith('CL-'))

    def test_gst_is_validated(self):
        client = Client.objects.create(name='Acme Interiors')
        res = self.client.patch(reverse('client-detail', args=[client.pk]),
                                {'gst_number': 'TOOSHORT'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('gst_number', res.data['errors'])

    def test_delete_deactivates(self):
        client = Client.objects.create(name='Acme Interiors')
        res = self.client.delete(reverse('client-detail', args=[client.pk]))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        client.refresh_from_db()
        self.assertFalse(client.is_active)

    def test_detail_lists_linked_projects(self):
        client = Client.objects.create(name='Anita Sharma')
        Project.objects.create(client=client, client_name='Anita Sharma',
                               name='Sharma Residence')
        res = self.client.get(reverse('client-detail', args=[client.pk]))
        self.assertEqual(res.data['project_count'], 1)
        self.assertEqual(res.data['projects'][0]['name'], 'Sharma Residence')

    def test_search(self):
        Client.objects.create(name='Anita Sharma', city='Mumbai')
        Client.objects.create(name='Rajesh Kapoor', city='Bangalore')
        res = self.client.get(reverse('client-list'), {'search': 'Kapoor'})
        self.assertEqual(res.data['count'], 1)
