import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth as useClerkAuth, SignInButton, UserButton } from '@clerk/react';
import { api, BackendUnavailable, type BackendMe } from '../lib/api/client';
import { clerkEnabled } from '../lib/clerk';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { ReferenceNumber } from '../components/common/ReferenceNumber';
import {
  FileText,
  Clock,
  CheckCircle2,
  Ticket,
  MapPin,
  AlertTriangle,
  LogIn,
} from 'lucide-react';

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    submitted: 'bg-[#8B908B]',
    needs_triage: 'bg-[#8B908B]',
    in_review: 'bg-[#A56B20] animate-pulse',
    escalated: 'bg-[#B34747]',
    resolved: 'bg-[#247A52]',
    closed: 'bg-[#247A52]',
  };
  const label = map[status]?.includes('B34747')
    ? 'Escalated'
    : status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#171A19] shrink-0">
      <span className={`w-2 h-2 rounded-full shrink-0 ${map[status] ?? 'bg-[#8B908B]'}`} />
      {label}
    </span>
  );
}

/**
 * Passenger account — everything one person owns, in one place.
 *
 * Identity: Clerk session (Google / email code). The Clerk JWT is verified
 * server-side, which merges the account with any Telegram-bot identity that
 * shares the same phone/email — so trips and complaints from the bot show
 * up here too. Without a Clerk key configured, the legacy Telegram chat
 * linking still works.
 */

const CHAT_KEY = 'samadhan_chat_id';

export function getStoredChatId(): string | null {
  try {
    return localStorage.getItem(CHAT_KEY);
  } catch {
    return null;
  }
}

interface Trip {
  route_label: string;
  bus_number: string | null;
  use_count: number;
}

