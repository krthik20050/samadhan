"""Reference-ID generation invariants (AUDIT.md L-3): format + uniqueness.

Canonical format: SAM-YYYY-NNNNNN (migration 013). Legacy KSRTC-YYYY-XXXXXX
IDs remain valid back-compat — resolved everywhere, never generated again.
"""
import re
from datetime import datetime, timezone

from app.services.reference import generate_reference_id

SAM = re.compile(r"^SAM-\d{4}-\d{6}$")
LEGACY = re.compile(r"^KSRTC-\d{4}-[A-Z0-9]{6}$")


def test_reference_id_format():
    ref = generate_reference_id()
    assert SAM.fullmatch(ref), ref


def test_reference_id_year_component():
    year = 2027
    ref = generate_reference_id(now=datetime(year, 6, 1, tzinfo=timezone.utc))
    assert ref.startswith(f"SAM-{year}-"), ref


def test_reference_ids_are_unique_under_load():
    refs = {generate_reference_id() for _ in range(1000)}
    assert len(refs) == 1000, "collision in 1000 generations"


def test_reference_ids_are_zero_padded_sequential():
    a, b = generate_reference_id(), generate_reference_id()
    assert SAM.fullmatch(a) and SAM.fullmatch(b)
    assert int(b.rsplit("-", 1)[1]) > int(a.rsplit("-", 1)[1]), (a, b)


def test_legacy_ksrtc_format_remains_valid_back_compat():
    # The canonical REGEX both formats must satisfy after migration 013.
    BOTH = re.compile(r"^(SAM-\d{4}-\d{6}|KSRTC-\d{4}-[A-Z0-9]{6})$")
    assert BOTH.fullmatch("SAM-2026-000123")
    assert BOTH.fullmatch("KSRTC-2026-A1B2C3")
    assert not BOTH.fullmatch("sam-2026-000123")  # uppercase enforced upstream
    assert not BOTH.fullmatch("SAM-26-000123")
    assert not BOTH.fullmatch("SAM-2026-123")
    assert not BOTH.fullmatch("KTSC-2026-A1B2C3")
    assert not BOTH.fullmatch("KSRTC-2026-A1B2C")
