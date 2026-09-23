"""v1 lookup endpoints — dataset-backed route/depot dropdowns.

Sources (dataset = data/final/*.csv via scripts/import_dataset.py):
  /routes   -> routes + best VERIFIED depot per route (auto_routable)
  /depots   -> depots + count of auto-routable routes, ordered by that count
Both honour `q=` on name/origin/destination/alias (case-insensitive) and
bounded limits; unknown route_text stays a needs_triage case — these
endpoints exist to populate form dropdowns, never to reject a complaint.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.core.db import get_conn
from app.schemas.lookup import DepotList, RouteList

router = APIRouter()


@router.get("/routes", response_model=RouteList)
def list_routes(
    q: str | None = None,
    limit: int = Query(50, ge=1, le=200),
):
    needle = (q or "").strip()
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                """SELECT r.id::text, r.name, r.origin, r.destination,
                          r.service_type, d.name AS depot_name,
                          (d.name IS NOT NULL) AS auto_routable
                   FROM routes r
                   LEFT JOIN LATERAL (
                     SELECT dep.name FROM route_depot_mapping m
                     JOIN depots dep ON dep.id = m.depot_id
                     WHERE m.route_id = r.id AND m.mapping_status = 'VERIFIED'
                     ORDER BY dep.name LIMIT 1
                   ) d ON true
                   WHERE (%s = '' OR r.name ILIKE '%%' || %s || '%%'
                          OR r.origin ILIKE '%%' || %s || '%%'
                          OR r.destination ILIKE '%%' || %s || '%%'
                          OR EXISTS (SELECT 1 FROM route_aliases a
                                     WHERE a.route_id = r.id
                                       AND a.match_key LIKE '%%' || lower(%s) || '%%'))
                   ORDER BY (d.name IS NOT NULL) DESC, r.name
                   LIMIT %s""",
                (needle, needle, needle, needle, needle, limit),
            )
            return RouteList(items=[dict(r) for r in cur.fetchall()])
    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="storage failure")


@router.get("/depots", response_model=DepotList)
def list_depots(
    q: str | None = None,
    limit: int = Query(200, ge=1, le=300),
):
    needle = (q or "").strip()
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                """SELECT dep.id::text, dep.name, dep.district, dep.phone,
                          dep.email, dep.zone,
                          count(m.route_id) FILTER (
                            WHERE m.mapping_status = 'VERIFIED') AS verified_routes
                   FROM depots dep
                   LEFT JOIN route_depot_mapping m ON m.depot_id = dep.id
                   WHERE (%s = '' OR dep.name ILIKE '%%' || %s || '%%'
                          OR COALESCE(dep.district, '') ILIKE '%%' || %s || '%%')
                   GROUP BY dep.id
                   ORDER BY verified_routes DESC, dep.name
                   LIMIT %s""",
                (needle, needle, needle, limit),
            )
            return DepotList(items=[dict(r) for r in cur.fetchall()])
    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="storage failure")
