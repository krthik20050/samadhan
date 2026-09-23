"""Track + dashboard tests (live DB, self-cleaning)."""
from fastapi.testclient import TestClient

from app.main import app
from tests.test_complaints_api import BASE, REF, cleanup, client  # noqa: F401

TRACK_ALLOW = {"reference_id", "bus_number", "route_text", "category", "priority",
               "status", "depot", "sla_due_at", "sla_breached", "created_at", "history"}
DASH_ALLOW = {"reference_id", "category", "status", "priority",
              "depot", "sla_breached", "created_at"}
STAFF = {"headers": {"Authorization": "Bearer test-staff-token"}}


def _make():
    r = client.post("/api/v1/complaints", json={**BASE, "route_text": "Adoor - Ernakulam"})
    assert r.status_code == 201, r.text
    return r.json()["reference_id"]


def test_track_found_and_allowlisted():
    ref = _make()
    try:
        r = client.get(f"/api/v1/complaints/{ref.lower()}")  # lowercase must work
        assert r.status_code == 200, r.text
        body = r.json()
        assert set(body) <= TRACK_ALLOW, set(body) - TRACK_ALLOW
        assert body["status"] == "submitted" and body["depot"] == "ADOOR"
        assert body["history"] and body["history"][0]["to_status"] == "submitted"
    finally:
        cleanup(ref)


def test_track_404():
    assert client.get("/api/v1/complaints/KSRTC-2026-NOPE01").status_code == 404


def test_dashboard():
    ref = _make()
    try:
        s = client.get("/api/v1/dashboard/summary").json()
        assert s["complaints"] >= 1 and s["by_status"]["submitted"] >= 1
        lst = client.get("/api/v1/dashboard/complaints?limit=5", **STAFF).json()
        assert lst["total"] >= 1 and lst["limit"] == 5
        assert set(lst["items"][0]) <= DASH_ALLOW
        assert client.get("/api/v1/dashboard/complaints?status=bogus", **STAFF).status_code == 422
    finally:
        cleanup(ref)


def test_dashboard_list_requires_staff():
    assert client.get("/api/v1/dashboard/complaints").status_code == 401
    assert client.get("/api/v1/dashboard/complaints",
                      headers={"Authorization": "Bearer wrong"}).status_code == 401
    # summary stays public (transparency page aggregates)
    assert client.get("/api/v1/dashboard/summary").status_code != 401


def test_staff_login():
    assert client.post("/api/v1/auth/login",
                       json={"password": "test-staff-token"}).status_code == 200
    assert client.post("/api/v1/auth/login",
                       json={"password": "wrong"}).status_code == 401
