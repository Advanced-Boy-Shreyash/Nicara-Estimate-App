"""
Passenger WSGI entry point for MilesWeb cPanel hosting.

cPanel's Passenger looks for this file in the application root directory.
It must expose an 'application' callable (the Django WSGI app).
"""
import os
import sys

# Add the project directory to the Python path
project_dir = os.path.dirname(os.path.abspath(__file__))
if project_dir not in sys.path:
    sys.path.insert(0, project_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nicara.settings')

from django.core.wsgi import get_wsgi_application  # noqa: E402
application = get_wsgi_application()
