import type { ComplaintCategory, PublicTransparencyStats } from '../../types';

import { api, type BackendDashboardSummary } from './client';
import { complaintsService } from './complaintsService';

export const dashboardService = {
  async getPublicStats(): Promise<PublicTransparencyStats> {
    const s = await api<BackendDashboardSummary>('/api/v1/dashboard/summary');
    const total = s.complaints || 0;
    const resolvedCount = (s.by_status.resolved ?? 0) + (s.by_status.closed ?? 0);
    const entries = Object.entries(s.by_category);
    const catTotal = entries.reduce((n, [, c]) => n + c, 0) || 1;
    return {
      totalRegistered30Days: total,
      avgResolutionTimeHours: null,
      resolutionRatePercent: total ? Math.round((resolvedCount / total) * 100) : 0,
      activeEscalationRatePercent: total ? Math.round((s.escalations / total) * 100) : 0,
      categoryBreakdown: entries.map(([category, count]) => ({
        category: category as ComplaintCategory,
        count,
        percentage: Math.round((count / catTotal) * 100),
      })),
      depotBreakdown: [],
      monthlyTrend: [],
    };
  },

  async getAdminStats() {
    const all = await complaintsService.getAll();
    const total = all.length;
    const open = all.filter((c) => c.status === 'submitted' || c.status === 'assigned').length;
    const inProgress = all.filter((c) => c.status === 'in_progress' || c.status === 'acknowledged').length;
    const resolved = all.filter((c) => c.status === 'resolved').length;
    const breached = all.filter((c) => c.status === 'sla_breached' || c.status === 'escalated').length;

    return {
      total,
      open,
      inProgress,
      resolved,
      breached,
      averageResolutionHours: null,
      depots: [],
    };
  },
};
