"""Shared complaint filing: validate -> depot -> SLA -> persist -> reference ID.

Used by POST /complaints and the WhatsApp webhook — one path, no drift.
"""
from __future__ import annotations

import psycopg2

from app.core.db import get_conn
from app.schemas.complaint import ComplaintCreate, ComplaintOut
from app.services.depot import resolve_depot
from app.services.reference import generate_reference_id
from app.services.sla import sla_due_at, sla_hours


def file_complaint(body: ComplaintCreate) -> ComplaintOut:
    """Persist a complaint, return its reference. Raises ValueError (bad
    route_id) / RuntimeError (no DB / ID exhaustion); other DB errors bubble."""
    with get_conn() as conn:
        route_uuid, depot_uuid, depot_name = resolve_depot(
            conn, body.route_id, body.route_text
        )
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
        raise RuntimeError("could not issue reference ID")
