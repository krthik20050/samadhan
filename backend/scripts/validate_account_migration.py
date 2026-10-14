"""Validate new identity/dashboard contracts in a transaction that always rolls back."""
from pathlib import Path
import uuid
import psycopg2
from check_account_identity import settings

root = Path(__file__).resolve().parents[2]
sql = (root / 'database/migrations/014_clerk_dashboard.sql').read_text(encoding='utf-8')
sql = sql.replace('BEGIN;', '', 1).rsplit('COMMIT;', 1)[0]
connection = psycopg2.connect(settings()['DATABASE_URL'], connect_timeout=8)
try:
    with connection.cursor() as cursor:
        cursor.execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='20s'")
        cursor.execute(sql)
        identity = 'user_QA' + uuid.uuid4().hex
        cursor.execute('SELECT app_ensure_clerk_user(%s,NULL,NULL,%s)',(identity,'Synthetic rollback QA'))
        account = cursor.fetchone()[0]['id']
        cursor.execute('SELECT app_ensure_clerk_user(%s,NULL,NULL,%s)',(identity,'Synthetic rollback QA'))
        assert cursor.fetchone()[0]['id'] == account, 'Identity mapping must be idempotent'
        cursor.execute('SELECT app_ensure_clerk_user(%s,NULL,NULL,%s)',('user_QA'+uuid.uuid4().hex,'Other synthetic QA'))
        other = cursor.fetchone()[0]['id']
        for owner,status in [(account,'submitted'),(account,'resolved'),(account,'closed'),(other,'escalated')]:
            cursor.execute("INSERT INTO complaints(reference_id,user_id,route_text,description,category,status) VALUES(app_reference_id(),%s,'Synthetic rollback route','Synthetic rollback complaint description','cleanliness',%s) RETURNING id",(owner,status))
            complaint = cursor.fetchone()[0]
            cursor.execute('INSERT INTO status_history(complaint_id,to_status,note) VALUES(%s,%s,%s)',(complaint,status,'Synthetic test action'))
        cursor.execute('SELECT app_passenger_dashboard(%s,50,0)',(account,))
        dashboard = cursor.fetchone()[0]
        assert dashboard['stats']['total_filed'] == 3
        assert dashboard['stats']['resolved'] == 1, 'Closed is not resolved'
        assert dashboard['stats']['closed'] == 1
        assert dashboard['stats']['open'] == 1
        assert len(dashboard['recent_complaints']) == 3, 'Other accounts must remain private'
        assert len(dashboard['monthly_activity']) == 6
        assert all(item['reference_id'] in {c['reference_id'] for c in dashboard['recent_complaints']} for item in dashboard['activity'])
        cursor.execute('SELECT app_passenger_dashboard(%s,1,1)',(account,))
        paginated = cursor.fetchone()[0]
        assert len(paginated['recent_complaints']) == 1 and paginated['has_more']
        cursor.execute('SELECT app_passenger_dashboard(%s,50,0,%s)',(account,'resolved'))
        filtered = cursor.fetchone()[0]
        assert filtered['filtered_total'] == 1 and filtered['recent_complaints'][0]['status'] == 'resolved'
        cursor.execute("SELECT has_function_privilege('anon','app_passenger_dashboard(uuid,integer,integer,text)','EXECUTE')")
        assert cursor.fetchone()[0] is False, 'Anonymous users must not call the private dashboard RPC'
        print('PASS: Clerk identity mapping, idempotency, account isolation, outcome counts, activity, and pagination')
finally:
    connection.rollback()
    connection.close()
    print('All synthetic data and test schema changes rolled back')
