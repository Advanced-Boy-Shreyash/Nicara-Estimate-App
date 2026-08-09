"""
NICARA — Image derivative generation.

Renders and mood boards come off a designer's machine at 10–40 MB. Serving
those into a gallery is what makes the app feel slow, so on upload we store
two smaller derivatives alongside the original:

    thumbnail   400px  — grid tiles and table rows
    preview    1600px  — the in-app lightbox

The original is never modified and stays available for download.
EXIF orientation is applied so phone photos are not sideways, and the EXIF
block is then dropped (it carries GPS coordinates we have no reason to keep).
"""
import io
import os

from django.core.files.base import ContentFile

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover - Pillow is a hard requirement
    Image = None
    ImageOps = None

THUMBNAIL_MAX = (400, 400)
PREVIEW_MAX = (1600, 1600)
JPEG_QUALITY = 82

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'}


def is_image(filename):
    return os.path.splitext(filename or '')[1].lower() in IMAGE_EXTENSIONS


def _render(source, max_size):
    """Return a downscaled JPEG copy of `source` bounded by `max_size`."""
    image = Image.open(source)
    # Rotate per EXIF, then drop the metadata by rebuilding the image.
    image = ImageOps.exif_transpose(image)

    if image.mode in ('RGBA', 'LA', 'P'):
        background = Image.new('RGB', image.size, (255, 255, 255))
        converted = image.convert('RGBA')
        background.paste(converted, mask=converted.split()[-1])
        image = background
    elif image.mode != 'RGB':
        image = image.convert('RGB')

    image.thumbnail(max_size, Image.LANCZOS)

    buffer = io.BytesIO()
    image.save(buffer, format='JPEG', quality=JPEG_QUALITY, optimize=True, progressive=True)
    buffer.seek(0)
    return buffer


def build_derivatives(instance, *, source_field='file',
                      thumb_field='thumbnail', preview_field='preview'):
    """
    Populate the thumbnail and preview fields from the uploaded file.

    Safe to call on non-images and when Pillow is unavailable — it simply
    does nothing, leaving the original download working.
    """
    if Image is None:
        return False

    source = getattr(instance, source_field, None)
    if not source or not source.name or not is_image(source.name):
        return False

    stem = os.path.splitext(os.path.basename(source.name))[0]

    try:
        source.open('rb')
        raw = source.read()
    except (FileNotFoundError, ValueError):
        return False
    finally:
        try:
            source.close()
        except Exception:
            pass

    for field_name, max_size, suffix in (
        (thumb_field, THUMBNAIL_MAX, 'thumb'),
        (preview_field, PREVIEW_MAX, 'preview'),
    ):
        if not hasattr(instance, field_name):
            continue
        try:
            rendered = _render(io.BytesIO(raw), max_size)
        except Exception:
            # A corrupt or unsupported image should not fail the upload.
            continue
        getattr(instance, field_name).save(
            f'{stem}_{suffix}.jpg', ContentFile(rendered.read()), save=False
        )

    return True
