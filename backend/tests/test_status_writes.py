"""Staff status writes — the admin console lifecycle (AUDIT/API_GAPS closure).

Covers: auth gate, unknown ref -> 404, illegal transition -> 422, happy path
persists + lands in track history + audit_log, same-state idempotency.
"""
import re

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.db import get_conn
from app.main import app

c = TestClient(app)
TOKEN = get_settings().ADMIN_API_TOKEN
STAFF = {"Authorization": f"Bearer {TOKEN}"}
REF = re.compile(r"KSRTC-\d{4}-[A-Z0-9]{6}")


def _cleanup(ref: str):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM audit_log WHERE entity_type='complaint' AND entity_id=%s", (ref,))
        cur.execute(
            "DELETE FROM status_history WHERE complaint_id IN "
            "(SELECT id FROM complaints WHERE reference_id = %s)", (ref,))
        cur.execute("DELETE FROM complaints WHERE reference_id = %s", (ref,))


def _make_complaint() -> str:
    r = c.post(
        "/api/v1/complaints",
        json={
            "category": "cleanliness",
            "description": "Status write verification complaint.",
            "route_text": "Adoor - Ernakulam",
        },
        headers={"X-Idempotency-Key": "pytest-status-rpc-001"},
    )
    assert r.status_code == 201, r.text
    return r.json()["reference_id"]


def test_status_write_requires_staff_auth():
    r = c.post("/api/v1/complaints/KSRTC-2026-AAAAAA/status", json={"status": "in_review"})
    assert r.status_code in (401, 503), r.text  # fail closed either way


def test_status_write_unknown_ref_is_404():
    r = c.post(
        "/api/v1/complaints/KSRTC-2026-ZZZZZZ/status",
        json={"status": "in_review"},
        headers=STAFF,
    )
    assert r.status_code == 404, r.text
    assert "unknown reference" in r.json()["detail"].lower()


def test_status_happy_path_illegal_and_idempotent():
    ref = _make_complaint()
    try:
        # Legal move: submitted -> in_review
        r = c.post(f"/api/v1/complaints/{ref}/status",
                   json={"status": "in_review", "note": "Depot picked it up"},
                   headers=STAFF)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["changed"] is True and body["status"] == "in_review"

        # Visible on public track history (passenger sees the progression).
        t = c.get(f"/api/v1/complaints/{ref}").json()
        assert t["status"] == "in_review"
        assert any(h["to_status"] == "in_review" and h["note"] == "Depot picked it up"
                   for h in t["history"])

        # Illegal move: in_review -> submitted
        r = c.post(f"/api/v1/complaints/{ref}/status",
                   json={"status": "submitted"}, headers=STAFF)
        assert r.status_code == 422, r.text
        assert "illegal transition" in r.json()["detail"].lower()

        # Same-state write is idempotent (no duplicate history row).
        r = c.post(f"/api/v1/complaints/{ref}/status",
                   json={"status": "in_review"}, headers=STAFF)
        assert r.status_code == 200 and r.json()["changed"] is False
        t = c.get(f"/api/v1/complaints/{ref}").json()
        assert sum(1 for h in t["history"] if h["to_status"] == "in_review") == 1

        # history endpoint (staff)
        h = c.get(f"/api/v1/complaints/{ref}/status", headers=STAFF)
        assert h.status_code == 200
        assert [i["to_status"] for i in h.json()["items"]][:2] == ["submitted", "in_review"]

        # Audit row exists for the change (not for the idempotent no-op).
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT count(*) AS n FROM audit_log "
                "WHERE entity_type='complaint' AND entity_id=%s AND action='status_changed'",
                (ref,))
            assert cur.fetchone()["n"] == 1
    finally:
        _cleanup(ref)


def test_status_history_requires_staff_auth():
    r = c.get("/api/v1/complaints/KSRTC-2026-AAAAAA/status")
    assert r.status_code in (401, 503)


def test_status_history_unknown_ref_is_404():
    r = c.get("/api/v1/complaints/KSRTC-2026-ZZZZZZ/status", headers=STAFF)
    assert r.status_code == 404
