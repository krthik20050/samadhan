"""Import the sibling dataset (data/final/*.csv) into PostgreSQL.

Idempotent: rows are keyed by the dataset's deterministic IDs stored in
`external_id`, so re-runs UPDATE in place instead of duplicating. Loads are
staged with COPY and merged set-based, so a full run is a handful of server
round-trips — fast even over a transaction-mode pooler.

Run from the repo root or backend/:
    python -m scripts.import_dataset            # ../dataset/data/final
    python -m scripts.import_dataset --dataset-dir ../../dataset/data/final
"""
from __future__ import annotations

import argparse
import csv
import io
import sys
from datetime import datetime, timezone
from pathlib import Path

# Allow "python scripts/import_dataset.py" as well as -m.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.db import get_conn  # noqa: E402

DEFAULT_DATASET_DIR = Path(__file__).resolve().parents[3] / "dataset" / "data" / "final"

# COPY text-format escapes (raw strings keep the backslashes literal).
NULL_MARKER = r"\N"
BACKSLASH = chr(92)
TAB = chr(9)
NEWLINE = chr(10)
CR = chr(13)


def _read(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _cell(value: str | None) -> str:
    """Encode one field for COPY text format."""
    if value is None:
        return NULL_MARKER
    s = str(value).replace(BACKSLASH, BACKSLASH * 2)
    # Newlines/tabs would break the row framing; dataset rows are
    # whitespace-collapsed single lines, but defend anyway.
    return s.replace(TAB, " ").replace(NEWLINE, " ").replace(CR, " ")


def _stage(cur, table: str, columns: list[str], rows: list[list[str | None]]) -> None:
    """Stream rows into stg_<table> via COPY text format."""
    buf = io.StringIO()
    for row in rows:
        buf.write(TAB.join(_cell(v) for v in row) + NEWLINE)
    buf.seek(0)  # copy_expert reads from the current position
    cur.copy_expert(
        f"COPY stg_{table} ({', '.join(columns)}) FROM STDIN WITH (FORMAT text)",
        buf,
    )


def _stage_depots(cur, rows: list[dict[str, str]]) -> None:
    _stage(cur, "depots",
           ["external_id", "name", "district", "phone", "address", "email", "zone", "pincode"],
           [[r["depot_id"].strip(), r["depot_name"].strip(), _clean(r.get("district")),
             _clean(r.get("phone")), _clean(r.get("address")), _clean(r.get("x_email")),
             _clean(r.get("x_zone")), _clean(r.get("pincode"))] for r in rows])


def _stage_routes(cur, rows: list[dict[str, str]]) -> None:
    _stage(cur, "routes",
           ["external_id", "name", "origin", "destination", "service_type"],
           [[r["route_id"].strip(), r["route_name"].strip(), r["origin"].strip(),
             r["destination"].strip(), _clean(r.get("service_type"))] for r in rows])


def _stage_mappings(cur, rows: list[dict[str, str]]) -> tuple[int, int]:
    """Stage VERIFIED/PROBABLE mappings; return (staged, skipped_unknown)."""
    staged = []
    skipped = 0
    for r in rows:
        status = r["mapping_status"].strip()
        if status not in ("VERIFIED", "PROBABLE") or not _clean(r.get("depot_id")):
            skipped += 1
            continue  # UNKNOWN rows have no depot; needs_triage covers them at runtime
        staged.append([r["route_id"].strip(), r["depot_id"].strip(), status,
                       "true" if r["review_required"].strip().lower() == "true" else "false"])
    _stage(cur, "mappings",
           ["route_ext", "depot_ext", "mapping_status", "review_required"], staged)
    return len(staged), skipped


def _stage_aliases(cur, rows: list[dict[str, str]]) -> None:
    """route_aliases.csv: route name variants as published (e.g. the EDP
    spelling 'GURUVAYOOR - KOZHIKKODE'). match_key is the lowercase alias."""
    staged = []
    for r in rows:
        alias = _clean(r.get("normalized_name")) or _clean(r.get("original_name"))
        if not alias:
            continue
        staged.append([r["alias_id"].strip(), r["route_id"].strip(), alias, alias.lower()])
    _stage(cur, "aliases", ["alias_ext", "route_ext", "alias", "match_key"], staged)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dataset-dir", type=Path, default=DEFAULT_DATASET_DIR,
                    help="directory containing the dataset final CSVs")
    ap.add_argument("--skip-aliases", action="store_true",
                    help="skip route_aliases import")
    args = ap.parse_args()

    final = args.dataset_dir
    for name in ("depots.csv", "routes.csv", "route_depot_mapping.csv", "route_aliases.csv"):
        if not (final / name).exists():
            print(f"error: {final / name} not found — run the dataset pipeline first",
                  file=sys.stderr)
            return 2

    depots = _read(final / "depots.csv")
    routes = _read(final / "routes.csv")
    mappings = _read(final / "route_depot_mapping.csv")
    aliases = [] if args.skip_aliases else _read(final / "route_aliases.csv")

    started = _now()
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("""CREATE TEMP TABLE stg_depots (
                         external_id text PRIMARY KEY, name text, district text,
                         phone text, address text, email text, zone text, pincode text)
                       ON COMMIT DROP""")
        cur.execute("""CREATE TEMP TABLE stg_routes (
                         external_id text PRIMARY KEY, name text, origin text,
                         destination text, service_type text)
                       ON COMMIT DROP""")
        cur.execute("""CREATE TEMP TABLE stg_mappings (
                         route_ext text, depot_ext text,
                         mapping_status text, review_required boolean)""")
        cur.execute("""CREATE TEMP TABLE stg_aliases (
                         alias_ext text PRIMARY KEY, route_ext text,
                         alias text, match_key text)""")

        _stage_depots(cur, depots)
        _stage_routes(cur, routes)
        n_staged_maps, skipped = _stage_mappings(cur, mappings)
        _stage_aliases(cur, aliases)

        cur.execute("""INSERT INTO depots
                         (name, district, phone, address, email, zone, pincode, external_id)
                       SELECT name, district, phone, address, email, zone, pincode, external_id
                       FROM stg_depots
                       ON CONFLICT (external_id) DO UPDATE SET
                         name = EXCLUDED.name, district = EXCLUDED.district,
                         phone = EXCLUDED.phone, address = EXCLUDED.address,
                         email = EXCLUDED.email, zone = EXCLUDED.zone,
                         pincode = EXCLUDED.pincode""")
        cur.execute("""INSERT INTO routes (name, origin, destination, service_type, external_id)
                       SELECT name, origin, destination, service_type, external_id
                       FROM stg_routes
                       ON CONFLICT (external_id) DO UPDATE SET
                         name = EXCLUDED.name, origin = EXCLUDED.origin,
                         destination = EXCLUDED.destination,
                         service_type = EXCLUDED.service_type""")
        cur.execute("""INSERT INTO route_depot_mapping
                         (route_id, depot_id, mapping_status, review_required)
                       SELECT ru.id, de.id, s.mapping_status, s.review_required
                       FROM stg_mappings s
                       JOIN routes ru ON ru.external_id = s.route_ext
                       JOIN depots de ON de.external_id = s.depot_ext
                       ON CONFLICT (route_id, depot_id) DO UPDATE SET
                         mapping_status = EXCLUDED.mapping_status,
                         review_required = EXCLUDED.review_required""")
        cur.execute("""INSERT INTO route_aliases
                         (alias, match_key, route_id, source, external_id)
                       SELECT s.alias, s.match_key, ru.id, 'DATASET_IMPORT', s.alias_ext
                       FROM stg_aliases s JOIN routes ru ON ru.external_id = s.route_ext
                       ON CONFLICT (external_id) DO UPDATE SET
                         alias = EXCLUDED.alias, match_key = EXCLUDED.match_key""")

        cur.execute(
            """INSERT INTO import_runs (dataset_dir, started_at, finished_at,
                                        depots, routes, mappings,
                                        mappings_skipped_unknown, aliases)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (str(final), started, _now(), len(depots), len(routes),
             n_staged_maps, skipped, len(aliases)),
        )

    print(f"depots: {len(depots)}")
    print(f"routes: {len(routes)}")
    print(f"mappings imported: {n_staged_maps} (skipped {skipped} UNKNOWN/no-depot rows)")
    print(f"aliases staged: {len(aliases)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
