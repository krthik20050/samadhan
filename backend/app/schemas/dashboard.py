"""Dashboard schemas — anonymised allowlist (mirrors dashboard_complaints view)."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    complaints: int
    sla_breaches: int
    escalations: int
    needs_triage: int
    by_category: dict[str, int]
    by_status: dict[str, int]


class DashboardItem(BaseModel):
    reference_id: str
    category: str
    status: str
    priority: str
    depot: str | None = None
    sla_breached: bool
    created_at: datetime


class DashboardList(BaseModel):
    items: list[DashboardItem]
    total: int
    limit: int
    offset: int
