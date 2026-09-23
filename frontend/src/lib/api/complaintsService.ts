import type { ComplaintCategory, ComplaintData, ComplaintStatus, TimelineEvent } from '../../types';
import { authService } from '../auth';
import {
  api,
  type BackendComplaintOut,
  type BackendDashboardItem,
  type BackendTrack,
} from './client';

export interface SubmitComplaintPayload {
  category: ComplaintCategory;
  route: {
    origin: string;
    destination: string;
    via?: string;
  };
  busNumber?: string;
  location: string;
  description: string;
  audioTranscript?: string;
  preferredContactChannel?: 'whatsapp' | 'sms' | 'email';
  contactPhone?: string;
}

// UI categories -> backend Category enum
const CATEGORY_TO_BACKEND: Record<string, string> = {
  cleanliness: 'cleanliness',
  driver_conductor: 'staff_behaviour',
  safety: 'unsafe_driving',
  bus_condition: 'bus_condition',
  delay_schedule: 'missed_stop',
  route_service: 'other',
  staff_behaviour: 'staff_behaviour',
  accessibility: 'other',
  ticketing: 'ticketing',
  other: 'other',
};

// Backend Category enum -> UI categories (display only)
const CATEGORY_FROM_BACKEND: Record<string, ComplaintCategory> = {
  cleanliness: 'cleanliness',
  unsafe_driving: 'safety',
  overcrowding: 'delay_schedule',
  missed_stop: 'route_service',
  concession_denied: 'ticketing',
  ticketing: 'ticketing',
  staff_behaviour: 'staff_behaviour',
  bus_condition: 'bus_condition',
  other: 'other',
};

const STATUS_FROM_BACKEND: Record<string, ComplaintStatus> = {
  submitted: 'submitted',
  needs_triage: 'submitted',
  in_review: 'in_progress',
  escalated: 'escalated',
  resolved: 'resolved',
  closed: 'resolved',
};

const mapStatus = (s: string): ComplaintStatus => STATUS_FROM_BACKEND[s] ?? 'submitted';
const mapCategory = (c: string): ComplaintCategory => CATEGORY_FROM_BACKEND[c] ?? 'other';

function anonymize(phone?: string): string {
  return phone
    ? `${phone.substring(0, 4)}***${phone.substring(phone.length - 2)}`
    : 'ANON-USR-421';
}

function stamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 16);
}

function fromTrack(t: BackendTrack): ComplaintData {
  const timeline: TimelineEvent[] = (t.history ?? []).map((h, i) => ({
    id: `h-${t.reference_id}-${i}`,
    status: mapStatus(h.to_status),
    title: `Status updated to ${h.to_status.replace(/_/g, ' ').toUpperCase()}`,
    timestamp: h.created_at,
    actor: h.changed_by ?? undefined,
  }));
  if (timeline.length === 0) {
    timeline.push({
      id: `h-${t.reference_id}-0`,
      status: 'submitted',
      title: 'Grievance Registered',
      titleMl: 'പരാതി സമർപ്പിച്ചു',
      timestamp: t.created_at,
      actor: 'Passenger (Anonymized)',
    });
  }
  return {
    id: t.reference_id,
    referenceNumber: t.reference_id,
    createdAt: t.created_at,
    category: mapCategory(t.category),
    route: { origin: t.route_text ?? '', destination: t.route_text ?? '' },
    busNumber: t.bus_number ?? undefined,
    location: '',
    description: '',
    status: mapStatus(t.status),
    assignedDepot: t.depot
      ? { code: '', name: t.depot, nameMl: t.depot, zone: '', officerInCharge: '' }
      : undefined,
    slaTargetHours: 24,
    slaBreachTime: t.sla_breached ? t.created_at : undefined,
    isEscalated: t.status === 'escalated',
    timeline,
  };
}

