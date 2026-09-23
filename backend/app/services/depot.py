"""Route -> depot resolution. Unknown route is NEVER rejected:
it becomes needs_triage with depot None (see ARCHITECTURE.md).

Resolution order for free text (dataset-integrated):
  1. exact route name (legacy ILIKE — dataset display names, e.g.
     'Guruvayur - Kozhikode'),
  2. dataset alias match (route_aliases.match_key, e.g. the EDP-published
     'GURUVAYOOR - KOZHIKKODE' spelling),
  3. canonical OD match: both halves of the typed text are folded,
     noise-stripped and alias-resolved with the SAME rules the dataset used
     (app/core/normalize.py), so 'Guruvayoor to Kozhikode' or
     'Trivandrum-Kochi' resolve to the canonical pair key.

A matching route only auto-routes through a VERIFIED mapping (dataset
policy: the AI/lookup never decides the depot; only VERIFIED rows may).
"""
from __future__ import annotations

from uuid import UUID

from app.core.normalize import route_text_match_key


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
        if not name:
            return None, None, None

        cur.execute("SELECT id FROM routes WHERE name ILIKE %s LIMIT 1", (name,))
        row = cur.fetchone()
        if row is not None:
            return _attach_depot(cur, row["id"])

        # Dataset aliases: lowercase key stored verbatim at import time.
        cur.execute(
            """SELECT DISTINCT r.id FROM route_aliases a
               JOIN routes r ON r.id = a.route_id
               WHERE a.match_key = %s""",
            (name.lower(),),
        )
        hit = _best_route(cur, [str(r["id"]) for r in cur.fetchall()])
        if hit is not None:
            return _attach_depot(cur, hit)

        # Canonical OD key from the same normalisation the dataset used.
        od_key = route_text_match_key(name)
        if od_key:
            cur.execute("SELECT id FROM routes WHERE od_match_key = %s", (od_key,))
            hit = _best_route(cur, [str(r["id"]) for r in cur.fetchall()])
            if hit is not None:
                return _attach_depot(cur, hit)

        return None, None, None


def _best_route(cur, route_ids: list) -> object | None:
    """Deterministic pick among alias candidates: prefer a route that can
    auto-route (has a VERIFIED depot), then stable ordering."""
    if not route_ids:
        return None
    cur.execute(
        """SELECT r.id,
                  (m.route_id IS NOT NULL) AS routable
           FROM routes r
           LEFT JOIN route_depot_mapping m
             ON m.route_id = r.id AND m.mapping_status = 'VERIFIED'
           WHERE r.id::text = ANY(%s)
           ORDER BY routable DESC, r.name LIMIT 1""",
        (route_ids,),
    )
    row = cur.fetchone()
    return row["id"] if row else None


def _attach_depot(cur, route_uuid):
    """VERIFIED mapping wins; deterministically by depot name."""
    cur.execute(
        """SELECT d.id AS depot_id, d.name AS depot_name
           FROM route_depot_mapping m JOIN depots d ON d.id = m.depot_id
           WHERE m.route_id = %s AND m.mapping_status = 'VERIFIED'
           ORDER BY d.name LIMIT 1""",
        (route_uuid,),
    )
    hit = cur.fetchone()
    if hit is None:
        return route_uuid, None, None
    return route_uuid, hit["depot_id"], hit["depot_name"]
