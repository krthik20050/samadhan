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
//   POST /api/v1/telegram/webhook              Telegram bot (button flow)
//   GET  /api/v1/voice/status                  Sarvam STT configured?
//   POST /api/v1/voice/transcribe              audio → transcript (Sarvam)
//
// All business logic lives in Postgres RPCs (migrations 005 + 006); this
// function validates, enforces auth, and maps errors. Response shapes mirror
// FastAPI 1:1 so the frontend contract does not change.
//
// Telegram flow (BloodLink pattern): one question at a time, inline buttons
// over free text, conversation state persisted in Postgres (tg_conv_* RPCs),
// atomic claim to defeat double-taps, /cancel safety, edit-before-submit.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const HELP =
  '🚌 SAMADHAN — file a KSRTC complaint in 30 seconds.\n\n' +
  'Tap the menu button or send /complain to start. ' +
  'Track anytime with /track KSRTC-XXXXXX, your complaints with /my. ' +
  '/cancel stops the current flow.';

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

// ponytail: keyword guess for bare text with no flow — replace with LLM extraction (Phase 10) if it misfires.
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
      { command: 'complain', description: 'File a complaint' },
      { command: 'my', description: 'My complaints' },
      { command: 'track', description: 'Track a complaint (e.g. /track KSRTC-2026-ABC123)' },
      { command: 'help', description: 'How to use SAMADHAN' },
      { command: 'cancel', description: 'Cancel the current flow' },
    ],
  });
}

// ---------------------------------------------------------------------------
// Keyboards
// ---------------------------------------------------------------------------
type Kb = { inline_keyboard: { text: string; callback_data: string }[][] };

const menuKb: Kb = {
  inline_keyboard: [
    [{ text: '🚨 File a complaint', callback_data: 'flow:start' }],
    [{ text: '📋 My complaints', callback_data: 'my' }],
    [{ text: '❓ Help', callback_data: 'help' }],
  ],
};

