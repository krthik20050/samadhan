"""Test configuration and fixtures."""
import os
import pytest

from app.core.db import database_url

os.environ.setdefault("ADMIN_API_TOKEN", "test-staff-token")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "test-verify-token")


def _db_available() -> bool:
    url = database_url()
    if not url:
        return False
    try:
        import psycopg2
        conn = psycopg2.connect(url, connect_timeout=3)
        conn.close()
        return True
    except Exception:
        return False


DB_AVAILABLE = _db_available()


def pytest_collection_modifyitems(config, items):
    if DB_AVAILABLE:
        return
    skip_db = pytest.mark.skip(reason="Live database not configured or unreachable")
    db_files = {"test_complaints_api.py", "test_track_dashboard.py"}
    for item in items:
        if item.fspath.basename in db_files:
            item.add_marker(skip_db)
        elif item.name in {
            "test_webhook_files_complaint",
            "test_webhook_unknown_route_needs_triage",
        }:
            item.add_marker(skip_db)
