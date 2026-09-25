"""Complaint submission: validate -> depot -> SLA -> persist -> reference ID."""
import uuid

from fastapi import APIRouter, Header, HTTPException, Request, Response

from app.core.db import get_conn
from app.schemas.complaint import ComplaintCreate, ComplaintOut, ComplaintTrack
from app.services.complaints import file_complaint

router = APIRouter()


@router.post("", response_model=ComplaintOut, status_code=201)
def create_complaint(
    body: ComplaintCreate,
    request: Request,
    response: Response,
    x_idempotency_key: str | None = Header(default=None),
):
    # Correlation id (AUDIT.md M-3): honour inbound, else mint; echoed back.
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    if not (4 <= len(req_id) <= 64 and all(c.isalnum() or c in "-_" for c in req_id)):
        req_id = str(uuid.uuid4())
    response.headers["X-Request-Id"] = req_id

    # Idempotent submission (AUDIT.md H-7): retries with the same key return
    # the original complaint instead of filing a duplicate.
    idem = x_idempotency_key if (
        x_idempotency_key and 8 <= len(x_idempotency_key) <= 128
        and all(c.isalnum() or c in "-_" for c in x_idempotency_key)
    ) else None

    try:
        return file_complaint(
            body,
            source_channel="web",
            idempotency_key=idem,
            request_id=req_id,
        )
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
