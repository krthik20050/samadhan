// ponytail: `getToken` is injected by AuthContext to avoid an import cycle
// (AuthContext imports services that import this module). It resolves the
// Clerk session token for signed-in users; staff endpoints use the staff
// token which this module reads directly.
let getToken: (() => Promise<string | null>) | null = null;

export function setAuthTokenProvider(fn: () => Promise<string | null>): void {
  getToken = fn;
}

async function bearerToken(): Promise<string | null> {
  if (getToken) {
    try {
      const t = await getToken();
      if (t) return t;
    } catch {
      /* fall through to staff token */
    }
  }
  // Staff-only fallback: depot officers signed in with the shared token.
  // (Dynamic import avoids a static cycle with lib/auth.)
  const { staffSession } = await import('../auth');
  return staffSession.token();
}

const BASE = (
  import.meta.env.VITE_API_URL ??
  'https://ikipstqlumypppfypdrx.supabase.co/functions/v1/api'
).replace(/\/+$/, '');

export class BackendUnavailable extends Error {}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  const headers = new Headers(init?.headers);
  const token = await bearerToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Backend ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Backend ')) throw e;
    throw new BackendUnavailable('backend unreachable');
  } finally {
    clearTimeout(timer);
  }
}

// Mirror backend pydantic schemas (backend/app/schemas/*)
export interface BackendComplaintOut {
  reference_id: string;
  status: string;
  depot: string | null;
  sla_due_at: string | null;
}

export interface BackendHistoryItem {
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  created_at: string;
}

export interface BackendTrack {
  reference_id: string;
  bus_number: string | null;
  route_text: string | null;
  category: string;
  priority: string;
  status: string;
  depot: string | null;
  sla_due_at: string | null;
  sla_breached: boolean;
  created_at: string;
  history: BackendHistoryItem[];
}

export interface BackendDashboardItem {
  reference_id: string;
  category: string;
  status: string;
  priority: string;
  depot: string | null;
  sla_breached: boolean;
  created_at: string;
}

export interface BackendDashboardSummary {
  complaints: number;
  sla_breaches: number;
  escalations: number;
  needs_triage: number;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
}

// -- /api/v1/me (user account panel) ----------------------------------------
export interface BackendMe {
  profile: {
    id: string;
    email: string | null;
    phone: string | null;
    display_name: string | null;
    telegram_chat_id: number | null;
    role: string;
    member_since: string;
  };
  stats: {
    total_filed: number;
    open: number;
    resolved: number;
    sla_breached: number;
    ticket_receipts: number;
    trips_saved: number;
  };
  recent_complaints: Array<{
    reference_id: string;
    category: string;
    status: string;
    priority: string;
    depot: string | null;
    district: string | null;
    route_text: string | null;
    bus_number: string | null;
    has_ticket: boolean;
    sla_breached: boolean;
    created_at: string;
  }>;
  trips: Array<{
    route_id: string | null;
    route_label: string;
    bus_number: string | null;
    use_count: number;
    last_used_at: string;
  }>;
}

// -- /api/v1/admin/analytics -------------------------------------------------
export interface BackendAnalytics {
  totals: {
    received: number;
    today: number;
    last_7d: number;
    pending: number;
    in_review: number;
    escalated: number;
    resolved: number;
    sla_breached: number;
    urgent_attention: number;
    ticket_receipts: number;
  };
  by_category: Array<{ category: string; n: number }>;
  by_district: Array<{ district: string; n: number }>;
  by_depot: Array<{
    depot: string;
    district: string;
    total: number;
    open: number;
    resolved: number;
    breached: number;
  }>;
  recent: Array<{
    reference_id: string;
    category: string;
    status: string;
    priority: string;
    depot: string | null;
    district: string | null;
    sla_breached: boolean;
    created_at: string;
  }>;
}
