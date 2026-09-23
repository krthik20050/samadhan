"""Anonymised management dashboard (never phone/identity/location)."""
from fastapi import APIRouter, HTTPException, Query

from app.core.db import get_conn
from app.schemas.dashboard import DashboardList, DashboardSummary

router = APIRouter()

STATUSES = ("submitted", "in_review", "resolved", "closed", "escalated", "needs_triage")
CATEGORIES = ("cleanliness", "unsafe_driving", "overcrowding", "missed_stop",
              "concession_denied", "ticketing", "staff_behaviour", "bus_condition", "other")


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary():
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("SELECT count(*) AS n FROM complaints")
            total = cur.fetchone()["n"]
            cur.execute("SELECT count(*) AS n FROM complaints WHERE sla_breached")
            breached = cur.fetchone()["n"]
            cur.execute("SELECT status, count(*) AS n FROM complaints GROUP BY status")
            by_status = {r["status"]: r["n"] for r in cur.fetchall()}
            cur.execute("SELECT category, count(*) AS n FROM complaints GROUP BY category")
            by_category = {r["category"]: r["n"] for r in cur.fetchall()}
            return DashboardSummary(
                complaints=total, sla_breaches=breached,
                escalations=by_status.get("escalated", 0),
                needs_triage=by_status.get("needs_triage", 0),
                by_category=by_category, by_status=by_status,
            )
    except Exception:
        raise HTTPException(status_code=500, detail="storage failure")


@router.get("/complaints", response_model=DashboardList)
def dashboard_complaints(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: str | None = None,
    category: str | None = None,
):
    if status is not None and status not in STATUSES:
        raise HTTPException(status_code=422, detail="unknown status")
    if category is not None and category not in CATEGORIES:
        raise HTTPException(status_code=422, detail="unknown category")
    conds, params = [], []
    if status:
        conds.append("c.status = %s")
        params.append(status)
    if category:
        conds.append("c.category = %s")
        params.append(category)
    where = f"WHERE {' AND '.join(conds)}" if conds else ""
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(f"SELECT count(*) AS n FROM complaints c {where}", params)
            total = cur.fetchone()["n"]
            cur.execute(
                f"""SELECT c.reference_id, c.category, c.status, c.priority,
                           d.name AS depot, c.sla_breached, c.created_at
                    FROM complaints c LEFT JOIN depots d ON d.id = c.depot_id
                    {where} ORDER BY c.created_at DESC LIMIT %s OFFSET %s""",
                (*params, limit, offset),
            )
            return DashboardList(
                items=[dict(r) for r in cur.fetchall()],
                total=total, limit=limit, offset=offset,
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="storage failure")
