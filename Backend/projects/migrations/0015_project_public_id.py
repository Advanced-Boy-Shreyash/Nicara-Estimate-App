import string

from django.db import migrations, models
from django.utils.crypto import get_random_string

import projects.models


def populate_public_ids(apps, schema_editor):
    Project = apps.get_model('projects', 'Project')
    used = set()
    for project in Project.objects.only('pk').order_by('pk').iterator():
        public_id = get_random_string(
            8, allowed_chars=string.ascii_uppercase + string.digits,
        )
        while public_id in used:
            public_id = get_random_string(
                8, allowed_chars=string.ascii_uppercase + string.digits,
            )
        used.add(public_id)
        Project.objects.filter(pk=project.pk).update(public_id=public_id)


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0014_remove_estimateitemcomponent_catalog_material_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='public_id',
            field=models.CharField(blank=True, editable=False, max_length=8, null=True),
        ),
        migrations.RunPython(populate_public_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='project',
            name='public_id',
            field=models.CharField(
                default=projects.models.generate_project_public_id,
                editable=False,
                max_length=8,
                unique=True,
            ),
        ),
    ]
