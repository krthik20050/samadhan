import type { ComplaintCategory, PublicTransparencyStats } from '../../types';
import { api, type BackendAnalytics, type BackendDashboardSummary } from './client';
import { staffSession } from '../auth';

export interface AdminAnalytics extends BackendAnalytics {}

/** Staff bearer for analytics when the officer signed in with the shared token. */
function staffAuthHeaders(): HeadersInit | undefined {
  const token = staffSession.token();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

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

  async getAdminAnalytics(): Promise<AdminAnalytics> {
    // Works with either credential: the shared staff token (depot login) or a
    // Clerk session whose publicMetadata.role is 'admin' — the API client
    // resolves the right bearer automatically; the staff header wins if present.
    const headers = staffAuthHeaders();
    return api<AdminAnalytics>('/api/v1/admin/analytics', headers ? { headers } : undefined);
  },
};
