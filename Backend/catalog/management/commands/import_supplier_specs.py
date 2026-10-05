"""
Align the catalogue's base components with the client's supplier price sheet.

    python manage.py import_supplier_specs                  # bundled copy of the sheet
    python manage.py import_supplier_specs --file "sample template.xlsx"
    python manage.py import_supplier_specs --file … --dry-run

Prices are updated in place; imported rows are marked source=supplier_sheet.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from catalog.supplier_specs import SHEET_NAME, import_specs, parse_workbook


class Command(BaseCommand):
    help = "Import base components (ply, hardware, finishes…) from the supplier price sheet."

    def add_arguments(self, parser):
        parser.add_argument('--file', help='Path to the workbook (default: bundled copy).')
        parser.add_argument('--sheet', default=SHEET_NAME)
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **opts):
        if opts['file']:
            try:
                specs = parse_workbook(opts['file'], opts['sheet'])
            except (OSError, ValueError) as exc:
                raise CommandError(str(exc))
            origin = opts['file']
        else:
            from catalog.supplier_specs_data import SUPPLIER_SPECS
            specs, origin = SUPPLIER_SPECS, 'bundled supplier sheet'

        with transaction.atomic():
            created, updated, retired = import_specs(specs, dry_run=opts['dry_run'])
            if opts['dry_run']:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(
            f"{'[dry run] ' if opts['dry_run'] else ''}{len(specs)} base components from {origin}: "
            f"{created} created, {updated} updated, {retired} placeholder(s) retired."))
