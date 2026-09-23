"""Direct psycopg2 access (no ORM — see ADR-007)."""
import os
from contextlib import contextmanager
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor


def database_url() -> str:
    url = os.environ.get("DATABASE_URL", "")
    if url:
        return url
    try:
        from dotenv import dotenv_values

        env = dotenv_values(Path(__file__).resolve().parents[3] / ".env")
        return env.get("DATABASE_URL", "")
    except Exception:
        return ""


@contextmanager
def get_conn():
    url = database_url()
    if not url:
        raise RuntimeError("DATABASE_URL is not configured")
    conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
