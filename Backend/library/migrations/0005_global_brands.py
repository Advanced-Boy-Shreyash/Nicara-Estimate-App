"""
Brands become one master list: MaterialBrand loses its category, and brands
with the same name (one per category before) are merged into one, with their
raw materials re-pointed to it.
"""
from django.db import migrations, models


def merge_brands(apps, schema_editor):
    MaterialBrand = apps.get_model('library', 'MaterialBrand')
    MaterialItem = apps.get_model('library', 'MaterialItem')
    keepers = {}
    for brand in MaterialBrand.objects.order_by('id'):
        name = ' '.join(brand.name.split())
        key = name.lower()
        keeper = keepers.get(key)
        if keeper is None:
            if brand.name != name:
                brand.name = name
                brand.save(update_fields=['name'])
            keepers[key] = brand
            continue
        MaterialItem.objects.filter(brand_id=brand.id).update(brand_id=keeper.id)
        if brand.is_active and not keeper.is_active:
            keeper.is_active = True
            keeper.save(update_fields=['is_active'])
        if brand.website and not keeper.website:
            keeper.website = brand.website
            keeper.save(update_fields=['website'])
        brand.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('library', '0004_materialcategory_product_group_materialitem_category_and_more'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='materialbrand',
            unique_together=set(),
        ),
        migrations.RunPython(merge_brands, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='materialbrand',
            name='name',
            field=models.CharField(max_length=100, unique=True),
        ),
        migrations.RemoveField(
            model_name='materialbrand',
            name='category',
        ),
    ]
