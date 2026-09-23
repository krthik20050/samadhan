"""v1 lookup endpoints (routes/depots) — TODO, backed by real KSRTC import."""
from fastapi import APIRouter

router = APIRouter()
TODO = {"detail": "Not implemented yet (needs KSRTC seed import, see database/seeds/README.md)"}


@router.get("/routes", status_code=501)
def list_routes():
    return TODO


@router.get("/depots", status_code=501)
def list_depots():
    return TODO
