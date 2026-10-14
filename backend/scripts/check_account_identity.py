"""Read-only schema probe; no credential or account bodies are printed."""
from pathlib import Path
import psycopg2

def settings():
    values = {}
    for line in (Path(__file__).resolve().parents[2] / '.env').read_text(encoding='utf-8-sig').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            name, value = line.split('=', 1)
            values[name.strip()] = value.strip().strip('"\'')
    return values

if __name__ == '__main__':
    cfg = settings()
    with psycopg2.connect(cfg['DATABASE_URL'], connect_timeout=8) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT data_type FROM information_schema.columns WHERE table_name='app_users' AND column_name='auth_user_id'")
            print('legacy auth identity column:', cursor.fetchone())
            try:
                cursor.execute("SELECT app_ensure_user(%s, NULL, NULL, NULL)", ('user_synthetic_identity_probe',))
            except psycopg2.Error as error:
                print('Clerk-format identity rejected, SQLSTATE:', error.pgcode)
                connection.rollback()
