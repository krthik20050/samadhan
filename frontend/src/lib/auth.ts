/**
 * STAFF SESSION (depot officers).
 *
 * Passengers authenticate with Clerk (Google / email code) — see AuthContext.
 * Depot staff keep the single shared operational secret (ADMIN_API_TOKEN):
 * the backend verifies it server-side, so the role can never be granted
 * from the client. The secret is held in sessionStorage only and sent as
 * the staff Bearer token.
 */

export type UserRole = 'admin' | 'passenger';

const STORAGE_KEY = 'samadhan_staff_session';

export interface StaffSession {
  name: string;
  token: string;
  loginTime: string;
}

export const staffSession = {
  save(name: string, token: string): void {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ name, token, loginTime: new Date().toISOString() } satisfies StaffSession),
      );
    } catch {
      /* restricted storage — session-only */
    }
  },

  get(): StaffSession | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as StaffSession;
      return s && typeof s.token === 'string' && s.token ? s : null;
    } catch {
      return null;
    }
  },

  token(): string | null {
    return staffSession.get()?.token ?? null;
  },

  clear(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
};
