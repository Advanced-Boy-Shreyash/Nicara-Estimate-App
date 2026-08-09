"""
Backfill version numbers and the current-version flag.

Rows created before version control existed all landed on version_no=1 with
is_current=True, so every version of a type looked live at once. Renumber
each (project, type) chain by date and leave exactly one current row —
the approved one if there is one, otherwise the newest.
"""
from django.db import migrations


def backfill(apps, schema_editor):
    Deliverable = apps.get_model('projects', 'ProjectDeliverable')

    chains = (Deliverable.objects
              .values_list('project_id', 'type')
              .distinct())

    for project_id, deliverable_type in chains:
        rows = list(
            Deliverable.objects
            .filter(project_id=project_id, type=deliverable_type)
            .order_by('date', 'id')
        )

        previous = None
        for index, row in enumerate(rows, start=1):
            row.version_no = index
            if not row.version:
                row.version = f'Ver {index}'
            row.is_current = False
            row.supersedes = previous
            row.save(update_fields=['version_no', 'version', 'is_current', 'supersedes'])
            previous = row

        # Prefer the approved version as the live one; else the newest.
        current = next((r for r in reversed(rows) if r.status == 'approved'), None)
        if current is None and rows:
            current = rows[-1]
        if current:
            current.is_current = True
            current.save(update_fields=['is_current'])


def noop(apps, schema_editor):
    """Nothing to undo — the columns are dropped by the reverse schema migration."""


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0005_alter_projectdeliverable_options_project_client_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]
