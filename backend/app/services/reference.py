"""Reference-ID generation (no DB needed). Format: SAM-YYYY-NNNNNN.

The AUTHORITATIVE generator is the Postgres function ``app_reference_id()``
(migration 013): a per-year counter table issues zero-padded 6-digit numbers
under a row lock, so concurrent filings are sequential and collision-free by
construction. This Python mirror exists for the local harness and tests; it
keeps an in-process monotonic counter for the same structural uniqueness.
Cross-process uniqueness is enforced by UNIQUE(reference_id) + the DB check.

Legacy KSRTC-YYYY-XXXXXX IDs (existing tickets) remain valid back-compat —
they are never generated again, only resolved.
"""
import threading
from datetime import datetime, timezone

_counter_lock = threading.Lock()
_counter = 0


def generate_reference_id(now: datetime | None = None) -> str:
    global _counter
    year = (now or datetime.now(timezone.utc)).year
    with _counter_lock:
        _counter += 1
        n = _counter
    return f"SAM-{year}-{n:06d}"
