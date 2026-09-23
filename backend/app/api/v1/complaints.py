"""Complaint submission: validate -> depot -> SLA -> persist -> reference ID."""
import psycopg2
from fastapi import APIRouter, HTTPException

from app.core.db import get_conn
from app.schemas.complaint import ComplaintCreate, ComplaintOut, ComplaintTrack
from app.services.depot import resolve_depot
from app.services.reference import generate_reference_id
from app.services.sla import sla_due_at, sla_hours

router = APIRouter()


@router.post("", response_model=ComplaintOut, status_code=201)
def create_complaint(body: ComplaintCreate):
    try:
        with get_conn() as conn:
            try:
                route_uuid, depot_uuid, depot_name = resolve_depot(
                    conn, body.route_id, body.route_text
                )
            except ValueError as e:
                raise HTTPException(status_code=422, detail=str(e))
            _, resolution_hours = sla_hours(conn, body.category.value, body.priority.value)
            status = "submitted" if depot_uuid else "needs_triage"
            due = sla_due_at(resolution_hours)

            for _ in range(5):  # retry on reference_id collision (UNIQUE)
                ref = generate_reference_id()
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            """INSERT INTO complaints
                               (reference_id, bus_number, route_id, route_text, category,
                                location_text, description, contact_phone,
                                depot_id, status, priority, sla_due_at)
                               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                            (ref, body.bus_number, route_uuid,
                             (body.route_text or "").strip() or None,
                             body.category.value, body.location_text,
                             body.description.strip(), body.contact_phone,
                             depot_uuid, status, body.priority.value,
                             due),
                        )
                        cur.execute(
                            """INSERT INTO status_history (complaint_id, from_status, to_status)
                               SELECT id, NULL, %s FROM complaints WHERE reference_id = %s""",
                            (status, ref),
                        )
                    return ComplaintOut(
                        reference_id=ref, status=status, depot=depot_name,
                        sla_due_at=due,
                    )
                except psycopg2.errors.UniqueViolation as e:
                    if "reference_id" not in str(e):
                        raise
                    continue  # collision: retry with a fresh reference
            raise HTTPException(status_code=500, detail="could not issue reference ID")
    except HTTPException:
        raise
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
