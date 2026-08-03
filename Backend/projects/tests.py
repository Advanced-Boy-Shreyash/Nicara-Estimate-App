"""
NICARA Projects — Initial Engagement tests.

Covers the five sub-tabs: Client Details, Design Requirements, FL & Mood Board,
Initial Estimate, Booking Form.

Run: python manage.py test projects
"""
from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from items.models import Item, ItemCategory
from projects.models import (
    BookingForm, DesignRequirement, Estimate, EstimateItem,
    Project, ProjectDeliverable,
)

PASSWORD = 'Str0ng!Passw0rd'


class EngagementTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='designer@nicara.design', password=PASSWORD,
            first_name='Nishanth', last_name='K',
        )
        self.client.force_authenticate(self.user)
        self.project = Project.objects.create(
            name='Sharma Residence', client_name='Ms. Anita Sharma',
            client_phone='+91 98765 43210', city='Mumbai', stage=Project.Stage.LEAD,
        )

    def make_estimate(self, **kwargs):
        defaults = {
            'project': self.project,
            'type': Estimate.EstimateType.INITIAL,
            'version': 1,
        }
        defaults.update(kwargs)
        return Estimate.objects.create(**defaults)


# ── 1. Client Details ───────────────────────────────────────

class ClientDetailsTests(EngagementTestCase):
    def test_requires_authentication(self):
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.get(reverse('project-list')).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_project_list_is_at_api_projects(self):
        res = self.client.get(reverse('project-list'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['results'][0]['name'], 'Sharma Residence')

    def test_patch_updates_client_details(self):
        res = self.client.patch(
            reverse('project-detail', args=[self.project.pk]),
            {'client_email': 'anita@example.com', 'budget': '1850000'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.project.refresh_from_db()
        self.assertEqual(self.project.client_email, 'anita@example.com')

    def test_target_date_cannot_precede_start_date(self):
        res = self.client.patch(
            reverse('project-detail', args=[self.project.pk]),
            {'start_date': '2026-06-10', 'target_date': '2026-05-01'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('target_date', res.data['errors'])

    def test_progress_is_bounded(self):
        res = self.client.patch(
            reverse('project-detail', args=[self.project.pk]),
            {'progress': 150}, format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_meta_returns_choice_lists(self):
        res = self.client.get(reverse('project-meta'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(any(s['value'] == 'design' for s in res.data['stages']))
        self.assertTrue(any(t['value'] == 'initial' for t in res.data['estimate_types']))


# ── 2. Design Requirements ──────────────────────────────────

class DesignRequirementTests(EngagementTestCase):
    def test_create_and_list(self):
        res = self.client.post(
            reverse('design-req-list', args=[self.project.pk]),
            {'room': 'Master Bedroom', 'unit': 'Wardrobe', 'length': "8'0\"",
             'finishing': 'Laminate', 'design_required': True},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            self.client.get(reverse('design-req-list', args=[self.project.pk])).data['count'],
            1,
        )

    def test_bulk_replaces_the_whole_grid(self):
        DesignRequirement.objects.create(project=self.project, room='Old', unit='Row')
        res = self.client.put(
            reverse('design-req-bulk', args=[self.project.pk]),
            {'rows': [
                {'room': 'Master Bedroom', 'unit': 'Wardrobe', 'finishing': 'Laminate'},
                {'room': 'Kitchen', 'unit': 'Base Cabinets', 'finishing': 'Acrylic'},
            ]},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rooms = list(self.project.design_requirements.values_list('room', flat=True))
        self.assertEqual(rooms, ['Master Bedroom', 'Kitchen'])

    def test_bulk_with_empty_rows_clears_the_grid(self):
        DesignRequirement.objects.create(project=self.project, room='Old', unit='Row')
        res = self.client.put(
            reverse('design-req-bulk', args=[self.project.pk]),
            {'rows': []}, format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self.project.design_requirements.count(), 0)

    def test_bulk_assigns_sort_order(self):
        self.client.put(
            reverse('design-req-bulk', args=[self.project.pk]),
            {'rows': [{'room': 'A', 'unit': 'X'}, {'room': 'B', 'unit': 'Y'}]},
            format='json',
        )
        orders = list(self.project.design_requirements.values_list('sort_order', flat=True))
        self.assertEqual(orders, [1, 2])


# ── 3. FL & Mood Board ──────────────────────────────────────

class DeliverableTests(EngagementTestCase):
    def test_filter_by_type(self):
        ProjectDeliverable.objects.create(
            project=self.project, type=ProjectDeliverable.DeliverableType.FURNITURE_LAYOUT,
            version='Ver 1',
        )
        ProjectDeliverable.objects.create(
            project=self.project, type=ProjectDeliverable.DeliverableType.MOOD_BOARD,
            version='Ver 1',
        )
        res = self.client.get(
            reverse('deliverable-list', args=[self.project.pk]),
            {'type': 'mood_board'},
        )
        self.assertEqual(res.data['count'], 1)

    def test_uploader_is_recorded(self):
        res = self.client.post(
            reverse('deliverable-list', args=[self.project.pk]),
            {'type': 'furniture_layout', 'version': 'Ver 1', 'remarks': 'First cut'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ProjectDeliverable.objects.get().uploaded_by, self.user)


# ── 4. Initial Estimate ─────────────────────────────────────

class EstimateTests(EngagementTestCase):
    def test_version_is_assigned_server_side(self):
        first = self.client.post(
            reverse('estimate-list', args=[self.project.pk]),
            {'type': 'initial'}, format='json',
        )
        second = self.client.post(
            reverse('estimate-list', args=[self.project.pk]),
            {'type': 'initial'}, format='json',
        )
        self.assertEqual(first.data['version'], 1)
        self.assertEqual(second.data['version'], 2)

    def test_line_amount_is_derived_from_qty_and_rate(self):
        estimate = self.make_estimate()
        res = self.client.post(
            reverse('estimate-item-list', args=[self.project.pk, estimate.pk]),
            {'area': 'Kitchen', 'item': 'Base Cabinets', 'qty': 2, 'rate': 1000,
             'amount': 999999},  # attempt to override
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(res.data['amount']), Decimal('2000.00'))

    def test_sno_auto_increments(self):
        estimate = self.make_estimate()
        for _ in range(3):
            self.client.post(
                reverse('estimate-item-list', args=[self.project.pk, estimate.pk]),
                {'area': 'Kitchen', 'item': 'Cabinet', 'qty': 1, 'rate': 100},
                format='json',
            )
        self.assertEqual(
            list(estimate.items.values_list('sno', flat=True)), [1, 2, 3]
        )

    def test_negative_rate_is_rejected(self):
        estimate = self.make_estimate()
        res = self.client.post(
            reverse('estimate-item-list', args=[self.project.pk, estimate.pk]),
            {'area': 'Kitchen', 'item': 'Cabinet', 'qty': 1, 'rate': -5},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_totals_include_gst(self):
        estimate = self.make_estimate()
        EstimateItem.objects.create(estimate=estimate, area='A', item='X',
                                    qty=1, rate=Decimal('1000'), gst_pct=18)
        EstimateItem.objects.create(estimate=estimate, area='B', item='Y',
                                    qty=2, rate=Decimal('500'), gst_pct=18)
        self.assertEqual(estimate.subtotal, Decimal('2000'))
        self.assertEqual(estimate.gst_total, Decimal('360'))
        self.assertEqual(estimate.grand_total, Decimal('2360'))

    def test_percentage_discount_reduces_gst_proportionally(self):
        estimate = self.make_estimate(discount_pct=Decimal('10'))
        EstimateItem.objects.create(estimate=estimate, area='A', item='X',
                                    qty=1, rate=Decimal('1000'), gst_pct=18)
        self.assertEqual(estimate.taxable_amount, Decimal('900'))
        self.assertEqual(estimate.gst_total, Decimal('162'))
        self.assertEqual(estimate.grand_total, Decimal('1062'))

    def test_totals_are_zero_for_an_empty_estimate(self):
        estimate = self.make_estimate()
        self.assertEqual(estimate.subtotal, Decimal('0'))
        self.assertEqual(estimate.gst_total, Decimal('0'))
        self.assertEqual(estimate.grand_total, Decimal('0'))

    # ── Workflow ─────────────────────────────────────────────
    def test_cannot_send_an_empty_estimate(self):
        estimate = self.make_estimate()
        res = self.client.post(reverse('estimate-send', args=[self.project.pk, estimate.pk]))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_then_approve_records_the_trail(self):
        estimate = self.make_estimate()
        EstimateItem.objects.create(estimate=estimate, area='A', item='X', qty=1, rate=100)

        sent = self.client.post(reverse('estimate-send', args=[self.project.pk, estimate.pk]))
        self.assertEqual(sent.data['status'], 'sent')
        self.assertIsNotNone(sent.data['sent_at'])
        self.assertEqual(sent.data['sent_by_name'], 'Nishanth K')

        approved = self.client.post(
            reverse('estimate-approve', args=[self.project.pk, estimate.pk]),
            {'client_remarks': 'Looks good'}, format='json',
        )
        self.assertEqual(approved.data['status'], 'approved')
        self.assertEqual(approved.data['client_remarks'], 'Looks good')

    def test_cannot_resend_an_approved_estimate(self):
        estimate = self.make_estimate(status=Estimate.Status.APPROVED)
        EstimateItem.objects.create(estimate=estimate, area='A', item='X', qty=1, rate=100)
        res = self.client.post(reverse('estimate-send', args=[self.project.pk, estimate.pk]))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_request_revision_records_remarks(self):
        estimate = self.make_estimate()
        res = self.client.post(
            reverse('estimate-revision', args=[self.project.pk, estimate.pk]),
            {'client_remarks': 'Reduce kitchen scope'}, format='json',
        )
        self.assertEqual(res.data['status'], 'revision')
        self.assertEqual(res.data['client_remarks'], 'Reduce kitchen scope')

    def test_duplicate_copies_items_into_a_new_draft(self):
        estimate = self.make_estimate(status=Estimate.Status.APPROVED)
        EstimateItem.objects.create(estimate=estimate, area='A', item='X', qty=1, rate=100)
        EstimateItem.objects.create(estimate=estimate, area='B', item='Y', qty=2, rate=50)

        res = self.client.post(
            reverse('estimate-duplicate', args=[self.project.pk, estimate.pk])
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['version'], 2)
        self.assertEqual(res.data['status'], 'draft')
        self.assertEqual(len(res.data['items']), 2)

    def test_duplicate_can_promote_to_another_type(self):
        estimate = self.make_estimate()
        EstimateItem.objects.create(estimate=estimate, area='A', item='X', qty=1, rate=100)
        res = self.client.post(
            reverse('estimate-duplicate', args=[self.project.pk, estimate.pk]),
            {'type': 'final'}, format='json',
        )
        self.assertEqual(res.data['type'], 'final')
        self.assertEqual(res.data['version'], 1)

    def test_duplicate_rejects_an_unknown_type(self):
        estimate = self.make_estimate()
        res = self.client.post(
            reverse('estimate-duplicate', args=[self.project.pk, estimate.pk]),
            {'type': 'nonsense'}, format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


# ── Catalogue → Estimate ────────────────────────────────────

class AddFromCatalogTests(EngagementTestCase):
    def setUp(self):
        super().setUp()
        category = ItemCategory.objects.create(name='Carpentry')
        self.wardrobe = Item.objects.create(
            name='Wardrobe', category=category, default_room='Master Bedroom',
            description='16mm BWP ply', default_rate=Decimal('145000'),
            default_qty=1, unit=Item.Unit.UNIT, gst_pct=18,
            default_length="8'0\"",
        )
        self.ceiling = Item.objects.create(
            name='False Ceiling', category=category, default_room='Drawing Room',
            default_rate=Decimal('165'), default_qty=Decimal('168'),
            unit=Item.Unit.SFT, gst_pct=18,
        )
        self.estimate = self.make_estimate()
        self.url = reverse('estimate-item-from-catalog',
                           args=[self.project.pk, self.estimate.pk])

    def test_adds_items_with_catalogue_defaults(self):
        res = self.client.post(self.url, {'items': [
            {'item_id': self.wardrobe.pk}, {'item_id': self.ceiling.pk},
        ]}, format='json')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(res.data['items']), 2)

        line = EstimateItem.objects.get(catalog_item=self.wardrobe)
        self.assertEqual(line.area, 'Master Bedroom')
        self.assertEqual(line.description, '16mm BWP ply')
        self.assertEqual(line.rate, Decimal('145000.00'))
        self.assertEqual(line.length, "8'0\"")
        self.assertEqual(line.amount, Decimal('145000.00'))

    def test_overrides_win_over_defaults(self):
        self.client.post(self.url, {'items': [
            {'item_id': self.wardrobe.pk, 'area': 'Guest Bedroom', 'qty': 2, 'rate': 100000},
        ]}, format='json')

        line = EstimateItem.objects.get(catalog_item=self.wardrobe)
        self.assertEqual(line.area, 'Guest Bedroom')
        self.assertEqual(line.amount, Decimal('200000.00'))

    def test_response_carries_recalculated_estimate_totals(self):
        res = self.client.post(self.url, {'items': [{'item_id': self.ceiling.pk}]},
                               format='json')
        # 168 sft × ₹165 = ₹27,720 + 18% GST
        self.assertEqual(Decimal(res.data['estimate']['subtotal']), Decimal('27720.00'))
        self.assertEqual(Decimal(res.data['estimate']['grand_total']), Decimal('32709.60'))

    def test_unknown_item_id_is_rejected_without_partial_writes(self):
        res = self.client.post(self.url, {'items': [
            {'item_id': self.wardrobe.pk}, {'item_id': 99999},
        ]}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.estimate.items.count(), 0)

    def test_entries_must_carry_an_item_id(self):
        res = self.client.post(self.url, {'items': [{'qty': 1}]}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


# ── 5. Booking Form ─────────────────────────────────────────

class BookingFormTests(EngagementTestCase):
    def setUp(self):
        super().setUp()
        self.url = reverse('booking-form', args=[self.project.pk])

    def test_404_before_a_booking_exists(self):
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_404_NOT_FOUND)

    def test_create_generates_a_booking_number(self):
        res = self.client.post(self.url, {'total_value': 1850000, 'advance_amount': 50000},
                               format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data['booking_number'].startswith('BKG-'))
        self.assertEqual(res.data['client_name'], 'Ms. Anita Sharma')

    def test_booking_numbers_are_unique(self):
        self.client.post(self.url, {'total_value': 100}, format='json')
        other = Project.objects.create(name='Kapoor Villa', client_name='Mr. Kapoor')
        res = self.client.post(reverse('booking-form', args=[other.pk]),
                               {'total_value': 200}, format='json')
        self.assertNotEqual(
            res.data['booking_number'],
            BookingForm.objects.get(project=self.project).booking_number,
        )

    def test_total_value_defaults_to_the_approved_initial_estimate(self):
        estimate = self.make_estimate(status=Estimate.Status.APPROVED)
        EstimateItem.objects.create(estimate=estimate, area='A', item='X',
                                    qty=1, rate=Decimal('1000'), gst_pct=18)

        res = self.client.post(self.url, {'advance_amount': 100}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(Decimal(res.data['total_value']), Decimal('1180.00'))
        self.assertEqual(res.data['estimate'], estimate.pk)

    def test_only_one_booking_form_per_project(self):
        self.client.post(self.url, {'total_value': 100}, format='json')
        res = self.client.post(self.url, {'total_value': 200}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_advance_cannot_exceed_total(self):
        res = self.client.post(self.url, {'total_value': 1000, 'advance_amount': 5000},
                               format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('advance_amount', res.data['errors'])

    def test_patch_records_the_advance(self):
        self.client.post(self.url, {'total_value': 1850000, 'advance_amount': 50000},
                         format='json')
        res = self.client.patch(self.url, {
            'advance_received': True, 'advance_received_on': '2026-06-15',
            'payment_mode': 'NEFT', 'payment_reference': 'NEFT-2026-0615-001',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(res.data['balance_due']), Decimal('1800000.00'))

    def test_marking_signed_stamps_signed_at(self):
        self.client.post(self.url, {'total_value': 100}, format='json')
        res = self.client.patch(self.url, {
            'status': 'signed', 'signed_by_name': 'Anita Sharma', 'terms_accepted': True,
        }, format='json')
        self.assertEqual(res.data['status'], 'signed')
        self.assertIsNotNone(res.data['signed_at'])

    def test_patch_before_create_returns_404(self):
        res = self.client.patch(self.url, {'total_value': 100}, format='json')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_booking_form_is_embedded_in_project_detail(self):
        self.client.post(self.url, {'total_value': 1850000}, format='json')
        res = self.client.get(reverse('project-detail', args=[self.project.pk]))
        self.assertIsNotNone(res.data['booking_form'])
        self.assertTrue(res.data['booking_form']['booking_number'].startswith('BKG-'))
