import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, BackendUnavailable } from '../lib/api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { ReferenceNumber } from '../components/common/ReferenceNumber';

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
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#171A19]">
      <span className={`w-2 h-2 rounded-full shrink-0 ${map[status] ?? 'bg-[#8B908B]'}`} />
      {label}
    </span>
  );
}

/**
 * Passenger account — "My trips" on the website.
 *
 * Identity model: the same chat_id the Telegram bot uses. Link once in the
 * bot (/link -> one-tap phone share); the site then reads the passenger's
 * saved trips and complaint history. The chat_id is stored in localStorage
 * after linking (nothing sensitive: complaints are anonymous by design).
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
  route_id: string | null;
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
}

export const MyAccount: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [chatId, setChatId] = useState<string | null>(getStoredChatId());
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [complaints, setComplaints] = useState<MyComplaint[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadAll(id: string) {
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
      else setError('Could not load your data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!chatId) return;
    void loadAll(chatId);
    // Live sync: poll while the panel is open.
    const timer = setInterval(() => void loadAll(chatId), 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

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
  if (paramId && !chatId) saveChatId(paramId);

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
          <h1 className="text-2xl font-extrabold tracking-tight">My Trips & Complaints</h1>
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
