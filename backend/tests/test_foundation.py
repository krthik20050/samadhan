import re

import pytest

from app.schemas.complaint import ComplaintCreate
from app.services.reference import generate_reference_id


def test_complaint_requires_route():
    with pytest.raises(ValueError):
        ComplaintCreate(category="other", description="long enough text here")


def test_complaint_description_min_length():
    with pytest.raises(Exception):
        ComplaintCreate(category="other", route_text="Adoor - Ernakulam", description="short")


def test_complaint_rejects_blank_route_text():
    with pytest.raises(ValueError):
        ComplaintCreate(category="other", route_text="   ", description="long enough text here")


def test_reference_id_shape():
    with pytest.raises(ValueError):
        ComplaintCreate(category="other", route_text="   ", description="long enough text here")
    assert re.fullmatch(r"KSRTC-\d{4}-[A-Z0-9]{6}", generate_reference_id())
