"""Route -> depot resolution. Unknown route is NEVER rejected:
it becomes needs_triage with depot None (see ARCHITECTURE.md)."""
from __future__ import annotations

from uuid import UUID


def resolve_depot(conn, route_id: UUID | None, route_text: str | None):
    """Returns (route_uuid_or_None, depot_uuid_or_None, depot_name_or_None)."""
    with conn.cursor() as cur:
        if route_id is not None:
            cur.execute("SELECT id FROM routes WHERE id = %s", (str(route_id),))
            row = cur.fetchone()
            if row is None:
                raise ValueError("unknown route_id")
            return _attach_depot(cur, row["id"])

        name = (route_text or "").strip()
        cur.execute("SELECT id FROM routes WHERE name ILIKE %s LIMIT 1", (name,))
        row = cur.fetchone()
        if row is None:
            return None, None, None
        return _attach_depot(cur, row["id"])


def _attach_depot(cur, route_uuid):
    cur.execute(
        """SELECT d.id AS depot_id, d.name AS depot_name
           FROM route_depot_mapping m JOIN depots d ON d.id = m.depot_id
           WHERE m.route_id = %s AND m.mapping_status = 'VERIFIED' LIMIT 1""",
        (route_uuid,),
    )
    hit = cur.fetchone()
    if hit is None:
        return route_uuid, None, None
    return route_uuid, hit["depot_id"], hit["depot_name"]