const categoryKb: Kb = {
  inline_keyboard: [
    ...chunk(CATEGORIES, 2).map((row) =>
      row.map(([value, label]) => ({ text: label, callback_data: `cat:${value}` }))
    ),
    [{ text: '❌ Cancel', callback_data: 'cancel' }],
  ],
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const cancelKb: Kb = {
  inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cancel' }]],
};

function routeKb(hits: { id: string; name: string }[], raw: string): Kb {
  const rows = hits.slice(0, 5).map((h) => ({
    text: `🚌 ${h.name}`,
    callback_data: `route:${h.id}:${h.name.slice(0, 40)}`,
  }));
  return {
    inline_keyboard: [
      ...(rows.length ? chunk(rows, 1) : []),
      [{ text: `✅ Use exactly what I typed: "${raw.slice(0, 24)}"`, callback_data: 'route:raw' }],
      [{ text: '⏭️ Skip (file without route)', callback_data: 'route:skip' }],
      [{ text: '❌ Cancel', callback_data: 'cancel' }],
    ],
  };
}

const confirmKb: Kb = {
  inline_keyboard: [
    [{ text: '✅ Submit complaint', callback_data: 'submit' }],
    [{ text: '✏️ Edit answers', callback_data: 'edit' }],
    [{ text: '❌ Cancel', callback_data: 'cancel' }],
  ],
};

const editMenuKb: Kb = {
  inline_keyboard: [
    [{ text: 'Category', callback_data: 'edit:cat' }, { text: 'Route', callback_data: 'edit:route' }],
    [{ text: 'Description', callback_data: 'edit:desc' }],
    [{ text: '⬅️ Back to summary', callback_data: 'back' }],
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

// ---------------------------------------------------------------------------
// Flow steps
// ---------------------------------------------------------------------------
function confirmText(d: Record<string, unknown>): string {
  const cat = typeof d.category === 'string' ? CATEGORY_LABELS.get(d.category) ?? d.category : '—';
  const route = typeof d.route_name === 'string'
    ? d.route_name
    : typeof d.route_text === 'string' && d.route_text
    ? d.route_text
    : '(no route)';
  const desc = typeof d.description === 'string' ? d.description : '';
  return (
    '🧾 Please confirm your complaint:\n\n' +
    `• Category: ${cat}\n` +
    `• Route: ${route}\n` +
    `• Description: ${desc}\n\n` +
    'Tap Submit to file it, Edit to change an answer, or Cancel.'
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
    'Which route? Send start and destination (e.g. "Guruvayur to Kozhikode").\n\n' +
      'I will suggest matching KSRTC routes — or skip if you are not sure.',
  );
}

async function suggestRoutes(sb: ReturnType<typeof client>, chatId: number, text: string) {
  const { data } = await sb.rpc('app_list_routes', { p_q: text, p_limit: 5 });
  const items = (Array.isArray(data) ? data[0]?.items : data?.items) ?? [];
  const clean = items.filter((i: { name?: string }) => typeof i.name === 'string' && i.name);
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
  await tgSend(chatId, 'Describe what happened (at least 10 characters).', cancelKb);
}

async function showConfirm(sb: ReturnType<typeof client>, chatId: number, d: Record<string, unknown>) {
  await convSave(sb, chatId, 'confirm', d);
  await tgSend(chatId, confirmText(d), confirmKb);
}

async function showEditMenu(sb: ReturnType<typeof client>, chatId: number, d: Record<string, unknown>) {
  await convSave(sb, chatId, 'edit_menu', d);
  await tgSend(chatId, 'What should we change?', editMenuKb);
}

async function submitComplaint(sb: ReturnType<typeof client>, chatId: number, d: Record<string, unknown>) {
  // ponytail: conditional claim — double-tap finds a non-confirm state and is ignored, no duplicate complaint
  if (!(await convClaim(sb, chatId, 'confirm', 'creating', d))) return;
  const { data, error } = await sb.rpc('app_file_complaint', {
    p_category: String(d.category ?? 'other'),
    p_description: String(d.description ?? ''),
    p_route_id: typeof d.route_id === 'string' ? d.route_id : null,
    p_route_text: typeof d.route_text === 'string' && d.route_text ? d.route_text : null,
    p_telegram_chat_id: chatId,
  });
  if (error || !data) {
    console.error('telegram file failed', error);
    await convSave(sb, chatId, 'confirm', d);
    await tgSend(chatId, '⚠️ Something went wrong filing it. Tap Submit to try again.', confirmKb);
    return;
  }
  await convClear(sb, chatId);
  const out = Array.isArray(data) ? data[0] : data;
  await tgSend(
    chatId,
    `✅ Filed ${out.reference_id}` +
      `${out.depot ? ` — routed to ${out.depot} depot` : ' — sent for manual triage'}.` +
      `\n\nTrack it here: /track ${out.reference_id}\nYour complaints: /my`,
    menuKb,
  );
}

// ---------------------------------------------------------------------------
// Flow dispatcher — returns true if the update was consumed by a conversation
// ---------------------------------------------------------------------------
async function handleFlow(
  sb: ReturnType<typeof client>,
  chatId: number,
  text: string | undefined,
): Promise<boolean> {
  const conv = await convGet(sb, chatId);
  const value = (text ?? '').trim();

  switch (conv.state) {
    case 'ask_category': {
      // Free text here is treated as an early route hint only if it looks like
      // a route; otherwise nudge back to the buttons.
      if (value && !value.startsWith('/')) {
        const cat = guessCategory(value);
        await suggestRoutes(sb, chatId, value);
        await convSave(sb, chatId, 'ask_route', { ...conv.data, category: cat });
        return true;
      }
      await tgSend(chatId, 'Please tap one of the categories 👆', categoryKb);
      return true;
    }

    case 'ask_route': {
      if (!value || value.startsWith('/')) {
        await tgSend(chatId, 'Send your route as text (e.g. "Adoor to Ernakulam") or tap Skip.', cancelKb);
        return true;
      }
      await suggestRoutes(sb, chatId, value);
      return true;
    }

    case 'ask_description': {
      if (!value || value.startsWith('/')) {
        await tgSend(chatId, 'Please describe what happened (at least 10 characters).', cancelKb);
        return true;
      }
      if (value.length < 10) {
        await tgSend(chatId, `That is ${value.length} characters — a little more detail helps (min 10).`, cancelKb);
        return true;
      }
      await showConfirm(sb, chatId, { ...conv.data, description: value });
      return true;
    }

    case 'confirm': {
      if (/^(yes|submit)$/i.test(value)) return (await submitComplaint(sb, chatId, conv.data)), true;
      if (/^no$/i.test(value)) {
        await convClear(sb, chatId);
        await tgSend(chatId, 'Cancelled. Send /complain whenever you are ready.', menuKb);
        return true;
      }
      await tgSend(chatId, confirmText(conv.data), confirmKb);
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
  const [tag, arg1, arg2] = cb.data.split(':');

  switch (tag) {
    case 'flow': // menu: file a complaint
      await askCategory(sb, chatId, {});
      return { status: 'ok' };

    case 'cat': {
      if (!CATEGORY_LABELS.has(arg1 ?? '')) return { status: 'ignored' };
      await askRoute(sb, chatId, { ...conv.data, category: arg1 });
      return { status: 'ok' };
    }

    case 'route': {
      if (arg1 === 'raw') {
        // route_text was saved when the user typed it; fall back to 'Telegram'
        const d = { ...conv.data, route_id: null };
        await askDescription(sb, chatId, d);
      } else if (arg1 === 'skip') {
        await askDescription(sb, chatId, { ...conv.data, route_id: null, route_text: 'Telegram' });
      } else if (arg1) {
        await askDescription(sb, chatId, {
          ...conv.data, route_id: arg1, route_name: arg2 ?? 'Selected route', route_text: null,
        });
      } else {
        await askRoute(sb, chatId, conv.data);
      }
      return { status: 'ok' };
    }

    case 'submit':
      await submitComplaint(sb, chatId, conv.data);
      return { status: 'ok' };

    case 'edit':
      await showEditMenu(sb, chatId, conv.data);
      return { status: 'ok' };

    case 'back':
      await showConfirm(sb, chatId, conv.data);
      return { status: 'ok' };

    case 'my':
      await sendMyComplaints(sb, chatId);
      return { status: 'ok' };

    case 'cancel':
      await convClear(sb, chatId);
      await tgSend(chatId, 'Cancelled — nothing was filed. Send /complain whenever you are ready.', menuKb);
      return { status: 'ok' };

    default:
      return { status: 'ignored' };
  }
}

// ponytail: 'edit:cat' | 'edit:route' | 'edit:desc' share the 'edit' tag with
// the edit-menu opener — disambiguate by the colon arg before dispatching.
async function handleEditArg(sb: ReturnType<typeof client>, chatId: number, arg: string | undefined): Promise<boolean> {
  if (!arg) return false;
  const conv = await convGet(sb, chatId);
  if (arg === 'cat') await askCategory(sb, chatId, conv.data);
  if (arg === 'route') await askRoute(sb, chatId, { ...conv.data, route_id: null, route_name: null, route_text: null });
  if (arg === 'desc') await askDescription(sb, chatId, conv.data);
  return true;
}

async function sendMyComplaints(sb: ReturnType<typeof client>, chatId: number) {
  const { data } = await sb.rpc('app_my_complaints', { p_chat_id: chatId, p_limit: 5 });
  const items = (Array.isArray(data) ? data[0] : data) ?? [];
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
    // 'edit:cat|route|desc' needs the arg-aware path; other tags go straight.
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

  // Commands (support /command@botname)
  const cmd = text?.match(/^\/([a-z_]+)(?:@[A-Za-z0-9_]+)?(?:\s+(.*))?$/);
  if (cmd) {
    const name = cmd[1].toLowerCase();
    const arg = (cmd[2] ?? '').trim();

    if (name === 'start') {
      await tgSend(
        chatId,
        '🚌 Welcome to SAMADHAN!\n\nReport a KSRTC issue in under a minute — ' +
          'a few taps, no forms. Your complaint is routed to the right depot automatically.',
        menuKb,
      );
      return json({ status: 'ok' });
    }
    if (name === 'help') {
      await tgSend(chatId, HELP, menuKb);
      return json({ status: 'ok' });
    }
    if (name === 'complain') {
      await askCategory(sb, chatId, {});
      return json({ status: 'ok' });
    }
    if (name === 'cancel') {
      await convClear(sb, chatId);
      await tgSend(chatId, 'Cancelled — nothing was filed.', menuKb);
      return json({ status: 'ok' });
    }
    if (name === 'my') {
      await sendMyComplaints(sb, chatId);
      return json({ status: 'ok' });
    }
    if (name === 'track') {
      if (!arg) {
        await tgSend(chatId, 'Send: /track KSRTC-XXXXXX');
        return json({ status: 'ok' });
      }
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

  // Active conversation consumes the text
  if (await handleFlow(sb, chatId, text)) return json({ status: 'ok' });

  // Bare text outside a flow: legacy pipe format still works; otherwise menu.
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
    // Looks like a complaint description: start the flow with it pre-filled.
    const cat = guessCategory(text);
    await askCategory(sb, chatId, { description: text, category: cat });
    await tgSend(chatId, `I guessed the category as ${CATEGORY_LABELS.get(cat) ?? cat} — confirm or change it 👆`);
    return json({ status: 'ok' });
  }

  await tgSend(chatId, 'Tap below to get started 👇', menuKb);
  return json({ status: 'ok' });
}

// ---------------------------------------------------------------------------
// Voice (Sarvam STT) — API key stays server-side
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
      return json({ status: 'ok', v: 3 });
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
