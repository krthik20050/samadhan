"""Complaint submission: validate -> depot -> SLA -> persist -> reference ID."""
from fastapi import APIRouter, HTTPException

from app.core.db import get_conn
from app.schemas.complaint import ComplaintCreate, ComplaintOut, ComplaintTrack
from app.services.complaints import file_complaint

router = APIRouter()


@router.post("", response_model=ComplaintOut, status_code=201)
def create_complaint(body: ComplaintCreate):
    try:
        return file_complaint(body)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:  # e.g. DATABASE_URL missing
        raise HTTPException(status_code=500, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="storage failure")


@router.get("/{reference_id}", response_model=ComplaintTrack)
def track_complaint(reference_id: str):
    ref = reference_id.strip().upper()
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                """SELECT c.reference_id, c.bus_number, c.route_text, c.category,
                          c.priority, c.status, d.name AS depot,
                          c.sla_due_at, c.sla_breached, c.created_at
                   FROM complaints c LEFT JOIN depots d ON d.id = c.depot_id
                   WHERE c.reference_id = %s""",
                (ref,),
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="unknown reference ID")
            cur.execute(
                """SELECT h.from_status, h.to_status, h.changed_by, h.created_at
                   FROM status_history h JOIN complaints c ON c.id = h.complaint_id
                   WHERE c.reference_id = %s ORDER BY h.created_at""",
                (ref,),
            )
            return ComplaintTrack(**dict(row), history=[dict(h) for h in cur.fetchall()])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="storage failure")
