import React, { useState, useEffect, useCallback } from 'react';
import { dashboardService } from '../../lib/api';
import type { AdminAnalytics } from '../../lib/api/dashboardService';
import { MetricCard } from '../../components/admin/MetricCard';
import { EscalationBanner } from '../../components/admin/EscalationBanner';
import { ReferenceNumber } from '../../components/common/ReferenceNumber';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Building2,
  ArrowUpRight,
  MapPin,
  Ticket,
  Inbox,
} from 'lucide-react';

const POLL_MS = 20000;

function BarList({
  rows,
  emptyText,
}: {
  rows: Array<{ label: string; sub?: string; n: number }>;
  emptyText: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (rows.length === 0) {
    return <p className="text-[13px] text-[var(--text-secondary)]">{emptyText}</p>;
  }
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <span className="font-semibold text-[var(--text-primary)] truncate">
              {r.label}
              {r.sub && (
                <span className="ml-1.5 text-[11px] font-normal text-[var(--text-muted)]">{r.sub}</span>
              )}
            </span>
            <span className="font-mono font-medium text-[var(--text-primary)] shrink-0">{r.n}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-[var(--surface-secondary)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--brand)]"
              style={{ width: `${Math.round((r.n / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const s = await dashboardService.getAdminAnalytics();
      setStats(s);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(
        msg.includes('401') || msg.includes('403')
          ? 'Staff authorisation required — sign in with depot credentials.'
          : 'Cannot reach the analytics backend — retrying automatically.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Live sync: the panel reflects Telegram + web filings within seconds.
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <div className="w-8 h-8 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          Loading operational depot metrics...
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-12 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-[var(--semantic-error)] mx-auto" />
        <p className="text-sm font-medium text-[var(--text-primary)]">{error ?? 'Analytics unavailable.'}</p>
        <Link
          to="/login"
          className="inline-block px-3.5 py-2 rounded-[8px] bg-[var(--brand)] text-white text-[13px] font-medium hover:bg-[var(--brand-deep)] transition-all"
        >
          Go to Depot Login
        </Link>
      </div>
    );
  }

  const t = stats.totals;
  const topDistrict = stats.by_district[0];
  const openTotal = t.pending + t.in_review + t.escalated;

  return (
    <div className="space-y-6 text-left">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] font-['Plus_Jakarta_Sans']">
              Depot Operations Command
            </h1>
            <span className="text-[11px] font-mono font-bold uppercase bg-[var(--surface-secondary)] border border-[var(--border-standard)] text-[var(--brand)] px-2 py-0.5 rounded-[4px]">
              LIVE
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Real-time grievance intake across web and Telegram — refreshed every {POLL_MS / 1000}s.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/admin/depot/complaints"
            className="px-3.5 py-2 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--border-standard)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] active:scale-[0.98] transition-all"
          >
            Manage Grievances
          </Link>
          <Link
            to="/admin/depot/escalations"
            className="px-3.5 py-2 rounded-[8px] bg-[var(--brand)] text-white text-[13px] font-medium hover:bg-[var(--brand-deep)] active:scale-[0.98] transition-all"
          >
            Escalation Desk
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-[var(--surface-primary)] border border-[var(--semantic-warning)] rounded-[10px] p-3.5 text-[12px] text-[var(--text-secondary)]">
          {error} — showing the last successful load.
        </div>
      )}

      {/* Escalation Urgent Attention Alert */}
      <EscalationBanner breachCount={t.sla_breached} />

      {/* Core Operational KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          title="Received"
          value={t.received}
          subtitle={`+${t.today} today`}
          icon={<Inbox className="w-4 h-4" />}
        />
        <MetricCard
          title="Pending"
          value={t.pending}
          subtitle="Awaiting triage"
          icon={<FileText className="w-4 h-4 text-[var(--text-secondary)]" />}
        />
        <MetricCard
          title="In Review"
          value={t.in_review}
          subtitle={`+${t.escalated} escalated`}
          icon={<Clock className="w-4 h-4 text-[var(--semantic-warning)]" />}
          variant="warning"
        />
        <MetricCard
          title="Urgent Attention"
          value={t.urgent_attention}
          subtitle="High priority / SLA breached"
          icon={<AlertTriangle className="w-4 h-4 text-[var(--semantic-error)]" />}
          variant="danger"
        />
        <MetricCard
          title="Resolved"
          value={t.resolved}
          subtitle="Closed tickets"
          icon={<CheckCircle2 className="w-4 h-4 text-[var(--semantic-success)]" />}
          variant="success"
        />
        <MetricCard
          title="Ticket Receipts"
          value={t.ticket_receipts}
          subtitle="Ticket photos read at filing"
          icon={<Ticket className="w-4 h-4 text-[var(--brand)]" />}
        />
      </div>

      {/* District & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--surface-primary)] rounded-[14px] border border-[var(--border-standard)] p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-standard)] pb-3">
            <div>
              <h3 className="text-[17px] font-bold text-[var(--text-primary)] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[var(--brand)]" />
                <span>Complaints by District</span>
              </h3>
              <p className="text-[12px] text-[var(--text-secondary)]">
                {topDistrict
                  ? `Most complaints come from ${topDistrict.district} (${topDistrict.n}).`
                  : 'No district data yet.'}
              </p>
            </div>
          </div>
          <BarList
            rows={stats.by_district.map((d) => ({ label: d.district, n: d.n }))}
            emptyText="Complaints routed to depots will appear here."
          />
        </div>

        <div className="bg-[var(--surface-primary)] rounded-[14px] border border-[var(--border-standard)] p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-standard)] pb-3">
            <div>
              <h3 className="text-[17px] font-bold text-[var(--text-primary)] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--brand)]" />
                <span>Complaints by Category</span>
              </h3>
              <p className="text-[12px] text-[var(--text-secondary)]">
                {openTotal} open across all depots.
              </p>
            </div>
          </div>
          <BarList
            rows={stats.by_category.map((c) => ({
              label: c.category.replace(/_/g, ' '),
              n: c.n,
            }))}
            emptyText="No complaints filed yet."
          />
        </div>
      </div>

      {/* Depot Workload Grid */}
      <div className="bg-[var(--surface-primary)] rounded-[14px] border border-[var(--border-standard)] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-standard)] pb-3">
          <div>
            <h3 className="text-[17px] font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[var(--brand)]" />
              <span>Depot Workload &amp; SLA Compliance</span>
            </h3>
            <p className="text-[12px] text-[var(--text-secondary)]">
              Grievance allocation governed strictly by official route schedules.
            </p>
          </div>
          <span className="text-[12px] font-mono text-[var(--text-secondary)]">
            Last 7 days: <strong className="text-[var(--text-primary)]">{t.last_7d}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-standard)] text-[11px] font-mono font-bold uppercase text-[var(--text-muted)]">
                <th className="py-2.5 px-3">Depot</th>
                <th className="py-2.5 px-3">District</th>
                <th className="py-2.5 px-3 text-center">Total</th>
                <th className="py-2.5 px-3 text-center">Open</th>
                <th className="py-2.5 px-3 text-center">Resolved</th>
                <th className="py-2.5 px-3 text-center">SLA Breaches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-[13px]">
              {stats.by_depot.map((depot) => (
                <tr key={depot.depot} className="hover:bg-[var(--surface-secondary)] transition-colors">
                  <td className="py-3 px-3 font-semibold text-[var(--text-primary)]">{depot.depot}</td>
                  <td className="py-3 px-3 text-[var(--text-secondary)]">{depot.district}</td>
                  <td className="py-3 px-3 text-center font-mono font-medium text-[var(--text-primary)]">
                    {depot.total}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-block px-2 py-0.5 rounded-[4px] font-mono font-medium bg-[var(--bg-primary)] border border-[var(--border-standard)] text-[var(--text-primary)]">
                      {depot.open}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-[var(--semantic-success)] font-medium font-mono">
                    {depot.resolved}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {depot.breached > 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded-[4px] font-mono font-medium bg-[var(--surface-primary)] border border-[var(--semantic-error)] text-[var(--semantic-error)]">
                        {depot.breached} overdue
                      </span>
                    ) : (
                      <span className="text-[12px] font-mono text-[var(--text-muted)]">0 breaches</span>
                    )}
                  </td>
                </tr>
              ))}
              {stats.by_depot.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 px-3 text-center text-sm text-[var(--text-secondary)]">
                    Depot workload metrics are not available from the backend yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Grievances Log */}
      <div className="bg-[var(--surface-primary)] rounded-[14px] border border-[var(--border-standard)] p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-standard)] pb-3">
          <div>
            <h3 className="text-[17px] font-bold text-[var(--text-primary)]">
              Recent Grievances Awaiting Action
            </h3>
            <p className="text-[12px] text-[var(--text-secondary)]">
              Complainant contact info is anonymized in accordance with privacy UX guidelines.
            </p>
          </div>
          <Link
            to="/admin/depot/complaints"
            className="text-[13px] font-medium text-[var(--brand)] hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {stats.recent.map((item) => (
            <div
              key={item.reference_id}
              className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[var(--surface-secondary)] -mx-2 px-2 rounded-[8px] transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <ReferenceNumber value={item.reference_id} size="sm" showCopy={false} />
                  <span className="text-[11px] font-mono uppercase text-[var(--text-muted)] px-1.5 py-0.5 rounded-[4px] bg-[var(--bg-primary)] border border-[var(--border-standard)]">
                    {item.category.replace(/_/g, ' ')}
                  </span>
                  {item.sla_breached && (
                    <span className="text-[11px] font-mono font-bold uppercase text-[var(--semantic-error)] px-1.5 py-0.5 rounded-[4px] bg-[var(--surface-primary)] border border-[var(--semantic-error)]">
                      SLA breached
                    </span>
                  )}
                </div>
                <div className="text-[15px] font-bold text-[var(--text-primary)] capitalize">
                  {item.category.replace(/_/g, ' ')}
                </div>
                <p className="text-[13px] text-[var(--text-secondary)]">
                  {item.depot ? `${item.depot} depot` : 'Unrouted'}
                  {item.district ? ` · ${item.district} district` : ''} ·{' '}
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-4 text-[12px] text-[var(--text-secondary)] shrink-0">
                <span className="font-medium capitalize text-[var(--text-primary)]">
                  {item.status.replace(/_/g, ' ')}
                </span>
                <Link
                  to={`/track?ref=${item.reference_id}`}
                  className="px-3 py-1.5 rounded-[6px] border border-[var(--border-standard)] text-[12px] font-medium text-[var(--brand)] hover:bg-[var(--surface-secondary)] active:scale-[0.98] transition-all"
                >
                  Inspect
                </Link>
              </div>
            </div>
          ))}
          {stats.recent.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--text-secondary)]">
              No grievances yet — file one from the website or the Telegram bot.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
