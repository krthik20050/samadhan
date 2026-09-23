"""Phase 3 tests against the live Supabase DB. Each test deletes its own rows
(history first — RESTRICT blocks complaint delete otherwise)."""
import os
import re
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.db import get_conn
from app.main import app

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="live database tests require DATABASE_URL",
)

client = TestClient(app)
REF = re.compile(r"KSRTC-\d{4}-[A-Z0-9]{6}")

BASE = {
    "bus_number": "KL-15-1234",
    "category": "overcrowding",
    "location_text": "Kottarakkara stop",
    "description": "Bus was severely overcrowded and skipped the stop.",
}


def cleanup(ref: str):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "DELETE FROM status_history WHERE complaint_id IN "
            "(SELECT id FROM complaints WHERE reference_id = %s)",
            (ref,),
        )
        cur.execute("DELETE FROM complaints WHERE reference_id = %s", (ref,))


def test_create_known_route():
    r = client.post("/api/v1/complaints", json={**BASE, "route_text": "Adoor - Ernakulam"})
    try:
        assert r.status_code == 201, r.text
        body = r.json()
        assert REF.fullmatch(body["reference_id"])
        assert body["status"] == "submitted"
        assert body["depot"] == "ADOOR"
        assert body["sla_due_at"]
    finally:
        cleanup(r.json()["reference_id"])


def test_create_by_route_id():
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM routes WHERE name='Adoor - Ernakulam' LIMIT 1")
        rid = str(cur.fetchone()["id"])
    r = client.post("/api/v1/complaints", json={**BASE, "route_id": rid})
    try:
        assert r.status_code == 201, r.text
        assert r.json()["depot"] == "ADOOR"
    finally:
        cleanup(r.json()["reference_id"])


def test_create_unknown_route_needs_triage():
    r = client.post("/api/v1/complaints", json={**BASE, "route_text": "No Such Route XYZ"})
    try:
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["status"] == "needs_triage"
        assert body["depot"] is None
    finally:
        cleanup(r.json()["reference_id"])


def test_validation():
    assert client.post("/api/v1/complaints",
                       json={**BASE, "route_text": "Adoor - Ernakulam",
                             "description": "short"}).status_code == 422
    assert client.post("/api/v1/complaints",
                       json={k: v for k, v in BASE.items() if k != "location_text"
                             }).status_code == 422  # no route at all
    assert client.post("/api/v1/complaints",
                       json={**BASE, "route_id": str(uuid4())}).status_code == 422
