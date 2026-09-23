// SAMADHAN API — Supabase Edge Function (replaces the FastAPI backend for
// hosted use; see supabase/README.md). One function routes every endpoint:
//
//   GET  /health
//   POST /api/v1/complaints                    file a complaint
//   GET  /api/v1/complaints/{reference_id}     track
//   GET  /api/v1/routes?q=&limit=              dataset lookups
//   GET  /api/v1/depots?q=&limit=
//   GET  /api/v1/dashboard/summary             anonymised totals
//   GET  /api/v1/dashboard/complaints          staff-only (Bearer token)
//   POST /api/v1/auth/login                    staff password check
//   POST /api/v1/telegram/webhook              Telegram bot
//
// All business logic lives in Postgres RPCs (database/migrations/005_supabase_rpcs.sql);
// this function validates, enforces auth, and maps errors. Response shapes
// mirror FastAPI 1:1 so the frontend contract does not change.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const HELP =
  'Send: CATEGORY | route | description (min 10 chars). ' +
  'Categories: cleanliness, unsafe_driving, overcrowding, missed_stop, ' +
  'concession_denied, ticketing, staff_behaviour, bus_condition, other.';

const CATEGORIES = [
  'cleanliness', 'unsafe_driving', 'overcrowding', 'missed_stop',
  'concession_denied', 'ticketing', 'staff_behaviour', 'bus_condition', 'other',
];

// ponytail: keyword guess, replace with LLM extraction (Phase 10) if it misfires.
const KEYWORDS: [string, string[]][] = [
  ['cleanliness', ['dirty', 'clean', 'garbage', 'smell']],
  ['unsafe_driving', ['rash', 'speed', 'unsafe', 'accident', 'brake']],
  ['overcrowding', ['crowd', 'full', 'overcrowd', 'standing']],
  ['missed_stop', ['miss', 'skip', 'stop']],
  ['concession_denied', ['concession', 'student', 'denied']],
  ['ticketing', ['ticket', 'fare', 'change']],
  ['staff_behaviour', ['rude', 'staff', 'driver', 'conductor', 'behav']],
  ['bus_condition', ['break', 'bus condition', 'seat', 'window', 'door']],
];

function guessCategory(text: string): string {
  const low = text.toLowerCase();
  for (const [cat, words] of KEYWORDS) {
    if (words.some((w) => low.includes(w))) return cat;
  }
  return 'other';
}

function adminToken(): string {
  return Deno.env.get('ADMIN_API_TOKEN') ?? '';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Demo-grade CORS: no cookies/credentials are used, so a wildcard is
      // safe; staff endpoints still require the Bearer token regardless.
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'authorization, content-type, x-telegram-bot-api-secret-token',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  });
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  const n = Math.max(ab.length, bb.length);
  let diff = a.length === 0 || b.length === 0 ? 1 : 0;
  for (let i = 0; i < n; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

function requireStaff(req: Request): Response | null {
  const expected = adminToken();
  if (!expected) return json({ detail: 'staff auth not configured' }, 503);
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ detail: 'staff auth required' }, 401);
  if (!constantTimeEqual(auth.slice(7), expected)) {
    return json({ detail: 'invalid staff credentials' }, 401);
  }
  return null;
}

function client() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

function mapDbError(e: { code?: string; message?: string } | null): Response {
  if (e && (e.code === '22023' || e.code === 'P0001')) {
    return json({ detail: e.message ?? 'validation failed' }, 422);
  }
  console.error('db error', e);
  return json({ detail: 'storage failure' }, 500);
}

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------
async function tgSend(chatId: number, text: string): Promise<unknown> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) return { skipped: 'no Telegram credentials' };
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!r.ok) {
    // ponytail: never leak the token (it sits in the URL) into logs.
    return { error: `telegram send failed (${r.status})` };
  }
  return r.json();
}

function extractTelegram(payload: Record<string, any>): [number | null, string | null] {
  try {
    const msg = payload.message ?? payload.edited_message;
    const chatId = msg?.chat?.id;
    const text = (msg?.text ?? '').trim() || null;
    if (chatId == null) return [null, null];
    return [Number(chatId), text];
  } catch {
    return [null, null];
  }
}

function parseComplaintText(text: string) {
  const parts = text.split('|').map((p) => p.trim());
  let category: string, routeText: string, description: string;
  if (parts.length === 3) {
    const raw = parts[0].toLowerCase().replace(/ /g, '_');
    category = CATEGORIES.includes(raw) ? raw : guessCategory(text);
    routeText = parts[1] || 'Telegram';
    description = parts[2];
  } else {
    category = guessCategory(text);
    routeText = 'Telegram';
    description = text;
  }
  if (description.length < 10) return null;
  return { category, routeText, description };
}

