import React, { useState, useEffect } from 'react';
import { dashboardService, complaintsService } from '../../lib/api';
import type { ComplaintData, DepotStat } from '../../types';
import { MetricCard } from '../../components/admin/MetricCard';
import { EscalationBanner } from '../../components/admin/EscalationBanner';
import { Badge } from '../../components/common/Badge';
import { ReferenceNumber } from '../../components/common/ReferenceNumber';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Building2,
  ArrowUpRight,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    breached: number;
    averageResolutionHours: number | null;
    depots: DepotStat[];
  } | null>(null);
  const [recentComplaints, setRecentComplaints] = useState<ComplaintData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([dashboardService.getAdminStats(), complaintsService.getAll()])
      .then(([statsRes, allComplaints]) => {
        setStats(statsRes);
        setRecentComplaints(allComplaints.slice(0, 5));
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading || !stats) {
    return (
      <div className="p-12 text-center">
        <div className="w-8 h-8 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          Loading operational depot metrics...
        </p>
      </div>
    );
  }

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
              OPERATIONS SANDBOX
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Real-time public transport grievance intake, SLA compliance, and automated escalation management.
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

      {/* Backend data notice */}
      <div className="bg-[var(--surface-primary)] border border-[var(--border-standard)] rounded-[10px] p-3.5 flex items-start gap-2.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] mt-1.5 shrink-0" />
        <div className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
          <strong className="text-[var(--text-primary)] font-medium">Live backend data:</strong> Metrics and complaint records below are read from the configured grievance API.
        </div>
      </div>

      {/* Escalation Urgent Attention Alert */}
      <EscalationBanner breachCount={stats.breached} />

      {/* 4 Core Operational KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Registered"
          value={stats.total}
          subtitle="All active routes"
          icon={<FileText className="w-4 h-4" />}
        />
        <MetricCard
          title="In Investigation"
          value={stats.inProgress}
          subtitle="Depot officers active"
          icon={<Clock className="w-4 h-4 text-[var(--semantic-warning)]" />}
          variant="warning"
        />
        <MetricCard
          title="SLA Breaches"
          value={stats.breached}
          subtitle="Auto-escalated to DTO"
          icon={<AlertTriangle className="w-4 h-4 text-[var(--semantic-error)]" />}
          variant="danger"
        />
        <MetricCard
          title="Resolved"
          value={stats.resolved}
          subtitle="Within Citizen Charter"
          icon={<CheckCircle2 className="w-4 h-4 text-[var(--semantic-success)]" />}
          variant="success"
        />
      </div>

      {/* Depot Workload Grid */}
      <div className="bg-[var(--surface-primary)] rounded-[14px] border border-[var(--border-standard)] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-standard)] pb-3">
          <div>
            <h3 className="text-[17px] font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[var(--brand)]" />
              <span>Depot Workload & SLA Compliance</span>
            </h3>
            <p className="text-[12px] text-[var(--text-secondary)]">
              Grievance allocation governed strictly by official route schedules.
            </p>
          </div>
          <span className="text-[12px] font-mono text-[var(--text-secondary)]">
            Avg Resolution:             <strong className="text-[var(--text-primary)]">
              {stats.averageResolutionHours === null ? 'Not available' : `${stats.averageResolutionHours} Hours`}
            </strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-standard)] text-[11px] font-mono font-bold uppercase text-[var(--text-muted)]">
                <th className="py-2.5 px-3">Depot</th>
                <th className="py-2.5 px-3">Zone</th>
                <th className="py-2.5 px-3 text-center">Open Cases</th>
                <th className="py-2.5 px-3 text-center">Resolved</th>
                <th className="py-2.5 px-3 text-center">SLA Breaches</th>
                <th className="py-2.5 px-3 text-right">Avg Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-[13px]">
              {stats.depots.map((depot) => (
                <tr key={depot.code} className="hover:bg-[var(--surface-secondary)] transition-colors">
                  <td className="py-3 px-3 font-semibold text-[var(--text-primary)]">
                    <div>{depot.name}</div>
                    <div className="text-[11px] text-[var(--text-muted)] font-normal">
                      {depot.nameMl}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-[var(--text-secondary)]">{depot.zone}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-block px-2 py-0.5 rounded-[4px] font-mono font-medium bg-[var(--bg-primary)] border border-[var(--border-standard)] text-[var(--text-primary)]">
                      {depot.openComplaints}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-[var(--semantic-success)] font-medium font-mono">
                    {depot.resolvedComplaints}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {depot.slaBreaches > 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded-[4px] font-mono font-medium bg-[var(--surface-primary)] border border-[var(--semantic-error)] text-[var(--semantic-error)]">
                        {depot.slaBreaches} overdue
                      </span>
                    ) : (
                      <span className="text-[12px] font-mono text-[var(--text-muted)]">0 breaches</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-medium text-[var(--text-primary)]">
                    {depot.averageResolutionHours}h
                  </td>
                </tr>
              ))}
              {stats.depots.length === 0 && (
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
          {recentComplaints.map((item) => (
            <div key={item.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[var(--surface-secondary)] -mx-2 px-2 rounded-[8px] transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ReferenceNumber value={item.referenceNumber} size="sm" showCopy={false} />
                  <Badge variant="status" status={item.status} />
                  <span className="text-[11px] font-mono uppercase text-[var(--text-muted)] px-1.5 py-0.5 rounded-[4px] bg-[var(--bg-primary)] border border-[var(--border-standard)]">
                    {item.category.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-[15px] font-bold text-[var(--text-primary)]">
                  {item.route.origin} → {item.route.destination}
                </div>
                <p className="text-[13px] text-[var(--text-secondary)] line-clamp-1 max-w-2xl">
                  {item.description}
                </p>
              </div>

              <div className="flex items-center gap-4 text-[12px] text-[var(--text-secondary)] shrink-0">
                <div className="text-right">
                  <div className="font-medium text-[var(--text-primary)]">{item.assignedDepot?.name}</div>
                  <div className="font-mono text-[11px]">SLA: {item.slaTargetHours}h target</div>
                </div>
                <Link
                  to={`/track?ref=${item.referenceNumber}`}
                  className="px-3 py-1.5 rounded-[6px] border border-[var(--border-standard)] text-[12px] font-medium text-[var(--brand)] hover:bg-[var(--surface-secondary)] active:scale-[0.98] transition-all"
                >
                  Inspect
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
