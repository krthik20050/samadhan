// Typed API client. Never surfaces raw backend detail strings to users.
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new ApiError(res.status, userMessage(res.status));
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, "Network error — check your connection and retry.");
  } finally {
    clearTimeout(timer);
  }
}

function userMessage(status: number): string {
  if (status === 404) return "Not found — check the reference ID and retry.";
  if (status === 422) return "Some fields need fixing — see below.";
  return "Something went wrong on our side — please retry.";
}

export const CATEGORIES = [
  ["cleanliness", "Cleanliness"],
  ["unsafe_driving", "Unsafe driving"],
  ["overcrowding", "Overcrowding"],
  ["missed_stop", "Missed stop"],
  ["concession_denied", "Concession denied"],
  ["ticketing", "Ticketing"],
  ["staff_behaviour", "Staff behaviour"],
  ["bus_condition", "Bus condition"],
  ["other", "Other"],
] as const;

export const PUBLIC_STATUS: Record<string, string> = {
  submitted: "Received",
  needs_triage: "Received",
  in_review: "In review",
  escalated: "In review",
  resolved: "Resolved",
  closed: "Resolved",
};

export interface ComplaintCreated {
  reference_id: string;
  status: string;
  depot: string | null;
  sla_due_at: string | null;
}

export interface TrackedComplaint extends ComplaintCreated {
  bus_number: string | null;
  route_text: string | null;
  category: string;
  priority: string;
  sla_breached: boolean;
  created_at: string;
  history: { from_status: string | null; to_status: string; changed_by: string | null; created_at: string }[];
}

export interface DashboardSummary {
  complaints: number;
  sla_breaches: number;
  escalations: number;
  needs_triage: number;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
}

export interface DashboardItem {
  reference_id: string;
  category: string;
  status: string;
  priority: string;
  depot: string | null;
  sla_breached: boolean;
  created_at: string;
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  createComplaint: (body: Record<string, unknown>) =>
    request<ComplaintCreated>("/api/v1/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  track: (ref: string) =>
    request<TrackedComplaint>(`/api/v1/complaints/${encodeURIComponent(ref.trim().toUpperCase())}`),
  dashboardSummary: () => request<DashboardSummary>("/api/v1/dashboard/summary"),
  dashboardComplaints: (limit = 20, offset = 0) =>
    request<{ items: DashboardItem[]; total: number; limit: number; offset: number }>(
      `/api/v1/dashboard/complaints?limit=${limit}&offset=${offset}`
    ),
};
