"""
NICARA — Uniform API error shape.

DRF renders validation errors in several shapes (a bare string, a list, a dict
of field → list). Every error response from this API is normalised to:

    { "detail": "<human readable message>",
      "errors": { "<field>": ["<message>", ...] },   # only when field errors exist
      "code":   "<drf code>" }                       # only when DRF supplies one

so the frontend has exactly one thing to read.
"""
from rest_framework.views import exception_handler as drf_exception_handler


def _flatten(value):
    """Reduce a nested DRF error value to a single readable string."""
    if isinstance(value, (list, tuple)):
        return ' '.join(_flatten(v) for v in value if v is not None)
    if isinstance(value, dict):
        return ' '.join(_flatten(v) for v in value.values())
    return str(value)


def api_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    code = None
    errors = {}

    if isinstance(data, dict):
        code = data.get('code')
        if 'detail' in data:
            detail = _flatten(data['detail'])
            errors = {k: v for k, v in data.items() if k not in ('detail', 'code')}
        else:
            errors = {k: v for k, v in data.items() if k != 'code'}
            detail = _flatten(next(iter(errors.values()))) if errors else 'Request failed.'
    else:
        detail = _flatten(data)

    payload = {'detail': detail}
    if errors:
        payload['errors'] = {
            k: v if isinstance(v, list) else [_flatten(v)] for k, v in errors.items()
        }
    if code:
        payload['code'] = code

    response.data = payload
    return response
