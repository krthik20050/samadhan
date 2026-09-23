"""Reference-ID generation (no DB needed). Format: KSRTC-YYYY-XXXXXX."""
import secrets
import string
from datetime import datetime, timezone

_ALPHABET = string.ascii_uppercase + string.digits


def generate_reference_id(now: datetime | None = None) -> str:
    year = (now or datetime.now(timezone.utc)).year
    rand = "".join(secrets.choice(_ALPHABET) for _ in range(6))
    return f"KSRTC-{year}-{rand}"
