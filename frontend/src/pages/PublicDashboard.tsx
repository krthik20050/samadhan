import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Lock,
} from 'lucide-react';

export const PublicDashboard: React.FC = () => {
  return (
    <div className="app-container py-12 sm:py-16 text-left max-w-3xl space-y-12">
      {/* Header */}
      <div className="space-y-2">
        <div className="text-[12px] font-mono font-bold uppercase tracking-wider text-[var(--brand)]">
          PUBLIC SERVICE TRANSPARENCY
        </div>
        <h1 className="text-[34px] sm:text-[42px] font-extrabold text-[var(--text-primary)] tracking-tight font-['Plus_Jakarta_Sans'] leading-tight">
          Public insights & oversight.
        </h1>
        <p className="text-[16px] text-[var(--text-secondary)] max-w-xl leading-relaxed">
          SAMADHAN provides public oversight on transport grievances, depot response times, and resolution compliance across Kerala routes.
        </p>
      </div>

      {/* Verified Data State (Editorial Callout, NO Giant Card Inside Card) */}
      <div className="py-6 border-t border-b border-[var(--border-standard)] space-y-3">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] block">
          DATA INTEGRITY COMMITMENT
        </span>
        <h2 className="text-[20px] font-bold text-[var(--text-primary)]">
          Public insights will publish here once verified depot records accumulate.
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
          In strict accordance with our public data integrity principles, SAMADHAN does not display fabricated charts, synthetic resolution percentages, or artificial volumes. Real operational metrics will automatically publish as depots process cases.
        </p>

        <div className="pt-2">
          <Link
            to="/admin/depot"
            className="text-[13px] font-mono text-[var(--brand)] hover:underline inline-flex items-center gap-1.5"
          >
            <span>Inspect Depot Operations Command</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Transparency Architecture Framework */}
      <div className="space-y-6">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] block">
            REPORTING METRICS
          </span>
          <h2 className="text-[20px] font-bold text-[var(--text-primary)] mt-0.5">
            Three core public accountability dimensions
          </h2>
        </div>

        <div className="divide-y divide-[var(--border-standard)] border-t border-b border-[var(--border-standard)] text-left">
          <div className="py-5 space-y-1">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[16px] font-bold text-[var(--text-primary)]">
                01 Issue Distribution
              </h3>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">Category breakdown</span>
            </div>
            <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
              Standardized breakdown across cleanliness, trip delays, bus condition, rash driving, and crew conduct across operating depots.
            </p>
          </div>

          <div className="py-5 space-y-1">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[16px] font-bold text-[var(--text-primary)]">
                02 Depot SLA Compliance
              </h3>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">Time-bound resolution</span>
            </div>
            <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
              Percentage of grievances investigated and resolved within Citizen Charter windows (6h to 24h).
            </p>
          </div>

          <div className="py-5 space-y-1">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[16px] font-bold text-[var(--text-primary)]">
                03 Supervisory Escalation Frequency
              </h3>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">Executive oversight</span>
            </div>
            <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
              Tracked instances where unresolved grievances automatically escalated to District Transport Officers (DTO) and Zonal Directors.
            </p>
          </div>
        </div>
      </div>

      {/* Complainant Identity Protection */}
      <div className="pt-2 flex items-start gap-3 text-[13px] text-[var(--text-secondary)]">
        <Lock className="w-4 h-4 text-[var(--brand)] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Identity Protection:</strong> Public oversight reports contain only aggregated statistics. Passenger names, phone numbers, and unverified allegations are strictly confidential.
        </p>
      </div>
    </div>
  );
};
