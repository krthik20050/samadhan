// SAMADHAN API — Supabase Edge Function (hosted backend; see supabase/README.md).
//
// Endpoints:
//   GET  /health
//   POST /api/v1/complaints                    file a complaint (+ticket fields, evidence[])
//   POST /api/v1/uploads                       multipart file -> evidence bucket (web form)
//   GET  /api/v1/complaints/{reference_id}     track
//   GET  /api/v1/routes?q=&limit=              dataset lookups
//   GET  /api/v1/depots?q=&limit=
//   GET  /api/v1/dashboard/summary             anonymised totals
//   GET  /api/v1/dashboard/complaints          staff-only (Bearer token)
//   POST /api/v1/auth/login                    staff password check
//   POST /api/v1/extract/ticket                image -> structured ticket JSON (Groq vision)
//   POST /api/v1/voice/status                  Sarvam STT configured?
//   POST /api/v1/voice/transcribe              audio -> transcript (Sarvam)
//   POST /api/v1/telegram/webhook              Telegram bot (ticket-first flow)
//
// API SLOTS (set as function secrets — everything works once keys exist):
//   GROQ_API_KEY   — ticket photo -> structured JSON (vision LLM). GROQ_MODEL optional.
//   SARVAM_API_KEY — voice notes -> text (STT). Also used by /api/v1/voice/*.
//   TELEGRAM_BOT_TOKEN / TELEGRAM_SECRET_TOKEN / ADMIN_API_TOKEN — as before.
//   Every slot is optional at runtime: features degrade gracefully, nothing 500s.
//
// Live sync: every write (Telegram or web) lands in the same Postgres tables the
// website and admin panel read, so submissions appear on the next poll.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const HELP =
  '🚌 SAMADHAN — file a KSRTC complaint in under a minute.\n\n' +
  'Send /complain: upload your ticket photo and I read the bus number, route ' +
  'and date from it automatically. Track with /track KSRTC-XXXXXX, your ' +
  'complaints with /my. /cancel stops the current flow.';

const CATEGORIES: [string, string][] = [
  ['cleanliness', '🧹 Cleanliness'],
  ['unsafe_driving', '⚠️ Unsafe driving'],
  ['overcrowding', '👥 Overcrowding'],
  ['missed_stop', '🛑 Missed stop'],
  ['concession_denied', '🎟️ Concession denied'],
  ['ticketing', '🎫 Ticketing'],
  ['staff_behaviour', '🗣️ Staff behaviour'],
  ['bus_condition', '🚌 Bus condition'],
  ['other', '📝 Other'],
];
const CATEGORY_LABELS = new Map(CATEGORIES);

// ponytail: keyword guess for bare text — replace with LLM extraction (Phase 10) if it misfires.
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
// Telegram Bot API adapter (token never appears in errors/logs)
// ---------------------------------------------------------------------------
async function tgCall(method: string, body: Record<string, unknown>): Promise<unknown> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) return { skipped: 'no Telegram credentials' };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return { error: `telegram ${method} failed (${r.status})` };
    return r.json();
  } catch {
    return { error: `telegram ${method} unreachable` };
  }
}

const tgSend = (chatId: number, text: string, replyMarkup?: unknown) =>
  tgCall('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup,
    disable_web_page_preview: true,
  });

const tgAnswer = (cbId: string, text?: string) =>
  tgCall('answerCallbackQuery', { callback_query_id: cbId, text });

async function tgConfigureBot(): Promise<void> {
  await tgCall('setMyCommands', {
    commands: [
      { command: 'complain', description: 'File a complaint (upload your ticket)' },
      { command: 'link', description: 'Link your account to save trips & get callbacks' },
      { command: 'my', description: 'My complaints' },
      { command: 'track', description: 'Track a complaint (e.g. /track KSRTC-2026-ABC123)' },
      { command: 'help', description: 'How to use SAMADHAN' },
      { command: 'cancel', description: 'Cancel the current flow' },
    ],
  });
}

/** Download a Telegram file's bytes (20 MB bot cap; verified before call). */
async function tgDownloadFile(fileId: string): Promise<{ bytes: Uint8Array; mime: string } | { error: string }> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) return { error: 'no Telegram credentials' };
  const meta = await tgCall('getFile', { file_id: fileId });
  const filePath = (meta as { result?: { file_path?: string } })?.result?.file_path;
  if (!filePath) return { error: 'getFile failed' };
  const r = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!r.ok) return { error: `download failed (${r.status})` };
  const bytes = new Uint8Array(await r.arrayBuffer());
  const mime = r.headers.get('content-type') ?? 'application/octet-stream';
  return { bytes, mime };
}

// ---------------------------------------------------------------------------
// ML slots: Groq vision (ticket extraction) + Sarvam (voice STT)
// ---------------------------------------------------------------------------
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// ponytail: Groq retired the llama-4 vision models on this account;
// qwen3.8-27b accepts image_url parts and is the verified vision model.
const GROQ_MODEL_DEFAULT = 'qwen/qwen3.8-27b';

function groqModel(): string {
  return Deno.env.get('GROQ_MODEL') ?? GROQ_MODEL_DEFAULT;
}

type TicketExtract = {
  bus_number: string | null;
  origin: string | null;
  destination: string | null;
  travel_date: string | null; // YYYY-MM-DD
  travel_time: string | null; // HH:MM
  ticket_no: string | null;
  pnr: string | null;
  depot: string | null;
  service_type: string | null;
  trip_code: string | null;
  depot_phone: string | null;
  landmark: string | null;
  has_qr: boolean | null;
};

