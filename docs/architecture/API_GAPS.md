# API Gaps — Register of Incomplete or Unreliable Endpoints

Status after the 2026-09-25 production-hardening pass. "Fixed" items were
implemented and verified in this pass; "Open" items are tracked with owners.

| Endpoint | Current behavior | Expected behavior | Problem | Consumers | DB deps | Required fix | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| `GET /api/v1/my/complaints`, `GET /api/v1/my/trips` (Edge) | chat_id from query; **no caller check** (IDOR) | Only the chat owner may read | Anyone could enumerate chat IDs | MyAccount panel | `app_my_complaints/trips` | Clerk-session binding + `p_owner_chat_id` guard in RPC | negative test (wrong chat → 403) at Edge layer once deployable; RPC guard deployed | **Fixed** (deploy pending) |
| `POST /api/v1/complaints` (Edge + FastAPI) | duplicate submissions create duplicates | Same idempotency key → same complaint | Double-click/retry duplicated tickets | Web form | `app_file_complaint` v6 | `p_idempotency_key` + unique partial index + replay path | `test_e2e_journey.py::test_full_website_journey_*` | **Fixed** |
| `POST /api/v1/whatsapp/webhook` (FastAPI) | no signature check | HMAC-verified only | Forged messages could file/spend | Meta Cloud API | — | `X-Hub-Signature-256` verify, fail closed when secret set | `test_whatsapp_security.py` (5 tests) | **Fixed** |
| Telegram file intake (Edge) | downloaded any size the bot served | size-checked before download | memory/cost exposure | Bot users | — | `getFile.file_size` pre-check + post-download re-check (≤20 MB) | code-review + manual; unit-testable via extract | **Fixed** (deploy pending) |
| All Edge responses | CORS `*` | pinned origins | any site could call API | Web | — | `SITE_URL`/`FRONTEND_URL` allow-list with safe fallback | manual preflight check after deploy | **Fixed** (deploy pending) |
| All Edge responses | no correlation id | `X-Request-Id` echoed + logged | hard to trace incidents | ops | — | mint/honour request id; error logs structured JSON | n/a (observability) | **Fixed** (deploy pending) |
| `POST /api/v1/complaints`, `/uploads`, `/auth/login`, `/voice/transcribe` (Edge) | no rate limit | per-IP throttle | abuse cost | all | — | Open: token bucket in Edge (Deno KV) or WAF-level | load test | **Open** (M-4) |
| `POST /api/v1/auth/login` (Edge) | shared password, no throttle | throttled attempts + rotation path | brute force on one secret | staff | — | Open: attempt limiter; recommend SSO for staff later | — | **Open** |
| Status writes (dashboard UI) | client throws "not available from backend" | staff status updates persist | `updateStatus` is a stub in `complaintsService` | admin console | `app_*` status RPC absent | Open: implement `app_set_status` RPC (transition-checked) + endpoint + UI wiring | transition tests | **Open** |
| `GET /api/v1/complaints/{ref}` | public by reference ID | same, documented | capability-model ambiguity (unguessable ID = bearer) | track page, bot | `app_track_complaint` | none (documented decision) | allowlist assertions in E2E test | **Documented** |
| `POST /api/v1/extract/ticket` (Edge) | fail-soft 503 when ML slot missing | same | none | web form, bot | — | none | — | **Healthy** |
| `POST /api/v1/voice/transcribe` (Edge) | 8 MB cap, slot-gated | same | none | web voice | — | none | — | **Healthy** |
| `GET /api/v1/routes`, `/depots` | bounded lookups | same | none | web form, bot | `app_list_*` | none | — | **Healthy** |

## Deploy-order notes (Edge Function changes)

The function must be redeployed (`npx supabase functions deploy api
--project-ref ikipstqlumypppfypdrx`) for the Edge-side fixes above to go live.
Migration 011 is intentionally backward-compatible: the old 2-argument chat
RPCs still exist (defaults fill the new parameter), so the deployed function
keeps working before redeploy; the ownership guard activates only when the new
function passes `p_owner_chat_id`. Set `SITE_URL` as a function secret at
deploy time to pin CORS.
