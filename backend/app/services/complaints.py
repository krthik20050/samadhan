"""Shared complaint filing — ONE pipeline for every channel.

The Postgres RPC ``app_file_complaint`` (migrations 005→011) is the single
source of truth for validation, route→depot resolution, SLA, reference-ID
issuance and idempotent replay. This service delegates to it so the FastAPI
harness (website + WhatsApp + Telegram local dev) and the hosted Edge Function
behave identically (AUDIT.md H-4: no divergent re-implementations).
"""
from __future__ import annotations

import psycopg2
from psycopg2.extras import Json

from app.core.db import get_conn
from app.schemas.complaint import ComplaintCreate, ComplaintOut

# The RPC raises '22023' (invalid_parameter_value) for user-input problems.
_VALIDATION_ERRORS = (
    psycopg2.errors.InvalidParameterValue,
    psycopg2.errors.InvalidTextRepresentation,
    psycopg2.errors.RaiseException,
)


def _to_value_error(exc: psycopg2.Error) -> ValueError:
    """Map the RPC's 22023 validation errors onto the API's 422 contract."""
    msg = getattr(exc, "diag", None) and exc.diag.message_primary or str(exc)
    return ValueError(str(msg).split("\n")[0][:200])


def file_complaint(
    body: ComplaintCreate,
    *,
    source_channel: str = "web",
    idempotency_key: str | None = None,
    actor_id: str | None = None,
    request_id: str | None = None,
) -> ComplaintOut:
    """File via the app_file_complaint RPC. Raises ValueError on validation
    failures; DB/infrastructure errors bubble (API maps to 500)."""
    with get_conn() as conn, conn.cursor() as cur:
        try:
            cur.execute(
                "SELECT app_file_complaint(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (
                    body.category.value,
                    body.description,
                    # psycopg2 has no default UUID adapter and this codebase
                    # never registers one — pass the RFC-4122 string form.
                    str(body.route_id) if body.route_id else None,
                    body.route_text,
                    body.bus_number,
                    body.location_text,
                    body.contact_phone,
                    body.priority.value,
                    None,  # p_telegram_chat_id (bots pass it via their own paths)
                    None,  # p_travel_date (web schema carries it later; bots via RPC)
                    None,  # p_ticket_extracted
                    None,  # p_evidence (uploads attach through the Edge Function)
                    None,  # p_user_id (identity attaches at the Edge Function)
                    source_channel,
                    idempotency_key,
                ),
            )
        except _VALIDATION_ERRORS as exc:
            raise _to_value_error(exc) from exc
        row = cur.fetchone()
        out = row["app_file_complaint"] if row else None
        if not out or not out.get("reference_id"):
            raise RuntimeError("filing RPC returned no reference ID")
        result = ComplaintOut(
            reference_id=out["reference_id"],
            status=out["status"],
            depot=out.get("depot"),
            sla_due_at=out.get("sla_due_at"),
        )

    # Audit in its OWN transaction: the filing has committed above. A failed
    # audit statement must never poison the filing's transaction (otherwise
    # get_conn's commit would silently roll back a complaint the user was
    # already shown a reference ID for).
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT app_audit_log(%s,%s,%s,%s,%s,%s,%s)",
                (
                    "passenger",
                    "complaint_filed",
                    actor_id,
                    "complaint",
                    result.reference_id,
                    Json({
                        "channel": source_channel,
                        "replay": bool(out.get("idempotent_replay")),
                    }),
                    request_id,
                ),
            )
    except Exception:  # noqa: BLE001 — audit is advisory; the filing is durable
        pass

    return result
