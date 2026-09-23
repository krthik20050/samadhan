"""Complaint schemas — mirrors docs/API.md. DB models land in Phase 1."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class Category(str, Enum):
    cleanliness = "cleanliness"
    unsafe_driving = "unsafe_driving"
    overcrowding = "overcrowding"
    missed_stop = "missed_stop"
    concession_denied = "concession_denied"
    ticketing = "ticketing"
    staff_behaviour = "staff_behaviour"
    bus_condition = "bus_condition"
    other = "other"


class Priority(str, Enum):
    low = "low"
    normal = "normal"
    high = "high"
    critical = "critical"


class ComplaintCreate(BaseModel):
    bus_number: str | None = None
    route_id: UUID | None = None
    route_text: str | None = None
    category: Category
    priority: Priority = Priority.normal
    location_text: str | None = None
    description: str = Field(min_length=10)
    contact_phone: str | None = None

    def model_post_init(self, _ctx) -> None:
        if self.route_id is None and not (self.route_text or "").strip():
            raise ValueError("either route_id or route_text is required")


class ComplaintOut(BaseModel):
    reference_id: str
    status: str
    depot: str | None = None
    sla_due_at: datetime | None = None


class HistoryItem(BaseModel):
    from_status: str | None
    to_status: str
    changed_by: str | None = None
    created_at: datetime


class ComplaintTrack(BaseModel):
    """Public tracking view — allowlist only, never phone/location/description."""

    reference_id: str
    bus_number: str | None = None
    route_text: str | None = None
    category: str
    priority: str
    status: str
    depot: str | None = None
    sla_due_at: datetime | None = None
    sla_breached: bool
    created_at: datetime
    history: list[HistoryItem] = []