/** Ticket photo -> structured JSON via Groq vision. Slot: GROQ_API_KEY. */
async function extractTicketWithGroq(
  bytes: Uint8Array,
  mime: string,
): Promise<{ ok: true; data: TicketExtract } | { ok: false; reason: string }> {
  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) return { ok: false, reason: 'GROQ_API_KEY not set — paste it as a function secret' };
  const b64 = btoa(String.fromCharCode(...bytes));
  const prompt =
    'Read this KSRTC bus ticket image. Return ONLY a JSON object with keys ' +
    'bus_number (vehicle registration like KL-01-AB-1234 or the fleet plate e.g. PL-123, null if absent), ' +
    'origin, destination, travel_date (normalize to YYYY-MM-DD), travel_time (HH:MM, null if absent), ' +
    'ticket_no, pnr (PNR/booking reference, null if absent), depot, service_type ' +
    '(SUPER FAST / EXPRESS / FAST PASSENGER / etc, null if absent), trip_code (service/trip code, null if absent), ' +
    'depot_phone (printed depot contact number, null if absent), landmark (printed boarding landmark, null if absent), ' +
    'has_qr (true if a QR code is printed, else false). ' +
    'Take every value from the image verbatim; use null only when genuinely absent. JSON only, no commentary.';
  try {
    const r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: groqModel(),
        temperature: 0,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
            ],
          },
        ],
      }),
    });
    if (!r.ok) return { ok: false, reason: `groq ${r.status}` };
    const body = await r.json();
    let raw = String(body?.choices?.[0]?.message?.content ?? '{}').trim();
    // qwen sometimes wraps JSON in markdown fences — strip them defensively.
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(raw) as Partial<TicketExtract>;
    const s = (v: unknown) => (typeof v === 'string' && v.trim() && v !== 'null' ? v.trim() : null);
    // Normalize DD-MM-YYYY / DD.MM.YYYY to ISO for the DB; leave others verbatim
    // (the filing RPC null-checks anything that is not YYYY-MM-DD).
    const iso = (v: string | null): string | null => {
      if (!v) return null;
      const m = v.match(/^(\d{1,2})[.-](\d{1,2})[.-](\d{4})$/);
      if (m) {
        const [, d, mo, y] = m;
        return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    };
    return {
      ok: true,
      data: {
        bus_number: s(parsed.bus_number),
        origin: s(parsed.origin),
        destination: s(parsed.destination),
        travel_date: iso(s(parsed.travel_date)),
        travel_time: s(parsed.travel_time),
        ticket_no: s(parsed.ticket_no),
        pnr: s(parsed.pnr),
        depot: s(parsed.depot),
        service_type: s(parsed.service_type),
        trip_code: s(parsed.trip_code),
        depot_phone: s(parsed.depot_phone),
        landmark: s(parsed.landmark),
        has_qr: typeof parsed.has_qr === 'boolean' ? parsed.has_qr : null,
      },
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'groq failed' };
  }
}

/** Voice note -> transcript via Sarvam STT. Slot: SARVAM_API_KEY. */
async function transcribeVoice(bytes: Uint8Array, mime: string): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  const key = Deno.env.get('SARVAM_API_KEY');
  if (!key) return { ok: false, reason: 'SARVAM_API_KEY not set' };
  try {
    const form = new FormData();
    form.append('file', new File([bytes], 'voice.ogg', { type: mime || 'audio/ogg' }));
    form.append('model', 'saaras:v3');
    form.append('mode', 'transcribe');
    const r = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: { 'api-subscription-key': key },
      body: form,
    });
    if (!r.ok) return { ok: false, reason: `sarvam ${r.status}` };
    const body = await r.json();
    const text = String(body.transcript ?? '').trim();
    return text ? { ok: true, text } : { ok: false, reason: 'empty transcript' };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'sarvam failed' };
  }
}

// ---------------------------------------------------------------------------
// Keyboards
// ---------------------------------------------------------------------------
type Kb = { inline_keyboard: { text: string; callback_data: string }[][] };

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const menuKb: Kb = {
  inline_keyboard: [
    [{ text: '🚨 File a complaint', callback_data: 'flow:start' }],
    [{ text: '📋 My complaints', callback_data: 'my' }],
    [{ text: '🔗 Link account', callback_data: 'link' }, { text: '❓ Help', callback_data: 'help' }],
  ],
};

