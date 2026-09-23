// Thin authenticated fetch wrapper.
// Services call the backend through this function.
// Clerk provides the current session token through setTokenGetter().

const BASE = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
).replace(/\/+$/, '');

export class BackendUnavailable extends Error {}

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

/**
 * Registers the Clerk token getter.
 *
 * AuthContext calls this once Clerk is available.
 */
export function setTokenGetter(getToken: TokenGetter) {
  tokenGetter = getToken;
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const ctrl = new AbortController();

  const timer = setTimeout(() => ctrl.abort(), 15000);

  try {
    const headers = new Headers(init.headers);

    // Ask Clerk for the current session token.
    if (tokenGetter) {
      const token = await tokenGetter();

      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers,
      signal: ctrl.signal,
    });

    if (!res.ok) {
      throw new Error(`Backend ${res.status}`);
    }

    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof BackendUnavailable) {
      throw e;
    }
    if (e instanceof Error && e.message.startsWith('Backend ')) {
      throw e;
    }

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