"""Complaint submission + staff lifecycle writes (same RPCs the site uses)."""
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response

from app.core.auth import require_staff
from app.core.db import get_conn
from app.schemas.complaint import (
    ComplaintCreate,
    ComplaintOut,
    ComplaintTrack,
    StatusWrite,
)
from app.services.complaints import file_complaint
from psycopg2.errors import InvalidParameterValue, InvalidTextRepresentation, NoDataFound, RaiseException

_STATUS_ERRORS = (InvalidParameterValue, InvalidTextRepresentation, NoDataFound, RaiseException)

router = APIRouter()

STATUS_SET_ENDPOINT = """SELECT app_set_status(%s,%s,%s,%s,%s)"""
STATUS_HISTORY_ENDPOINT = "SELECT app_status_history(%s)"


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


@router.post("/{reference_id}/status")
def set_status(
    reference_id: str,
    body: StatusWrite,
    request: Request,
    _: None = Depends(require_staff),
):
    """Staff-only lifecycle write. The RPC re-checks transitions (mirror of the
    003 trigger), writes status_history + audit_log atomically, and is
    idempotent for same-state requests."""
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                STATUS_SET_ENDPOINT,
                (
                    reference_id.strip().upper(),
                    body.status,
                    body.note,
                    "staff-api",
                    req_id,
                ),
            )
            row = cur.fetchone()
            return dict(row)["app_set_status"]
    except _STATUS_ERRORS as exc:
        msg = str(exc).split("\n")[0]
        code = getattr(exc, "diag", None) and exc.diag.message_primary or msg
        if "unknown reference ID" in str(code):
            raise HTTPException(status_code=404, detail="unknown reference ID")
        raise HTTPException(status_code=422, detail=str(code).split("\n")[0][:200])
    except Exception:
        raise HTTPException(status_code=500, detail="storage failure")


@router.get("/{reference_id}/status")
def status_history(
    reference_id: str,
    _: None = Depends(require_staff),
):
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(STATUS_HISTORY_ENDPOINT, (reference_id.strip().upper(),))
            return {"items": cur.fetchone()["app_status_history"]}
    except _STATUS_ERRORS as exc:
        if "unknown reference ID" in str(exc):
            raise HTTPException(status_code=404, detail="unknown reference ID")
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
                """SELECT h.from_status, h.to_status, h.changed_by, h.note, h.created_at
                   FROM status_history h JOIN complaints c ON c.id = h.complaint_id
                   WHERE c.reference_id = %s ORDER BY h.created_at""",
                (ref,),
            )
            return ComplaintTrack(**dict(row), history=[dict(h) for h in cur.fetchall()])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="storage failure")
