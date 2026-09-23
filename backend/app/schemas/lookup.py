"""Lookup schemas for route/depot dropdowns (dataset-backed)."""
from __future__ import annotations

from pydantic import BaseModel


class RouteOption(BaseModel):
    id: str
    name: str
    origin: str
    destination: str
    service_type: str | None = None
    depot_name: str | None = None
    auto_routable: bool


class DepotOption(BaseModel):
    id: str
    name: str
    district: str | None = None
    phone: str | None = None
    email: str | None = None
    zone: str | None = None
    verified_routes: int


class RouteList(BaseModel):
    items: list[RouteOption]


class DepotList(BaseModel):
    items: list[DepotOption]