const linkKb = {
  keyboard: [[{ text: '📱 Share my number', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

const categoryKb: Kb = {
  inline_keyboard: [
    ...chunk(CATEGORIES, 2).map((row) =>
      row.map(([value, label]) => ({ text: label, callback_data: `cat:${value}` }))
    ),
    [{ text: '❌ Cancel', callback_data: 'cancel' }],
  ],
};

const cancelKb: Kb = {
  inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cancel' }]],
};

const ticketKb: Kb = {
  inline_keyboard: [
    [{ text: '⏭️ Skip — no ticket photo', callback_data: 'skip_ticket' }],
    [{ text: '❌ Cancel', callback_data: 'cancel' }],
  ],
};

function ticketReviewKb(): Kb {
  return {
    inline_keyboard: [
      [{ text: '✅ Details look right', callback_data: 'ticket_ok' }],
      [{ text: '⏭️ Ignore & continue manually', callback_data: 'ticket_fix' }],
      [{ text: '❌ Cancel', callback_data: 'cancel' }],
    ],
  };
}

function routeKb(hits: { id: string; name: string }[], raw: string): Kb {
  const rows = hits.slice(0, 5).map((h) => ({
    text: `🚌 ${h.name}`,
    callback_data: `route:${h.id}:${h.name.slice(0, 40)}`,
  }));
  return {
    inline_keyboard: [
      ...(rows.length ? chunk(rows, 1) : []),
      [{ text: `✅ Use my text: "${raw.slice(0, 24)}"`, callback_data: 'route:raw' }],
      [{ text: '⏭️ Skip (file without route)', callback_data: 'route:skip' }],
      [{ text: '❌ Cancel', callback_data: 'cancel' }],
    ],
  };
}

const proofKb: Kb = {
  inline_keyboard: [
    [{ text: '➡️ Done — continue', callback_data: 'proof:done' }],
    [{ text: '❌ Cancel', callback_data: 'cancel' }],
  ],
};

const confirmKb: Kb = {
  inline_keyboard: [
    [{ text: '✅ Submit complaint', callback_data: 'submit' }],
    [{ text: '✏️ Edit details', callback_data: 'edit' }],
    [{ text: '❌ Cancel', callback_data: 'cancel' }],
  ],
};

const editMenuKb: Kb = {
  inline_keyboard: [
    [{ text: 'Category', callback_data: 'edit:cat' }, { text: 'Route', callback_data: 'edit:route' }],
    [{ text: 'Bus number', callback_data: 'edit:bus' }, { text: 'Description', callback_data: 'edit:desc' }],
    [{ text: '⬅️ Back to report', callback_data: 'back' }],
  ],
};

// ---------------------------------------------------------------------------
// Conversation helpers (state lives in Postgres — functions stay stateless)
// ---------------------------------------------------------------------------
type Conv = { state: string; data: Record<string, unknown> };

async function convGet(sb: ReturnType<typeof client>, chatId: number): Promise<Conv> {
  const { data } = await sb.rpc('tg_conv_get', { p_chat_id: chatId });
  const row = Array.isArray(data) ? data[0] : data;
  return { state: row?.state ?? 'idle', data: row?.data ?? {} };
}

const convSave = (sb: ReturnType<typeof client>, chatId: number, state: string, d: Record<string, unknown>) =>
  sb.rpc('tg_conv_save', { p_chat_id: chatId, p_state: state, p_data: d });

const convClear = (sb: ReturnType<typeof client>, chatId: number) =>
  sb.rpc('tg_conv_clear', { p_chat_id: chatId });

const convClaim = (sb: ReturnType<typeof client>, chatId: number, from: string, to: string, d: Record<string, unknown>) =>
  sb.rpc('tg_conv_claim', { p_chat_id: chatId, p_from: from, p_to: to, p_data: d })
    .then((r: { data: unknown }) => Array.isArray(r.data) ? r.data[0] : r.data === true);

type EvidenceItem = { file_id: string; mime: string; size: number; path: string };

type Passenger = { chat_id: number; phone: string; name: string | null };

async function passengerGet(sb: ReturnType<typeof client>, chatId: number): Promise<Passenger | null> {
  const { data } = await sb.rpc('tg_passenger_get', { p_chat_id: chatId });
  const row = Array.isArray(data) ? data[0] : data;
  return row && row.phone ? (row as Passenger) : null;
}

/** Saved trips for a chat (most-used first). */
async function tripsList(sb: ReturnType<typeof client>, chatId: number): Promise<
  { route_id: string | null; route_label: string; bus_number: string | null; use_count: number }[]
> {
  const { data } = await sb.rpc('tg_trip_list', { p_chat_id: chatId, p_limit: 5 });
  return ((Array.isArray(data) ? data[0] : data) ?? []) as [];
}

function tripsKb(items: { route_label: string; bus_number: string | null }[]): Kb {
  return {
    inline_keyboard: [
      ...items.slice(0, 5).map((t, i) => [{
        text: `🚌 ${t.route_label}${t.bus_number ? ` · ${t.bus_number}` : ''} (${t.use_count}×)`,
        callback_data: `trip:${i}`,
      }]),
      [{ text: '🆕 Different trip', callback_data: 'flow:newtrip' }],
      [{ text: '❌ Cancel', callback_data: 'cancel' }],
    ],
  };
}

function evidenceOf(d: Record<string, unknown>): EvidenceItem[] {
  return Array.isArray(d.evidence) ? (d.evidence as EvidenceItem[]) : [];
}

// ---------------------------------------------------------------------------
// Flow steps
// ---------------------------------------------------------------------------
/** Entry point for 'File a complaint': returning passengers get their trips
 *  first (two taps to file); everyone else starts with the ticket photo. */
async function startComplaint(sb: ReturnType<typeof client>, chatId: number) {
  const passenger = await passengerGet(sb, chatId);
  if (passenger) {
    const trips = await tripsList(sb, chatId);
    if (trips.length) {
      await convSave(sb, chatId, 'idle', {});
      await tgSend(
        chatId,
        `Welcome back${passenger.name ? `, ${passenger.name}` : ''}! Which trip had the issue?`,
        tripsKb(trips),
      );
      return;
    }
  }
  await askTicket(sb, chatId, {});
}
function fmtRoute(d: Record<string, unknown>): string {
  if (typeof d.route_name === 'string' && d.route_name) return d.route_name;
  if (typeof d.route_text === 'string' && d.route_text) return d.route_text;
  return '(no route)';
}

function reportText(d: Record<string, unknown>): string {
  const cat = typeof d.category === 'string' ? CATEGORY_LABELS.get(d.category) ?? d.category : '—';
  const bus = typeof d.bus_number === 'string' && d.bus_number ? d.bus_number : '—';
  const date = typeof d.travel_date === 'string' && d.travel_date ? d.travel_date : '—';
  const n = evidenceOf(d).length;
  const desc = typeof d.description === 'string' ? d.description : '';
  return (
    '🧾 FINAL REPORT — please review:\n\n' +
    `• Category: ${cat}\n` +
    `• Route: ${fmtRoute(d)}\n` +
    `• Bus number: ${bus}\n` +
    `• Travel date: ${date}\n` +
    `• Problem: ${desc}\n` +
    `• Proof attached: ${n} file${n === 1 ? '' : 's'}\n\n` +
    'Tap Submit to file it (it appears on the website instantly), Edit to change, or Cancel.'
  );
}

async function askTicket(sb: ReturnType<typeof client>, chatId: number, d: Record<string, unknown> = {}) {
  await convSave(sb, chatId, 'ask_ticket', d);
  await tgSend(
    chatId,
    '📸 Send a photo of your ticket.\n\n' +
      'I will read the bus number, route and date from it automatically ' +
      '— it also serves as proof that you travelled. No ticket handy? Skip.',
    ticketKb,
  );
}

async function askCategory(sb: ReturnType<typeof client>, chatId: number, d: Record<string, unknown>) {
  await convSave(sb, chatId, 'ask_category', d);
  await tgSend(chatId, 'What is the complaint about?', categoryKb);
}

async function askRoute(sb: ReturnType<typeof client>, chatId: number, d: Record<string, unknown>) {
  await convSave(sb, chatId, 'ask_route', d);
  await tgSend(
    chatId,
    'Which route? Send start and destination (e.g. "Guruvayur to Kozhikode") ' +
      '— I will suggest matching KSRTC routes.',
    cancelKb,
  );
}

async function suggestRoutes(sb: ReturnType<typeof client>, chatId: number, text: string, d: Record<string, unknown>) {
  const { data } = await sb.rpc('app_list_routes', { p_q: text, p_limit: 5 });
  const items = (Array.isArray(data) ? data[0]?.items : data?.items) ?? [];
  const clean = items.filter((i: { name?: string }) => typeof i.name === 'string' && i.name);
  await convSave(sb, chatId, 'pick_route', { ...d, route_text: text });
  await tgSend(
    chatId,
    clean.length
      ? 'Here is what I found — tap the exact route, or use your text as-is:'
      : 'No close match in the KSRTC dataset — you can still file it with your text.',
    routeKb(clean.map((i: { id: string; name: string }) => ({ id: i.id, name: i.name })), text),
  );
}

async function askDescription(sb: ReturnType<typeof client>, chatId: number, d: Record<string, unknown>) {
  await convSave(sb, chatId, 'ask_description', d);
  await tgSend(
    chatId,
    '🎙️ Now describe the problem (text or hold to record a voice note — min 10 characters).',
    cancelKb,
  );
}

async function askProof(sb: ReturnType<typeof client>, chatId: number, d: Record<string, unknown>) {
  await convSave(sb, chatId, 'ask_proof', d);
  const n = evidenceOf(d).length;
  await tgSend(
    chatId,
    `📎 Attach more proof if you have it — photos or short videos of the issue` +
      `${n ? ` (${n} attached so far)` : ' (optional)'}. Then tap Done.`,
    proofKb,
  );
}

async function showConfirm(sb: ReturnType<typeof client>, chatId: number, d: Record<string, unknown>) {
  await convSave(sb, chatId, 'confirm', d);
  await tgSend(chatId, reportText(d), confirmKb);
}

async function showEditMenu(sb: ReturnType<typeof client>, chatId: number, d: Record<string, unknown>) {
  await convSave(sb, chatId, 'edit_menu', d);
  await tgSend(chatId, 'What should we change?', editMenuKb);
}

/** Download a Telegram file into the private evidence bucket. Mime and size
 *  always come from the actual download (never trusted from the update). */
async function storeEvidence(sb: ReturnType<typeof client>, chatId: number, fileId: string):
  Promise<EvidenceItem | { error: string }> {
  const dl = await tgDownloadFile(fileId);
  if ('error' in dl) return dl;
  const mime = dl.mime || 'application/octet-stream';
  const ext = mime.includes('mp4') ? 'mp4' : mime.includes('webm') ? 'webm'
    : mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp'
    : mime.includes('pdf') ? 'pdf' : 'jpg';
  const path = `telegram/${chatId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const up = await sb.storage.from('evidence').upload(path, dl.bytes, {
    contentType: mime, upsert: false,
  });
  if (up.error) return { error: 'storage upload failed' };
  return { file_id: fileId, mime, size: dl.bytes.length, path };
}

async function submitComplaint(sb: ReturnType<typeof client>, chatId: number, d: Record<string, unknown>) {
  // ponytail: conditional claim — double-tap finds a non-confirm state and is ignored, no duplicate complaint
  if (!(await convClaim(sb, chatId, 'confirm', 'creating', d))) return;
  const evidence = evidenceOf(d);
  // Linked passengers: phone becomes the depot callback contact (operational
  // only — never shown in analytics) and the trip is remembered for next time.
  const passenger = await passengerGet(sb, chatId);
  const { data, error } = await sb.rpc('app_file_complaint', {
    p_category: String(d.category ?? 'other'),
    p_description: String(d.description ?? ''),
    p_route_id: typeof d.route_id === 'string' ? d.route_id : null,
    p_route_text: typeof d.route_text === 'string' && d.route_text ? d.route_text : null,
    p_bus_number: typeof d.bus_number === 'string' ? d.bus_number : null,
    p_contact_phone: passenger?.phone ?? null,
    p_telegram_chat_id: chatId,
    p_travel_date: typeof d.travel_date === 'string' && d.travel_date ? d.travel_date : null,
    // Slot for future organisers' API: ticket JSON rides along into audit.
    p_ticket_extracted: (d.ticket ?? null) as Record<string, unknown> | null,
    p_evidence: evidence.map((e) => ({
      storage_path: e.path, mime_type: e.mime, size_bytes: e.size, telegram_file_id: e.file_id,
    })),
  });
  if (error || !data) {
    // Surface the DB's own message (shortened) — no more blind "try again".
    const detail = String((error as { message?: string })?.message ?? 'unknown error').slice(0, 160);
    console.error('telegram file failed', detail);
    // Unrecoverable = the session data itself is bad: reset so the user can restart cleanly.
    const fatal = /route|description|category|evidence payload/i.test(detail);
    if (fatal) {
      await convClear(sb, chatId);
      await tgSend(chatId, `⚠️ Could not file: ${detail}\n\nSend /complain to start fresh — your photos stay safe in storage.`, menuKb);
    } else {
      await convSave(sb, chatId, 'confirm', d);
      await tgSend(chatId, `⚠️ Temporary hiccup (${detail}). Tap Submit to try again.`, confirmKb);
    }
    return;
  }
  if (passenger) {
    await sb.rpc('tg_trip_save', {
      p_chat_id: chatId,
      p_route_id: typeof d.route_id === 'string' ? d.route_id : null,
      p_route_label: fmtRoute(d) === '(no route)' ? 'Unspecified route' : fmtRoute(d),
      p_bus_number: typeof d.bus_number === 'string' ? d.bus_number : null,
    });
  }
  await convClear(sb, chatId);
  const out = Array.isArray(data) ? data[0] : data;
  await tgSend(
    chatId,
    '✅ Complaint filed and live on the website.\n\n' +
      `🔖 Reference: ${out.reference_id}\n` +
      `🏢 Depot: ${out.depot ?? 'manual triage'}\n` +
      `📎 Proof stored: ${out.evidence_count ?? 0}\n` +
      `⏱️ SLA due: ${out.sla_due_at ? new Date(out.sla_due_at).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '—'}\n\n` +
      `Track: /track ${out.reference_id}\nYour complaints: /my`,
    menuKb,
  );
}

// ---------------------------------------------------------------------------
// Ticket handling (photo -> Groq -> review)
// ---------------------------------------------------------------------------
function ticketSummary(t: TicketExtract): string {
  const lines = [
    t.bus_number ? `• Bus: ${t.bus_number}` : null,
    t.origin || t.destination ? `• Route: ${t.origin ?? '?'} → ${t.destination ?? '?'}` : null,
    t.travel_date ? `• Date: ${t.travel_date}${t.travel_time ? ` ${t.travel_time}` : ''}` : null,
    t.ticket_no ? `• Ticket: ${t.ticket_no}` : null,
    t.pnr ? `• PNR: ${t.pnr}` : null,
    t.service_type ? `• Service: ${t.service_type}` : null,
    t.trip_code ? `• Trip code: ${t.trip_code}` : null,
    t.depot ? `• Depot: ${t.depot}` : null,
    t.depot_phone ? `• Depot phone: ${t.depot_phone}` : null,
    t.landmark ? `• Landmark: ${t.landmark}` : null,
    t.has_qr ? '• QR code: present' : null,
  ].filter(Boolean);
  return lines.length ? lines.join('\n') : '(nothing readable)';
}

async function handleTicketPhoto(
  sb: ReturnType<typeof client>, chatId: number, conv: Conv, fileId: string,
): Promise<void> {
  await tgSend(chatId, '🔎 Reading your ticket…', undefined);
  const dl = await tgDownloadFile(fileId);
  if ('error' in dl) {
    await tgSend(chatId, `⚠️ Could not fetch that file (${dl.error}). Send the photo again or skip.`, ticketKb);
    return;
  }
  // The ticket photo is proof of travel: store it BEFORE extraction so it is
  // kept even if the ML slot is empty or fails.
  const started = Date.now();
  const stored = await storeEvidence(sb, chatId, fileId);
  const kept = 'error' in stored ? [] : [stored];
  const d: Record<string, unknown> = {
    ...conv.data,
    evidence: [...evidenceOf(conv.data), ...kept],
  };
  const ex = await extractTicketWithGroq(dl.bytes, dl.mime);
  if (!ex.ok) {
    // Slot empty or call failed: fail-soft, flow continues manually.
    await tgSend(
      chatId,
      `ℹ️ Auto-read unavailable (${ex.reason}).` +
        (Deno.env.get('GROQ_API_KEY') ? ' The photo is attached as proof.' : ' Add GROQ_API_KEY as a function secret to enable it.') +
        '\n\nContinuing manually — your photo is kept as proof.',
      undefined,
    );
    await askCategory(sb, chatId, d);
    return;
  }
  const t = ex.data;
  await convSave(sb, chatId, 'ticket_review', {
    ...d,
    ticket: t,
    bus_number: t.bus_number ?? conv.data.bus_number ?? null,
    travel_date: t.travel_date ?? conv.data.travel_date ?? null,
    route_text: t.origin && t.destination ? `${t.origin} to ${t.destination}` : conv.data.route_text ?? null,
  });
  await tgSend(
    chatId,
    `🪄 Read your ticket in ${((Date.now() - started) / 1000).toFixed(1)}s — saved as proof of travel:\n\n` +
      ticketSummary(t) +
      '\n\nCheck these details:',
    ticketReviewKb(),
  );
}

// ---------------------------------------------------------------------------
// Flow dispatcher — returns true if the update was consumed by a conversation
// ---------------------------------------------------------------------------
async function handleFlow(
  sb: ReturnType<typeof client>,
  chatId: number,
  text: string | undefined,
  media: { photoFileId?: string; videoFileId?: string; videoMime?: string; voiceFileId?: string; voiceMime?: string } | undefined,
): Promise<boolean> {
  const conv = await convGet(sb, chatId);
  const d0 = conv.data;
  const value = (text ?? '').trim();

  switch (conv.state) {
    case 'ask_ticket': {
      if (media?.photoFileId) { await handleTicketPhoto(sb, chatId, conv, media.photoFileId); return true; }
      await tgSend(chatId, 'Send a ticket photo, or tap Skip 👆', ticketKb);
      return true;
    }

    case 'ticket_review': {
      if (media?.photoFileId) { await handleTicketPhoto(sb, chatId, conv, media.photoFileId); return true; }
      await tgSend(chatId, 'Tap “Details look right” to continue, or Ignore & continue manually.', ticketReviewKb());
      return true;
    }

    case 'ask_category': {
      if (media?.photoFileId) { await handleTicketPhoto(sb, chatId, conv, media.photoFileId); return true; }
      if (value && !value.startsWith('/')) {
        // Typed text here: treat as route hint, guess a category, jump ahead.
        const cat = guessCategory(value);
        await suggestRoutes(sb, chatId, value, { ...d0, category: cat });
        return true;
      }
      await tgSend(chatId, 'Please tap one of the categories 👆', categoryKb);
      return true;
    }

    case 'pick_route':
    case 'ask_route': {
      if (media?.photoFileId) { await handleTicketPhoto(sb, chatId, conv, media.photoFileId); return true; }
      if (!value || value.startsWith('/')) {
        await tgSend(chatId, 'Send your route as text (e.g. "Adoor to Ernakulam") or tap Skip.', cancelKb);
        return true;
      }
      await suggestRoutes(sb, chatId, value, d0);
      return true;
    }

    case 'ask_description': {
      if (media?.voiceFileId) {
        // Sarvam slot: voice note -> text into the description (fail-soft).
        const meta = await tgDownloadFile(media.voiceFileId);
        if (!('error' in meta)) {
          const st = await transcribeVoice(meta.bytes, meta.mime);
          if (st.ok && st.text.replace(/\s/g, '').length >= 10) {
            await showConfirm(sb, chatId, { ...d0, description: `${value ? value + ' ' : ''}${st.text}`.trim() });
            return true;
          }
          await tgSend(chatId, `🎙️ Voice transcription unavailable (${st.reason}). Please type it instead.`, cancelKb);
          return true;
        }
      }
      if (media?.photoFileId) {
        const stored = await storeEvidence(sb, chatId, media.photoFileId);
        const dd = 'error' in stored ? d0 : { ...d0, evidence: [...evidenceOf(d0), stored] };
        await tgSend(chatId, '📷 Saved as proof. Now describe the problem in text.', cancelKb);
        await convSave(sb, chatId, 'ask_description', dd);
        return true;
      }
      if (!value || value.startsWith('/')) {
        await tgSend(chatId, 'Please describe what happened (at least 10 characters).', cancelKb);
        return true;
      }
      if (value.length < 10) {
        await tgSend(chatId, `That is ${value.length} characters — a little more detail helps (min 10).`, cancelKb);
        return true;
      }
      await askProof(sb, chatId, { ...d0, description: value });
      return true;
    }

    case 'ask_proof': {
      if (media?.photoFileId || media?.videoFileId) {
        const stored = await storeEvidence(sb, chatId, media.photoFileId ?? media.videoFileId!);
        if ('error' in stored) {
          await tgSend(chatId, `⚠️ Could not store that file (${stored.error}). Try again or tap Done.`, proofKb);
          return true;
        }
        await askProof(sb, chatId, { ...d0, evidence: [...evidenceOf(d0), stored] });
        return true;
      }
      await tgSend(chatId, 'Attach photos/videos, or tap “Done — continue” 👆', proofKb);
      return true;
    }

    case 'confirm': {
      if (/^(yes|submit)$/i.test(value)) return (await submitComplaint(sb, chatId, d0)), true;
      if (/^no$/i.test(value)) {
        await convClear(sb, chatId);
        await tgSend(chatId, 'Cancelled. Send /complain whenever you are ready.', menuKb);
        return true;
      }
      await tgSend(chatId, reportText(d0), confirmKb);
      return true;
    }

    case 'edit_bus': {
      if (!value || value.startsWith('/')) {
        await tgSend(chatId, 'Send the bus number as text (e.g. KL-15-A-1234).', cancelKb);
        return true;
      }
      await showConfirm(sb, chatId, { ...d0, bus_number: value });
      return true;
    }

    default:
      return false; // no active flow — caller decides what to do
  }
}

// ---------------------------------------------------------------------------
// Callback queries (button taps)
// ---------------------------------------------------------------------------
async function handleCallback(sb: ReturnType<typeof client>, cb: {
  id: string; data?: string; message?: { chat: { id: number } };
}): Promise<unknown> {
  const chatId = cb.message?.chat.id;
  if (!chatId || !cb.data) return tgAnswer(cb.id);
  await tgAnswer(cb.id);
  const conv = await convGet(sb, chatId);
  const d = conv.data;
  const [tag, arg1, arg2] = cb.data.split(':');

  switch (tag) {
    case 'flow':
      if (arg1 === 'newtrip') {
        await askTicket(sb, chatId, {});
        return { status: 'ok' };
      }
      await startComplaint(sb, chatId);
      return { status: 'ok' };

    case 'trip': {
      // Pre-fill from a saved trip: label parsed back through the dataset.
      const trips = await tripsList(sb, chatId);
      const t = trips[Number(arg1)];
      if (!t) { await askTicket(sb, chatId, {}); return { status: 'ok' }; }
      await suggestRoutes(sb, chatId, t.route_label, {
        bus_number: t.bus_number ?? null,
        category: null,
      });
      return { status: 'ok' };
    }

    case 'link':
      await convSave(sb, chatId, 'idle', {});
      await tgSend(
        chatId,
        '🔗 Link your account so SAMADHAN remembers your trips and the depot can call you back.\n\n' +
          'Tap the button below to share your number (one tap — no typing).',
        linkKb,
      );
      return { status: 'ok' };

    case 'skip_ticket':
      await askCategory(sb, chatId, d);
      return { status: 'ok' };

    case 'link': // unreachable duplicate tag guard (handled above)
      return { status: 'ignored' };

    case 'ticket_ok': {
      // Route from the extracted origin/destination via the dataset.
      const hint = typeof d.route_text === 'string' ? d.route_text : '';
      if (hint) await suggestRoutes(sb, chatId, hint, d);
      else await askCategory(sb, chatId, d);
      return { status: 'ok' };
    }

    case 'ticket_fix':
      // Keep photo as proof, drop the extracted fields, continue manually.
      await askCategory(sb, chatId, { ...d, bus_number: null, travel_date: null, ticket: null, route_text: null });
      return { status: 'ok' };

    case 'cat':
      if (!CATEGORY_LABELS.has(arg1 ?? '')) return { status: 'ignored' };
      if (typeof d.route_text === 'string' && d.route_text) await suggestRoutes(sb, chatId, d.route_text, { ...d, category: arg1 });
      else await askRoute(sb, chatId, { ...d, category: arg1 });
      return { status: 'ok' };

    case 'route':
      if (arg1 === 'raw') await askDescription(sb, chatId, { ...d, route_id: null });
      else if (arg1 === 'skip') await askDescription(sb, chatId, { ...d, route_id: null, route_text: 'Telegram' });
      else if (arg1) await askDescription(sb, chatId, { ...d, route_id: arg1, route_name: arg2 ?? 'Selected route' });
      else await askRoute(sb, chatId, d);
      return { status: 'ok' };

    case 'proof':
      await showConfirm(sb, chatId, d);
      return { status: 'ok' };

    case 'submit':
      await submitComplaint(sb, chatId, d);
      return { status: 'ok' };

    case 'edit':
      await showEditMenu(sb, chatId, d);
      return { status: 'ok' };

    case 'back':
      await showConfirm(sb, chatId, d);
      return { status: 'ok' };

    case 'my':
      await sendMyComplaints(sb, chatId);
      return { status: 'ok' };

    case 'help':
      await tgSend(chatId, HELP, menuKb);
      return { status: 'ok' };

    case 'cancel':
      await convClear(sb, chatId);
      await tgSend(chatId, 'Cancelled — nothing was filed. Send /complain whenever you are ready.', menuKb);
      return { status: 'ok' };

    default:
      return { status: 'ignored' };
  }
}

// ponytail: 'edit:cat|route|bus|desc' share the 'edit' tag with the menu
// opener — disambiguate by the colon arg before dispatching.
async function handleEditArg(sb: ReturnType<typeof client>, chatId: number, arg: string | undefined): Promise<boolean> {
  if (!arg) return false;
  const conv = await convGet(sb, chatId);
  const d = conv.data;
  if (arg === 'cat') await askCategory(sb, chatId, d);
  if (arg === 'route') await askRoute(sb, chatId, { ...d, route_id: null, route_name: null, route_text: null });
  if (arg === 'bus') {
    await convSave(sb, chatId, 'edit_bus', d);
    await tgSend(chatId, 'Send the bus number as text (or a corrected ticket photo).', cancelKb);
  }
  if (arg === 'desc') await askDescription(sb, chatId, { ...d, description: null });
  return true;
}

async function sendMyComplaints(sb: ReturnType<typeof client>, chatId: number) {
  const { data } = await sb.rpc('app_my_complaints', { p_chat_id: chatId, p_limit: 10 });
  // app_my_complaints returns { items: [...] } (jsonb_build_object wrapper).
  const items = (data && typeof data === 'object' && Array.isArray((data as { items?: unknown[] }).items))
    ? (data as { items: unknown[] }).items
    : (Array.isArray(data) ? data : []);
  if (!items.length) {
    await tgSend(chatId, 'No complaints from this chat yet. Tap below to file your first one.', menuKb);
    return;
  }
  const lines = items.map((c: { reference_id: string; status: string; depot: string | null }) =>
    `• ${c.reference_id} — ${c.status}${c.depot ? ` (${c.depot})` : ''}`
  );
  await tgSend(chatId, `📋 Your recent complaints:\n\n${lines.join('\n')}`, menuKb);
}

// ---------------------------------------------------------------------------
// Telegram webhook
// ---------------------------------------------------------------------------
let botConfigured = false;

function mediaOf(msg: Record<string, any>): {
  photoFileId?: string; videoFileId?: string; videoMime?: string;
  voiceFileId?: string; voiceMime?: string; docFileId?: string; docMime?: string;
} {
  const out: ReturnType<typeof mediaOf> = {};
  const photo = Array.isArray(msg?.photo) ? msg.photo[msg.photo.length - 1] : null;
  if (photo?.file_id) out.photoFileId = photo.file_id;
  if (msg?.video?.file_id) { out.videoFileId = msg.video.file_id; out.videoMime = msg.video.mime_type; }
  if (msg?.video_note?.file_id) { out.videoFileId = msg.video_note.file_id; out.videoMime = 'video/mp4'; }
  if (msg?.voice?.file_id) { out.voiceFileId = msg.voice.file_id; out.voiceMime = msg.voice.mime_type; }
  if (msg?.document?.file_id && typeof msg.document.mime_type === 'string'
      && (msg.document.mime_type.startsWith('image/') || msg.document.mime_type === 'application/pdf')) {
    out.docFileId = msg.document.file_id; out.docMime = msg.document.mime_type;
    if (msg.document.mime_type.startsWith('image/')) out.photoFileId = msg.document.file_id;
  }
  return out;
}

async function handleTelegram(req: Request): Promise<Response> {
  const expected = Deno.env.get('TELEGRAM_SECRET_TOKEN');
  if (expected) {
    const got = req.headers.get('x-telegram-bot-api-secret-token');
    if (got !== expected) return new Response('secret token mismatch', { status: 403 });
  }
  if (!botConfigured) {
    botConfigured = true;
    await tgConfigureBot(); // lazy, once per cold start (BloodLink pattern)
  }

  const payload = await req.json().catch(() => ({}) as Record<string, any>);
  const sb = client();

  // --- button taps ---------------------------------------------------------
  if (payload.callback_query) {
    const cb = payload.callback_query;
    if (typeof cb.data === 'string' && cb.data.startsWith('edit:')) {
      await tgAnswer(cb.id);
      const chatId = cb.message?.chat?.id;
      if (chatId) await handleEditArg(sb, chatId, cb.data.slice(5));
      return json({ status: 'ok' });
    }
    await handleCallback(sb, cb);
    return json({ status: 'ok' });
  }

  // --- messages ------------------------------------------------------------
  const msg = payload.message ?? payload.edited_message;
  const chatId: number | undefined = msg?.chat?.id;
  const text: string | undefined = (msg?.text ?? '').trim() || undefined;
  if (chatId == null) return json({ status: 'ignored' });
  const media = mediaOf(msg);

  // Contact share = account linking (one-tap onboarding).
  if (msg?.contact?.phone_number && (msg.contact.user_id === msg.from?.id || !msg.contact.user_id)) {
    const phone = String(msg.contact.phone_number).trim();
    if (phone) {
      await sb.rpc('tg_passenger_link', {
        p_chat_id: chatId, p_phone: phone.startsWith('+') ? phone : `+${phone}`,
        p_name: msg.contact.first_name ?? null,
      });
      await tgSend(
        chatId,
        `✅ Account linked${msg.contact.first_name ? `, ${msg.contact.first_name}` : ''}!\n\n` +
          'From now on:\n' +
          '• Your trips are remembered — filing a complaint is two taps\n' +
          '• Your number goes to the depot for callbacks (never public)\n\n' +
          'Send /complain to try it.',
        menuKb,
      );
      return json({ status: 'ok', linked: true });
    }
  }

  // Commands (support /command@botname)
  const cmd = text?.match(/^\/([a-z_]+)(?:@[A-Za-z0-9_]+)?(?:\s+(.*))?$/);
  if (cmd && !media.photoFileId) {
    const name = cmd[1].toLowerCase();
    const arg = (cmd[2] ?? '').trim();

    if (name === 'start') {
      await tgSend(
        chatId,
        '🚌 Welcome to SAMADHAN!\n\nReport a KSRTC issue in under a minute: ' +
          'upload your ticket photo, I read the details automatically, you add ' +
          'the problem — done. It lands on the depot dashboard instantly.',
        menuKb,
      );
      return json({ status: 'ok' });
    }
    if (name === 'help') { await tgSend(chatId, HELP, menuKb); return json({ status: 'ok' }); }
    if (name === 'complain') { await askTicket(sb, chatId, {}); return json({ status: 'ok' }); }
    if (name === 'cancel') {
      await convClear(sb, chatId);
      await tgSend(chatId, 'Cancelled — nothing was filed.', menuKb);
      return json({ status: 'ok' });
    }
    if (name === 'link') {
      const existing = await passengerGet(sb, chatId);
      if (existing) {
        await tgSend(
          chatId,
          `✅ Already linked (${existing.phone}). Your trips are saved automatically after each complaint.\n\n` +
            'Send /unlink to remove your account from this chat.',
          menuKb,
        );
      } else {
        await tgSend(
          chatId,
          '🔗 Link your account so SAMADHAN remembers your trips and the depot can call you back.\n\n' +
            'Tap the button below to share your number (one tap — no typing).',
          linkKb,
        );
      }
      return json({ status: 'ok' });
    }
    if (name === 'unlink') {
      await sb.rpc('tg_passenger_unlink', { p_chat_id: chatId });
      await tgSend(chatId, 'Account unlinked. Your past complaints are unaffected.', menuKb);
      return json({ status: 'ok' });
    }
    if (name === 'my') { await sendMyComplaints(sb, chatId); return json({ status: 'ok' }); }
    if (name === 'track') {
      if (!arg) { await tgSend(chatId, 'Send: /track KSRTC-XXXXXX'); return json({ status: 'ok' }); }
      const { data, error } = await sb.rpc('app_track_complaint', { p_ref: arg });
      const reply = error
        ? 'Tracking failed — try the web /track page.'
        : data
        ? `🔎 ${String(arg).toUpperCase()}: ${data.status}${data.depot ? ` (${data.depot})` : ''}.`
        : `Unknown ID ${String(arg).toUpperCase()} — check and retry.`;
      await tgSend(chatId, reply, menuKb);
      return json({ status: 'ok' });
    }
    // unknown command: fall through to flow handling
  }

  // Active conversation consumes everything (text, photos, videos, voice)
  if (await handleFlow(sb, chatId, text, media)) return json({ status: 'ok' });

  // No flow: a photo outside the flow invites the ticket flow.
  if (media.photoFileId) {
    await askTicket(sb, chatId, {});
    await tgSend(chatId, 'Send that photo again now and I will read it as your ticket.');
    return json({ status: 'ok' });
  }

  // Bare text outside a flow: legacy pipe format still works; otherwise offer flow.
  const parts = (text ?? '').split('|').map((p) => p.trim());
  if (parts.length === 3) {
    const raw = parts[0].toLowerCase().replace(/ /g, '_');
    const category = CATEGORY_LABELS.has(raw) ? raw : guessCategory(text ?? '');
    const { data, error } = await sb.rpc('app_file_complaint', {
      p_category: category,
      p_description: parts[2],
      p_route_text: parts[1] || 'Telegram',
      p_telegram_chat_id: chatId,
    });
    if (error || !data) {
      await tgSend(chatId, '⚠️ Could not file that — please use /complain for the guided flow.');
      return json({ status: 'ok' });
    }
    const out = Array.isArray(data) ? data[0] : data;
    await tgSend(
      chatId,
      `✅ Filed ${out.reference_id}${out.depot ? ` — routed to ${out.depot} depot` : ''}. Track: /track ${out.reference_id}`,
      menuKb,
    );
    return json({ status: 'ok', reference_id: out.reference_id });
  }

  if (text && text.length >= 10) {
    const cat = guessCategory(text);
    await askTicket(sb, chatId, { description: text, category: cat });
    return json({ status: 'ok' });
  }

  await tgSend(chatId, 'Tap below to get started 👇', menuKb);
  return json({ status: 'ok' });
}

// ---------------------------------------------------------------------------
// Voice (Sarvam STT) — HTTP endpoint for the web app; key stays server-side
// ---------------------------------------------------------------------------
async function handleVoiceTranscribe(req: Request): Promise<Response> {
  const key = Deno.env.get('SARVAM_API_KEY');
  if (!key) return json({ detail: 'voice transcription not configured' }, 503);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ detail: 'expected multipart audio' }, 422);
  }
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return json({ detail: 'empty audio' }, 422);
  }
  if (file.size > 8 * 1024 * 1024) {
    return json({ detail: 'audio too large (max ~30s)' }, 422);
  }
  const languageCode = String(form.get('language_code') ?? 'unknown');

  const out = new FormData();
  out.append('file', file, file.name || 'recording.webm');
  out.append('model', 'saaras:v3');
  out.append('mode', 'transcribe');
  out.append('language_code', languageCode);

  const r = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: { 'api-subscription-key': key },
    body: out,
  });
  if (!r.ok) {
    console.error('sarvam stt', r.status);
    return json({ detail: 'transcription failed' }, 422);
  }
  const body = await r.json();
  const transcript = String(body.transcript ?? '').trim();
  if (!transcript) return json({ detail: 'empty transcript' }, 422);
  return json({
    transcript,
    language_code: body.language_code ?? null,
    request_id: body.request_id ?? null,
  });
}

/** Multipart upload -> private evidence bucket (web form). Returns storage_path. */
async function handleUpload(req: Request): Promise<Response> {
  const sb = client();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ detail: 'expected multipart form' }, 422);
  }
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return json({ detail: 'empty file' }, 422);
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf',
    'video/mp4', 'video/webm', 'video/quicktime'];
  if (!allowed.includes(file.type)) return json({ detail: 'unsupported file type' }, 422);
  if (file.size > 20 * 1024 * 1024) return json({ detail: 'file too large (max 20 MB)' }, 422);
  const ext = file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp'
    : file.type.includes('heic') ? 'heic' : file.type.includes('pdf') ? 'pdf'
    : file.type.includes('mp4') ? 'mp4' : file.type.includes('webm') ? 'webm'
    : file.type.includes('quicktime') ? 'mov' : 'jpg';
  const path = `web/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const up = await sb.storage.from('evidence').upload(path, await file.arrayBuffer(), {
    contentType: file.type, upsert: false,
  });
  if (up.error) {
    console.error('upload failed', up.error);
    return json({ detail: 'upload failed' }, 500);
  }
  return json({ storage_path: path, mime_type: file.type, size_bytes: file.size }, 201);
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
      return json({
        status: 'ok',
        v: 4,
        slots: {
          groq: Boolean(Deno.env.get('GROQ_API_KEY')),
          sarvam: Boolean(Deno.env.get('SARVAM_API_KEY')),
          telegram: Boolean(Deno.env.get('TELEGRAM_BOT_TOKEN')),
        },
      });
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
        p_travel_date: body.travel_date ?? null,
        p_ticket_extracted: body.ticket_extracted ?? null,
        p_evidence: body.evidence ?? null,
        p_telegram_chat_id: body.telegram_chat_id ?? null,
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

    // -- uploads (web form evidence) --------------------------------------
    if (path === '/api/v1/uploads' && req.method === 'POST') {
      return await handleUpload(req);
    }

    // -- ML: ticket extraction (Groq vision slot) --------------------------
    if (path === '/api/v1/extract/ticket' && req.method === 'POST') {
      let form: FormData;
      try {
        form = await req.formData();
      } catch {
        return json({ detail: 'expected multipart image' }, 422);
      }
      const file = form.get('file');
      if (!(file instanceof File) || file.size === 0) return json({ detail: 'empty file' }, 422);
      if (file.size > 20 * 1024 * 1024) return json({ detail: 'file too large' }, 422);
      const ex = await extractTicketWithGroq(new Uint8Array(await file.arrayBuffer()), file.type || 'image/jpeg');
      if (!ex.ok) return json({ detail: ex.reason, extracted: null }, 503);
      return json({ extracted: ex.data });
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

    // -- passenger account panel (website "My Account") --------------------
    // Chat-keyed self-service: the panel only exposes what that chat already
    // owns (its own trips/complaints, no PII beyond operational phone data).
    if (path === '/api/v1/my/trips' && req.method === 'GET') {
      const chat = Number(q.get('chat_id'));
      if (!Number.isInteger(chat) || chat <= 0) return json({ detail: 'chat_id required' }, 422);
      const sb = client();
      const { data, error } = await sb.rpc('app_my_trips', {
        p_chat_id: chat, p_limit: Number(q.get('limit') ?? 10),
      });
      if (error) return mapDbError(error);
      return json(data);
    }
    if (path === '/api/v1/my/complaints' && req.method === 'GET') {
      const chat = Number(q.get('chat_id'));
      if (!Number.isInteger(chat) || chat <= 0) return json({ detail: 'chat_id required' }, 422);
      const sb = client();
      const { data, error } = await sb.rpc('app_my_complaints', {
        p_chat_id: chat, p_limit: Number(q.get('limit') ?? 10),
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

    // -- voice (Sarvam STT) ----------------------------------------------
    if (path === '/api/v1/voice/status' && req.method === 'GET') {
      return json({ available: Boolean(Deno.env.get('SARVAM_API_KEY')) });
    }
    if (path === '/api/v1/voice/transcribe' && req.method === 'POST') {
      return await handleVoiceTranscribe(req);
    }

    return json({ detail: 'Not Found' }, 404);
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : 'internal error';
    if (msg.includes('not configured')) return json({ detail: msg }, 500);
    return json({ detail: 'storage failure' }, 500);
  }
});
