"""
Recreating the workbook estimate ("Create this Initial Estimate.xlsx") from the
catalogue: picking each line's furniture and generating must give the
workbook's rows and total.

Run: python manage.py test projects.test_workbook_generation
"""
import json
from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase

from catalog.models import Furniture
from catalog.pricing import size_inches
from projects import generation
from projects.management.commands.seed_initial_estimate_demo import FIXTURE_PATH, furniture_names
from projects.models import Estimate, EstimateItem, Project, money

# Not in the workbook: a sample the seed lists on the kitchen at quantity 0.
SAMPLE_ACCESSORY = 'Kitchen Accessories - Pantry Pullout'


class WorkbookEstimateGenerationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command('seed_initial_estimate_demo', stdout=None)
        cls.items = json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))['items']
        cls.names = [name for name, _ in furniture_names(cls.items)]

    def setUp(self):
        project = Project.objects.create(name='Recreated from the catalogue')
        self.estimate = Estimate.objects.create(project=project, type='initial', version=1)

    def generate(self, name, width=None, height=None, depth=None, **kw):
        furniture = Furniture.objects.get(name=name)
        w, h, d = size_inches(furniture.default_length, furniture.default_height, furniture.default_breadth)
        rows, _ = generation.create_group(
            self.estimate, furniture, width or w, height or h, depth or d, **kw)
        return [EstimateItem.objects.get(pk=r.pk) for r in rows]

    def by_row(self, rows):
        return {(r.specification, r.model_name): r for r in rows}

    def test_every_workbook_line_generates_row_for_row(self):
        for item, name in zip(self.items, self.names):
            w, h, d = size_inches(item['length'], item['height'], item['breadth'])
            rows = [r for r in self.generate(name, w, h, d, area=item['area'], zone=item['zone'])
                    if r.specification != SAMPLE_ACCESSORY]
            self.assertEqual(len(rows), len(item['components']), name)
            for row, c in zip(rows, item['components']):
                where = f"{name} / {c['basic_component']} (sheet row {c['source_row']})"
                self.assertEqual(row.specification, c['basic_component'], where)
                self.assertEqual((row.brand, row.model_name), (c['brand'], c['model']), where)
                self.assertEqual(row.item_type, c['category_type'], where)
                self.assertEqual(row.qty, Decimal(c['quantity']), where)
                self.assertEqual(row.rate, Decimal(c['price']), where)
                self.assertEqual(row.margin_pct, Decimal(c['margin_pct']), where)
                self.assertEqual(row.application, c['detail'], where)
                cost = money(Decimal(c['quantity']) * Decimal(c['price']))
                margin = money(cost * Decimal(c['margin_pct']) / 100)
                gst = money((cost + margin) * Decimal(c['gst_pct']) / 100)
                self.assertEqual(row.total_amount, cost + margin + gst, where)
        self.estimate.refresh_from_db()
        # The workbook's own total is 46,42,665.68; it carries a 5.625 sft quantity
        # (stored here as 5.63) and unrounded paise.
        self.assertEqual(self.estimate.grand_total, Decimal('4642670.15'))

    def test_a_reused_name_gets_a_variant_only_when_it_differs(self):
        by_line = dict(zip([i['sno'] for i in self.items], self.names))
        self.assertEqual(by_line[4], 'Wardrobe')                       # Suite 3
        self.assertEqual(by_line[7], 'Wardrobe (Suite 1)')             # other laminate, channels …
        self.assertEqual(by_line[18], 'Wardrobe (Suite 1)')            # Suite 2: the same rows
        self.assertEqual(by_line[13], 'Wardrobe (Master Bedroom)')     # 9 ft
        self.assertEqual(by_line[15], 'Dressing with Mirror')          # repeats Suite 1's
        self.assertEqual(by_line[38], 'Site Management')               # project-level line

    def test_a_furniture_keeps_repeated_components_and_row_margins(self):
        wardrobe = Furniture.objects.get(name='Wardrobe')
        self.assertEqual(wardrobe.margin_pct, Decimal('35.00'))
        self.assertEqual(wardrobe.components.filter(basic_component__name='Accessories').count(), 3)
        ceiling = self.by_row(self.generate('Wooden False Ceiling'))
        self.assertEqual(ceiling['Core Material(12mm BWP Ply)', 'Lincoln BWP'].margin_pct, Decimal('35.00'))
        self.assertEqual(ceiling['Carpentry', ''].margin_pct, Decimal('10.00'))

    def test_another_size_scales_sheet_goods_and_leaves_counts(self):
        rows = self.by_row(self.generate('Wardrobe', 108, 108, 24))                           # 9' × 9'
        self.assertEqual(rows['Carpentry', 'Box'].qty, Decimal('81.00'))                      # 64 sft × 81/64
        self.assertEqual(rows['Core Material(08mm BWP Ply)', 'Lincoln BWP'].qty, Decimal('5.00'))    # 4 → 5.06
        self.assertEqual(rows['Core Material(16mm BWP Ply)', 'Lincoln BWP'].qty, Decimal('14.00'))   # 11 → 13.92
        self.assertEqual(rows['Finishing - Laminate', 'Grey Colour'].qty, Decimal('3.75'))    # quarter sheets
        self.assertEqual(rows['Door Edges', 'PVC 22mm x 2mm'].qty, Decimal('33.75'))          # 30 m × 9/8
        self.assertEqual(rows['Doors', ''].qty, Decimal('7.00'))
        self.assertEqual(rows['Box Hinges', 'Onsys - 0 Crank Soft Close'].qty, Decimal('13.00'))
        self.assertEqual(rows['Carpentry', 'Box'].quantity_rule, 'scaled')
        self.assertIn('standard size', rows['Carpentry', 'Box'].calc_basis)

    def test_resizing_a_group_rescales_and_keeps_typed_quantities(self):
        rows = self.generate('Wardrobe')
        key = rows[0].group_key
        hinges = next(r for r in rows if r.specification == 'Box Hinges')
        hinges.qty, hinges.qty_overridden = Decimal('12'), True
        hinges.save()
        generation.recalculate_group(self.estimate, key, width=108, height=108)
        rows = self.by_row(generation.group_rows(self.estimate, key))
        self.assertEqual(rows['Carpentry', 'Box'].qty, Decimal('81.00'))
        self.assertEqual(rows['Box Hinges', 'Onsys - 0 Crank Soft Close'].qty, Decimal('12.00'))
        generation.recalculate_group(self.estimate, key, width=96, height=96)                # back to 8' × 8'
        rows = self.by_row(generation.group_rows(self.estimate, key))
        self.assertEqual(rows['Carpentry', 'Box'].qty, Decimal('64.00'))
        self.assertEqual(rows['Core Material(16mm BWP Ply)', 'Lincoln BWP'].qty, Decimal('11.00'))

    def test_the_sample_accessory_does_not_change_the_kitchen_total(self):
        rows = self.generate('Base Wall and Loft')
        sample = next(r for r in rows if r.specification == SAMPLE_ACCESSORY)
        self.assertEqual((sample.qty, sample.total_amount), (Decimal('0.00'), Decimal('0.00')))