async function handleTelegram(req: Request): Promise<Response> {
  const expected = Deno.env.get('TELEGRAM_SECRET_TOKEN');
  if (expected) {
    const got = req.headers.get('x-telegram-bot-api-secret-token');
    if (got !== expected) return new Response('secret token mismatch', { status: 403 });
  }
  const payload = await req.json().catch(() => ({}) as Record<string, any>);
  const [chatId, text] = extractTelegram(payload);
  if (chatId == null || !text) return json({ status: 'ignored' });

  const low = text.trim().toLowerCase();
  if (low === '/start' || low === '/help') {
    return json({ status: 'ok', reply: HELP, send: await tgSend(chatId, HELP) });
  }
  if (low.startsWith('/track')) {
    const ref = text.slice(6).trim();
    if (!ref) {
      const reply = 'Send: /track KSRTC-XXXXXX';
      return json({ status: 'ok', reply, send: await tgSend(chatId, reply) });
    }
    const sb = client();
    const { data, error } = await sb.rpc('app_track_complaint', { p_ref: ref });
    const reply = error
      ? 'Tracking failed — try the web /track page.'
      : data
      ? `${ref.toUpperCase()}: ${data.status}.`
      : `Unknown ID ${ref.toUpperCase()} — check and retry.`;
    return json({ status: 'ok', reply, send: await tgSend(chatId, reply) });
  }

  const parsed = parseComplaintText(text);
  if (!parsed) {
    return json({ status: 'ok', reply: HELP, complaint: null, send: await tgSend(chatId, HELP) });
  }
  const sb = client();
  const { data, error } = await sb.rpc('app_file_complaint', {
    p_category: parsed.category,
    p_description: parsed.description,
    p_route_text: parsed.routeText,
    // ponytail: Telegram chat_id is not a phone; contact stays NULL (DB check).
  });
  if (error) {
    const reply = 'Sorry, filing failed — please use the web form at /complain.';
    return json({ status: 'ok', reply, send: await tgSend(chatId, reply) });
  }
  const reply =
    `Filed ${data.reference_id} (${data.status}` +
    `${data.depot ? ', depot: ' + data.depot : ''}). Track with /track <ID>.`;
  return json({
    status: 'ok',
    reply,
    reference_id: data.reference_id,
    send: await tgSend(chatId, reply),
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  const url = new URL(req.url);
  // Supabase's gateway strips /functions/v1 but KEEPS the function name:
  // '/api/health' arrives for <fn>/health, '/api/api/v1/...' for <fn>/api/v1/...
  // Strip exactly one leading 'api' segment (and tolerate the un-stripped
  // '/functions/v1/<fn>' form for portability).
  const path = url.pathname
    .replace(/^\/functions\/v1\/[^/]+/, '')
    .replace(/^\/api(?=\/|$)/, '')
    .replace(/\/+$/, '') || '/';
  const q = url.searchParams;

  try {
    // -- health ----------------------------------------------------------
    if (path === '/health' || path === '/api/v1/health') {
      return json({ status: 'ok', v: 2 });
    }

    // -- complaints ------------------------------------------------------
    if (path === '/api/v1/complaints' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const sb = client();
      const { data, error } = await sb.rpc('app_file_complaint', {
        p_category: body.category,
        p_description: body.description,
        p_route_id: body.route_id ?? null,
        p_route_text: body.route_text ?? null,
        p_bus_number: body.bus_number ?? null,
        p_location_text: body.location_text ?? null,
        p_contact_phone: body.contact_phone ?? null,
        p_priority: body.priority ?? 'normal',
      });
      if (error) return mapDbError(error);
      return json(data, 201);
    }

    const trackMatch = path.match(/^\/api\/v1\/complaints\/([^/]+)$/);
    if (trackMatch && req.method === 'GET') {
      const ref = decodeURIComponent(trackMatch[1]).trim().toUpperCase();
      const sb = client();
      const { data, error } = await sb.rpc('app_track_complaint', { p_ref: ref });
      if (error) return mapDbError(error);
      if (!data) return json({ detail: 'unknown reference ID' }, 404);
      return json(data);
    }

    // -- lookups ---------------------------------------------------------
    if (path === '/api/v1/routes' && req.method === 'GET') {
      const sb = client();
      const { data, error } = await sb.rpc('app_list_routes', {
        p_q: q.get('q') ?? '',
        p_limit: Number(q.get('limit') ?? 50),
      });
      if (error) return mapDbError(error);
      return json(data);
    }
    if (path === '/api/v1/depots' && req.method === 'GET') {
      const sb = client();
      const { data, error } = await sb.rpc('app_list_depots', {
        p_q: q.get('q') ?? '',
        p_limit: Number(q.get('limit') ?? 200),
      });
      if (error) return mapDbError(error);
      return json(data);
    }

    // -- dashboard -------------------------------------------------------
    if (path === '/api/v1/dashboard/summary' && req.method === 'GET') {
      const sb = client();
      const { data, error } = await sb.rpc('app_dashboard_summary');
      if (error) return mapDbError(error);
      return json(data);
    }
    if (path === '/api/v1/dashboard/complaints' && req.method === 'GET') {
      const denied = requireStaff(req);
      if (denied) return denied;
      const sb = client();
      const { data, error } = await sb.rpc('app_dashboard_complaints', {
        p_limit: Number(q.get('limit') ?? 20),
        p_offset: Number(q.get('offset') ?? 0),
        p_status: q.get('status') || null,
        p_category: q.get('category') || null,
      });
      if (error) return mapDbError(error);
      return json(data);
    }

    // -- staff auth ------------------------------------------------------
    if (path === '/api/v1/auth/login' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const expected = adminToken();
      if (!expected) return json({ detail: 'staff auth not configured' }, 503);
      if (constantTimeEqual(String(body.password ?? ''), expected)) {
        return json({ role: 'admin' });
      }
      return json({ detail: 'invalid staff credentials' }, 401);
    }

    // -- telegram --------------------------------------------------------
    if (path === '/api/v1/telegram/webhook' && req.method === 'POST') {
      return await handleTelegram(req);
    }

    return json({ detail: 'Not Found' }, 404);
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : 'internal error';
    if (msg.includes('not configured')) return json({ detail: msg }, 500);
    return json({ detail: 'storage failure' }, 500);
  }
});
