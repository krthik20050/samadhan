"""Apply the reviewed additive Clerk/dashboard migration using existing configuration."""
from pathlib import Path
import psycopg2
from check_account_identity import settings

root = Path(__file__).resolve().parents[2]
with psycopg2.connect(settings()['DATABASE_URL'],connect_timeout=8) as connection:
    with connection.cursor() as cursor:
        cursor.execute("SET lock_timeout='5s'; SET statement_timeout='30s'")
        cursor.execute((root/'database/migrations/014_clerk_dashboard.sql').read_text(encoding='utf-8'))
print('Applied migration 014: Clerk string identities and private passenger dashboard')
