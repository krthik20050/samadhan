// Dataset-backed lookups: routes + depots from the KSRTC scrape
// (backend GET /api/v1/routes, /api/v1/depots — see scripts/import_dataset.py).
// Falls back to an empty list, never to fake routes: an unresolvable route
// must reach the backend as free text and become needs_triage, not pretend.
import { api } from './client';

export interface BackendRouteOption {
  id: string;
  name: string;
  origin: string;
  destination: string;
  service_type: string | null;
  depot_name: string | null;
  auto_routable: boolean;
}

export interface BackendDepotOption {
  id: string;
  name: string;
  district: string | null;
  phone: string | null;
  email: string | null;
  zone: string | null;
  verified_routes: number;
}

export interface RouteSuggestion {
  id: string;
  name: string;
  origin: string;
  destination: string;
  serviceType: string | null;
  depotName: string | null;
  autoRoutable: boolean;
}

export interface DepotInfo {
  id: string;
  name: string;
  district: string | null;
  phone: string | null;
  email: string | null;
  zone: string | null;
  verifiedRoutes: number;
}

function mapRoute(r: BackendRouteOption): RouteSuggestion {
  return {
    id: r.id,
    name: r.name,
    origin: r.origin,
    destination: r.destination,
    serviceType: r.service_type,
    depotName: r.depot_name,
    autoRoutable: r.auto_routable,
  };
}

export const lookupService = {
  /** Route suggestions for the complaint form. Empty on backend outage. */
  async searchRoutes(q: string, limit = 50): Promise<RouteSuggestion[]> {
    try {
      const data = await api<{ items: BackendRouteOption[] }>(
        `/api/v1/routes?q=${encodeURIComponent(q)}&limit=${limit}`
      );
      return data.items.map(mapRoute);
    } catch {
      return [];
    }
  },

  /** Depot directory (verified route counts from the dataset). */
  async listDepots(q = '', limit = 300): Promise<DepotInfo[]> {
    try {
      const data = await api<{ items: BackendDepotOption[] }>(
        `/api/v1/depots?q=${encodeURIComponent(q)}&limit=${limit}`
      );
      return data.items.map((d) => ({
        id: d.id,
        name: d.name,
        district: d.district,
        phone: d.phone,
        email: d.email,
        zone: d.zone,
        verifiedRoutes: d.verified_routes,
      }));
    } catch {
      return [];
    }
  },
};
