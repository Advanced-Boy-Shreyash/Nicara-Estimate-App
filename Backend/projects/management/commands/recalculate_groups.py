"""
Re-run the calculation rules for every furniture group on estimates that are
not approved — e.g. after the rules or the catalogue change.

    python manage.py recalculate_groups
    python manage.py recalculate_groups --project 12

Sizes, options, typed-over quantities and chosen brands are kept (see
projects.generation.recalculate_group).
"""
from django.core.management.base import BaseCommand

from projects import generation
from projects.models import EstimateItem


class Command(BaseCommand):
    help = 'Recalculate the furniture groups of every estimate that is not approved.'

    def add_arguments(self, parser):
        parser.add_argument('--project', type=int, help='Only this project id.')

    def handle(self, *args, **options):
        rows = (EstimateItem.objects.exclude(group_key='').exclude(estimate__status='approved')
                .select_related('estimate'))
        if options['project']:
            rows = rows.filter(estimate__project_id=options['project'])
        groups = {(r.estimate_id, r.group_key): r.estimate for r in rows}
        for (_, key), estimate in groups.items():
            generation.recalculate_group(estimate, key)
        self.stdout.write(self.style.SUCCESS(f'Recalculated {len(groups)} furniture group(s).'))