interface MyComplaint {
  reference_id: string;
  category: string;
  status: string;
  depot: string | null;
  sla_breached: boolean;
  created_at: string;
  has_ticket?: boolean;
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: 'warning' | 'danger' | 'success';
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-[#B34747]'
      : tone === 'warning'
        ? 'text-[#A56B20]'
        : tone === 'success'
          ? 'text-[#247A52]'
          : 'text-[var(--text-primary)]';
  return (
    <div className="p-4 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--border-standard)]">
      <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]">
        {icon}
        {label}
      </div>
      <p className={`mt-1.5 text-2xl font-extrabold font-['Plus_Jakarta_Sans'] ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

export const MyAccount: React.FC = () => {
  const { isSignedIn, isLoaded } = clerkEnabled ? useClerkAuth() : { isSignedIn: false, isLoaded: true };
  const [searchParams, setSearchParams] = useSearchParams();
  const [chatId, setChatId] = useState<string | null>(getStoredChatId());
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<BackendMe | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [complaints, setComplaints] = useState<MyComplaint[]>([]);
  const [loading, setLoading] = useState(false);

  const signedIn = clerkEnabled && isSignedIn;

  async function loadAccount() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<BackendMe>('/api/v1/me?limit=20');
      setMe(data);
      setTrips((data.trips ?? []) as Trip[]);
      setComplaints(data.recent_complaints ?? []);
    } catch (e) {
      if (e instanceof BackendUnavailable) setError('Cannot reach the server — try again shortly.');
      else if (String(e).includes('401')) setError('Your session expired — refresh the page to sign in again.');
      else setError('Could not load your data.');
    } finally {
      setLoading(false);
    }
  }

  async function loadChat(id: string) {
    setLoading(true);
    setError(null);
    try {
      const [t, c] = await Promise.all([
        api<{ items: Trip[] }>(`/api/v1/my/trips?chat_id=${encodeURIComponent(id)}`),
        api<{ items: MyComplaint[] }>(`/api/v1/my/complaints?chat_id=${encodeURIComponent(id)}`),
      ]);
      setTrips(t.items ?? []);
      setComplaints(c.items ?? []);
    } catch (e) {
      if (e instanceof BackendUnavailable) setError('Cannot reach the server — try again shortly.');
      else if (String(e).includes('401')) {
        setError('Your Telegram account is not linked to a signed-in web account. Sign in with the same email or phone you used in the bot.');
      } else setError('Could not load your data.');
    } finally {
      setLoading(false);
    }
  }

  // Poll only while the tab is visible, and refresh immediately when it
  // becomes visible again (AUDIT.md M-6: ~90% fewer idle background requests).
  useEffect(() => {
    if (!signedIn && !(!clerkEnabled && chatId)) return;
    const load = () => (signedIn ? loadAccount() : loadChat(chatId as string));
    void load();
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(() => void load(), 15000);
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };
    const onVisibility = () => (document.hidden ? stop() : (void load(), start()));
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, chatId]);

  function saveChatId(id: string) {
    const clean = id.trim();
    if (!/^\d{4,}$/.test(clean)) {
      setError('That does not look like a chat ID (digits only).');
      return;
    }
    try {
      localStorage.setItem(CHAT_KEY, clean);
    } catch {
      /* storage restricted — session-only */
    }
    setChatId(clean);
    setSearchParams({});
  }

  // Deep link from the bot: /account?chat_id=12345 message contains the link.
  const paramId = searchParams.get('chat_id');
  useEffect(() => {
    if (paramId && !chatId && !signedIn) saveChatId(paramId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramId]);

  // -- Signed-in account view ------------------------------------------------
  if (signedIn) {
    const p = me?.profile;
    const s = me?.stats;
    return (
      <div className="max-w-3xl mx-auto py-10 px-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">My Account</h1>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              {p?.display_name || 'Passenger'}
              {p?.email ? ` · ${p.email}` : ''}
              {p?.telegram_chat_id ? ` · Telegram linked (${p.telegram_chat_id})` : ''}
              {' · '}Member since{' '}
              {p?.member_since ? new Date(p.member_since).toLocaleDateString() : '—'}
            </p>
          </div>
          {clerkEnabled && <UserButton />}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={<FileText className="w-3.5 h-3.5" />} label="Requests" value={s?.total_filed ?? 0} />
          <StatCard icon={<Clock className="w-3.5 h-3.5" />} label="Open" value={s?.open ?? 0} tone="warning" />
          <StatCard icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Resolved" value={s?.resolved ?? 0} tone="success" />
          <StatCard icon={<Ticket className="w-3.5 h-3.5" />} label="Tickets" value={s?.ticket_receipts ?? 0} />
          <StatCard icon={<MapPin className="w-3.5 h-3.5" />} label="Trips" value={s?.trips_saved ?? 0} />
          <StatCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="SLA breached" value={s?.sla_breached ?? 0} tone="danger" />
        </div>
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">
          “Tickets” counts filed complaints that carried a readable ticket photo — KSRTC exposes no
          booking feed, so this is your ticket-verified history, not purchases.
        </p>

        {/* Recent requests with reference IDs */}
        <section className="mt-8">
          <h2 className="text-[13px] font-mono font-bold tracking-wider text-[var(--brand)] uppercase">
            My reference IDs &amp; requests ({complaints.length})
          </h2>
          {loading && !complaints.length ? (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">Loading…</p>
          ) : complaints.length === 0 ? (
            <div className="mt-3 p-4 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--border-standard)]">
              <p className="text-sm text-[var(--text-secondary)]">
                Nothing yet. File your first complaint —{' '}
                <Link to="/file-complaint" className="text-[var(--brand)] font-semibold hover:underline">
                  from the web form
                </Link>{' '}
                or via the Telegram bot. Filed while signed in, they appear here automatically.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {complaints.map((c) => (
                <div
                  key={c.reference_id}
                  className="p-3 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--border-standard)] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <ReferenceNumber value={c.reference_id} />
                    <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                      {c.category.replace(/_/g, ' ')}
                      {c.depot ? ` · ${c.depot} depot` : ''}
                      {c.has_ticket ? ' · 🎫 ticket' : ''} · {new Date(c.created_at).toLocaleString()}
                    </p>
                  </div>
                  <StatusDot status={c.status} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Saved trips */}
        <section className="mt-8">
          <h2 className="text-[13px] font-mono font-bold tracking-wider text-[var(--brand)] uppercase">
            Saved trips ({trips.length})
          </h2>
          {loading && !trips.length ? (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">Loading…</p>
          ) : trips.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              No trips yet — file a complaint in the bot and your route is remembered here.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {trips.map((t, i) => (
                <div
                  key={`${t.route_label}-${i}`}
                  className="p-3 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--border-standard)] flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-[14px]">🚌 {t.route_label}</p>
                    {t.bus_number && (
                      <p className="text-[12px] text-[var(--text-secondary)]">Bus {t.bus_number}</p>
                    )}
                  </div>
                  <span className="text-[12px] text-[var(--text-secondary)]">{t.use_count}× used</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // -- Sign-in prompt (Clerk enabled: Google / email code buttons) ------------
  if (clerkEnabled) {
    return (
      <div className="max-w-xl mx-auto py-10 px-4 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">My Account</h1>
        <p className="mt-3 text-[15px] text-[var(--text-secondary)] leading-relaxed">
          Sign in to see every request you have filed, your reference IDs, their live status, and
          your saved trips — including anything filed through the Telegram bot on the same phone
          number.
        </p>
        {!isLoaded ? (
          <p className="mt-6 text-sm text-[var(--text-secondary)]">Loading sign-in…</p>
        ) : (
          <div className="mt-6 flex justify-center [&>div]:w-full [&_button]:w-full">
            <SignInButton mode="modal" fallbackRedirectUrl="/account">
              <Button variant="primary" size="lg" icon={<LogIn className="w-4 h-4" />}>
                Sign in with Google or Email
              </Button>
            </SignInButton>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // -- Demo mode (no Clerk key): legacy Telegram chat linking -----------------
  if (!chatId) {
    return (
      <div className="max-w-xl mx-auto py-10 px-4">
        <h1 className="text-2xl font-extrabold tracking-tight">My Account</h1>
        <p className="mt-3 text-[15px] text-[var(--text-secondary)] leading-relaxed">
          Link your account in the SAMADHAN Telegram bot: send <code className="font-mono bg-[var(--surface-primary)] px-1 rounded">/link</code> to
          {' '}@esamadhanbot and share your number in one tap. Then open the bot's
          <b> “🌐 My account (web)” </b> button — it brings you here with your trips loaded.
        </p>
        <div className="mt-6 p-4 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--border-standard)]">
          <p className="text-[13px] font-semibold mb-2">Or paste your chat ID manually</p>
          <Input
            label="Telegram chat ID"
            placeholder="e.g. 5044823931"
            value={manualInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualInput(e.target.value)}
          />
          <div className="mt-3">
            <Button onClick={() => saveChatId(manualInput)}>Load my data</Button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">My Trips &amp; Complaints</h1>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Live — refreshed every 15 seconds · chat {chatId}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            try { localStorage.removeItem(CHAT_KEY); } catch { /* noop */ }
            setChatId(null);
            setTrips([]);
            setComplaints([]);
          }}
        >
          Unlink
        </Button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <section className="mt-8">
        <h2 className="text-[13px] font-mono font-bold tracking-wider text-[var(--brand)] uppercase">
          Saved trips ({trips.length})
        </h2>
        {loading && !trips.length ? (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Loading…</p>
        ) : trips.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            No trips yet — file a complaint in the bot and your route is remembered here.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {trips.map((t, i) => (
              <div
                key={`${t.route_label}-${i}`}
                className="p-3 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--border-standard)] flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-[14px]">🚌 {t.route_label}</p>
                  {t.bus_number && (
                    <p className="text-[12px] text-[var(--text-secondary)]">Bus {t.bus_number}</p>
                  )}
                </div>
                <span className="text-[12px] text-[var(--text-secondary)]">{t.use_count}× used</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-mono font-bold tracking-wider text-[var(--brand)] uppercase">
          My complaints ({complaints.length})
        </h2>
        {loading && !complaints.length ? (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Loading…</p>
        ) : complaints.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">No complaints from your account yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {complaints.map((c) => (
              <div
                key={c.reference_id}
                className="p-3 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--border-standard)] flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <ReferenceNumber value={c.reference_id} />
                  <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                    {c.category}{c.depot ? ` · ${c.depot} depot` : ''} ·{' '}
                    {new Date(c.created_at).toLocaleString()}
                  </p>
                </div>
                <StatusDot status={c.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
