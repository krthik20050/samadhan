import type { ComplaintCategory, DepotStat, PublicTransparencyStats } from '../../types';

import { MOCK_DEPOTS, MOCK_PUBLIC_STATS } from '../mockData';
import { api, type BackendDashboardSummary } from './client';
import { complaintsService } from './complaintsService';

export const dashboardService = {
  async getPublicStats(): Promise<PublicTransparencyStats> {
    try {
      const s = await api<BackendDashboardSummary>('/api/v1/dashboard/summary');
      const total = s.complaints || 0;
      const resolvedCount = (s.by_status.resolved ?? 0) + (s.by_status.closed ?? 0);
      const entries = Object.entries(s.by_category);
      const catTotal = entries.reduce((n, [, c]) => n + c, 0) || 1;
      return {
        ...MOCK_PUBLIC_STATS, // ponytail: trend/depot splits stay static until backend exposes them
        totalRegistered30Days: total,
        resolutionRatePercent: total ? Math.round((resolvedCount / total) * 100) : 0,
        activeEscalationRatePercent: total ? Math.round((s.escalations / total) * 100) : 0,
        categoryBreakdown: entries.map(([category, count]) => ({
          category: category as ComplaintCategory,
          count,
          percentage: Math.round((count / catTotal) * 100),
        })),
      };
    } catch {
      await new Promise((res) => setTimeout(res, 200));
      return MOCK_PUBLIC_STATS;
    }
  },

  async getAdminStats() {
    await new Promise((res) => setTimeout(res, 200));
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
      averageResolutionHours: 11.8,
      depots: MOCK_DEPOTS as DepotStat[],
    };
  },
};
