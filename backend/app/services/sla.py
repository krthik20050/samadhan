"""SLA lookup with fallbacks: (category,priority) -> (category,normal) ->
(other,normal) -> hardcoded 24/96 default (unreachable with full seed)."""
from datetime import datetime, timedelta, timezone


def sla_hours(conn, category: str, priority: str) -> tuple[int, int]:
    with conn.cursor() as cur:
        for cat, pri in ((category, priority), (category, "normal"), ("other", "normal")):
            cur.execute(
                "SELECT response_hours, resolution_hours FROM sla_rules"
                " WHERE category = %s AND priority = %s",
                (cat, pri),
            )
            row = cur.fetchone()
            if row:
                return row["response_hours"], row["resolution_hours"]
    return 24, 96


def sla_due_at(resolution_hours: int, now: datetime | None = None) -> datetime:
    return (now or datetime.now(timezone.utc)) + timedelta(hours=resolution_hours)
