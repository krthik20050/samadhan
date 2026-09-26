"""Test-only staff token. Set before app import (get_settings is cached)."""
import os

os.environ.setdefault("ADMIN_API_TOKEN", "test-staff-token")

# ---------------------------------------------------------------------------
# needs_db marker: DB-backed tests (filing/track/status/E2E) hit the live
# Supabase Postgres through DATABASE_URL. In environments without a reachable
# DB (CI has no secret; sandboxes block egress) they would all fail on
# psycopg2 connection timeouts. They skip instead — and run in full wherever
# DATABASE_URL points at a reachable database (author machine / CI w/ secret).
# Collection runs ONE fast reachability probe (3s socket connect, cached).
# ---------------------------------------------------------------------------
import socket
from pathlib import Path
from urllib.parse import urlparse, unquote

import pytest


def _database_host_port() -> tuple[str, int] | None:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        try:
            from dotenv import dotenv_values

            # app/backend/tests/conftest.py -> parents[2] = repo root (app/)
            url = dotenv_values(Path(__file__).resolve().parents[2] / ".env").get(
                "DATABASE_URL", ""
            )
        except Exception:  # noqa: BLE001
            return None
    if not url:
        return None
    try:
        parsed = urlparse(url)
        return parsed.hostname or "", parsed.port or 5432
    except Exception:  # noqa: BLE001
        return None


def _db_reachable() -> bool:
    hp = _database_host_port()
    if hp is None:
        return False
    host, port = hp
    try:
        with socket.create_connection((host, port), timeout=3):
            return True
    except OSError:
        return False


_DB_OK: bool | None = None


def pytest_configure(config):
    config.addinivalue_line("markers", "needs_db: requires a reachable DATABASE_URL")


def pytest_collection_modifyitems(config, items):
    global _DB_OK
    needs = [item for item in items if "needs_db" in item.keywords]
    if not needs:
        return
    if _DB_OK is None:
        _DB_OK = _db_reachable()
    if _DB_OK:
        return
    skip = pytest.mark.skip(reason="DATABASE_URL not configured or unreachable")
    for item in needs:
        item.add_marker(skip)
