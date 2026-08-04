"""
NICARA — Pagination.

The default page size stays at 50, but small reference lists (the item
catalogue, vendor tables) are fetched whole by the UI, so the client may ask
for a larger page via `?page_size=`, capped at 500.
"""
from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 500
