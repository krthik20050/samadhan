"""App configuration. Only MVP vars are required; future keys default to None
so the app starts without Sarvam/WhatsApp/LLM credentials."""
from functools import lru_cache
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # No default: an unset DATABASE_URL must fail loudly at connect time,
    # never silently connect somewhere unexpected.
    DATABASE_URL: str = ""
    BACKEND_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:3000"

    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    # Server-only. NEVER prefix with NEXT_PUBLIC_, never ship to the frontend.
    SUPABASE_SERVICE_ROLE_KEY: SecretStr | None = None

    # Staff shared secret for operational endpoints (dashboard list, status
    # writes). Empty = those endpoints fail closed with 503, never open.
    ADMIN_API_TOKEN: str = ""

    # Future / optional — never required at startup.
    SARVAM_API_KEY: str | None = None
    LLM_API_KEY: str | None = None
    WHATSAPP_ACCESS_TOKEN: str | None = None
    WHATSAPP_PHONE_NUMBER_ID: str | None = None
    WHATSAPP_VERIFY_TOKEN: str | None = None
    TELEGRAM_BOT_TOKEN: str | None = None
    TELEGRAM_SECRET_TOKEN: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
