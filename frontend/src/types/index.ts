export type ComplaintCategory =
  | 'cleanliness'
  | 'driver_conductor'
  | 'safety'
  | 'bus_condition'
  | 'delay_schedule'
  | 'route_service'
  | 'staff_behaviour'
  | 'accessibility'
  | 'ticketing'
  | 'other';

export type ComplaintStatus =
  | 'submitted'
  | 'assigned'
  | 'acknowledged'
  | 'in_progress'
  | 'sla_breached'
  | 'escalated'
  | 'resolved'
  | 'rejected';

export type PriorityLevel = 'normal' | 'high' | 'urgent';

export interface TimelineEvent {
  id: string;
  status: ComplaintStatus;
  title: string;
  titleMl?: string;
  description?: string;
  descriptionMl?: string;
  timestamp: string;
  actor?: string; // e.g. "Kozhikode Depot Duty Officer"
  isBreached?: boolean;
}


export interface ComplaintData {
  id: string;
  referenceNumber: string; // e.g. SAM-2026-001284
  createdAt: string;
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
  evidenceFiles?: Array<{ name: string; size: string; type: string }>;
  status: ComplaintStatus;
  assignedDepot?: {
    code: string;
    name: string;
    nameMl: string;
    zone: string;
    officerInCharge: string;
  };
  slaTargetHours: number;
  slaBreachTime?: string;
  isEscalated?: boolean;
  escalatedTo?: string; // e.g. "Zonal Executive Director (Central)"
  timeline: TimelineEvent[];
  passengerContact?: {
    preferredChannel: 'whatsapp' | 'sms' | 'email';
    anonymizedTarget: string; // e.g. "+91 98*** **421"
  };
}

export interface DepotStat {
  code: string;
  name: string;
  nameMl: string;
  zone: string;
  totalComplaints: number;
  openComplaints: number;
  resolvedComplaints: number;
  slaBreaches: number;
  averageResolutionHours: number;
}

export interface NotificationLogItem {
  id: string;
  complaintRef: string;
  channel: 'whatsapp' | 'sms' | 'email';
  recipientAnonymized: string;
  eventType: 'registered' | 'assigned' | 'in_progress' | 'escalated' | 'resolved';
  subject: string;
  messageContent: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
}

export interface PublicTransparencyStats {
  totalRegistered30Days: number;
  resolutionRatePercent: number;
  avgResolutionTimeHours: number;
  activeEscalationRatePercent: number;
  categoryBreakdown: { category: ComplaintCategory; count: number; percentage: number }[];
  depotBreakdown: { depotName: string; resolved: number; open: number }[];
  monthlyTrend: { month: string; received: number; resolved: number }[];
}

export type Language = 'en' | 'ml';