function fromDashboardItem(d: BackendDashboardItem): ComplaintData {
  return {
    id: d.reference_id,
    referenceNumber: d.reference_id,
    createdAt: d.created_at,
    category: mapCategory(d.category),
    route: { origin: '', destination: '' },
    location: '',
    description: '',
    status: mapStatus(d.status),
    assignedDepot: d.depot
      ? { code: '', name: d.depot, nameMl: d.depot, zone: '', officerInCharge: '' }
      : undefined,
    slaTargetHours: 24,
    isEscalated: d.status === 'escalated',
    timeline: [],
  };
}

export const complaintsService = {
  async getAll(): Promise<ComplaintData[]> {
    // Data breach protection: only authenticated depot admin accounts can query master registry
    if (!authService.isAdmin()) {
      throw new Error('Access Denied: Administrative authorization required to query global grievance records.');
    }
    const data = await api<{ items: BackendDashboardItem[] }>('/api/v1/dashboard/complaints?limit=100&offset=0');
    return data.items.map(fromDashboardItem);
  },

  async getById(id: string): Promise<ComplaintData | null> {
    const cleaned = id.trim();
    try {
      const t = await api<BackendTrack>(`/api/v1/complaints/${encodeURIComponent(cleaned.toUpperCase())}`);
      return fromTrack(t);
    } catch (e) {
      if (e instanceof Error && e.message === 'Backend 404') return null;
      throw e;
    }
  },

  async submitComplaint(payload: SubmitComplaintPayload): Promise<ComplaintData> {
    const routeText = `${payload.route.origin} → ${payload.route.destination}${payload.route.via ? ` via ${payload.route.via}` : ''}`;
    const out = await api<BackendComplaintOut>('/api/v1/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bus_number: payload.busNumber || null,
          route_text: routeText,
          category: CATEGORY_TO_BACKEND[payload.category] ?? 'other',
          location_text: payload.location || null,
          description: payload.description,
          contact_phone: payload.contactPhone || null,
        }),
      });
      const nowIso = new Date().toISOString();
      const timeline: TimelineEvent[] = [
        {
          id: `t-${out.reference_id}-1`,
          status: 'submitted',
          title: 'Grievance Registered',
          titleMl: 'പരാതി സമർപ്പിച്ചു',
          description: 'Passenger grievance recorded via Samadhan platform.',
          descriptionMl: 'യാത്രക്കാരന്റെ പരാതി രേഖപ്പെടുത്തി സ്ഥിരീകരിച്ചു.',
          timestamp: stamp(),
          actor: 'Passenger (Anonymized)',
        },
      ];
      if (out.depot) {
        timeline.push({
          id: `t-${out.reference_id}-2`,
          status: 'assigned',
          title: `Assigned to ${out.depot}`,
          timestamp: stamp(),
          actor: 'Samadhan Route Dispatch Engine',
        });
      }
    return {
        id: out.reference_id,
        referenceNumber: out.reference_id,
        createdAt: nowIso,
        category: payload.category,
        route: payload.route,
        busNumber: payload.busNumber,
        location: payload.location,
        description: payload.description,
        audioTranscript: payload.audioTranscript,
        status: mapStatus(out.status),
        assignedDepot: out.depot
          ? { code: '', name: out.depot, nameMl: out.depot, zone: '', officerInCharge: '' }
          : undefined,
        slaTargetHours: 24,
        timeline,
        passengerContact: {
          preferredChannel: payload.preferredContactChannel || 'whatsapp',
          anonymizedTarget: anonymize(payload.contactPhone),
        },
    };
  },

  async updateStatus(
    refNumber: string,
    newStatus: ComplaintData['status'],
    note?: string
  ): Promise<ComplaintData | null> {
    if (!authService.isAdmin()) {
      throw new Error('Access Denied: Administrative authorization required to update grievance status.');
    }
    void refNumber;
    void newStatus;
    void note;
    throw new Error('Status updates are not available from the configured backend.');
  },
};
