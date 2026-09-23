from fastapi import APIRouter

from . import auth, complaints, dashboard, lookups, telegram, voice, whatsapp

router = APIRouter(prefix="/api/v1")
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(telegram.router, prefix="/telegram", tags=["telegram"])
router.include_router(whatsapp.router, prefix="/whatsapp", tags=["whatsapp"])
router.include_router(voice.router, prefix="/voice", tags=["voice"])
router.include_router(complaints.router, prefix="/complaints", tags=["complaints"])
router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
router.include_router(lookups.router, prefix="", tags=["lookups"])
