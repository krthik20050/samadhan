"""Reference-ID generation invariants (AUDIT.md L-3): format + uniqueness."""
import re
from datetime import datetime, timezone

from app.services.reference import generate_reference_id

REF = re.compile(r"^KSRTC-\d{4}-[A-Z0-9]{6}$")


def test_reference_id_format():
    ref = generate_reference_id()
    assert REF.fullmatch(ref), ref


def test_reference_id_year_component():
    year = 2027
    ref = generate_reference_id(now=datetime(year, 6, 1, tzinfo=timezone.utc))
    assert ref.startswith(f"KSRTC-{year}-")


def test_reference_ids_are_unique_under_load():
    refs = {generate_reference_id() for _ in range(1000)}
    assert len(refs) == 1000, "collision in 1000 generations"


def test_reference_id_alphabet_is_unambiguous():
    # Alphabet is uppercase A-Z + digits 0-9 (no lowercase, no lookalike strip
    # needed at 36^6 ≈ 2.2B space with DB-enforced uniqueness + retry).
    ref = generate_reference_id()
    suffix = ref.rsplit("-", 1)[1]
    assert all(c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" for c in suffix)
