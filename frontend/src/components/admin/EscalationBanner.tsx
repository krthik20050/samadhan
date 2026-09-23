import React from 'react';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EscalationBannerProps {
  breachCount: number;
  oldestBreachRef?: string;
  depotName?: string;
}

export const EscalationBanner: React.FC<EscalationBannerProps> = ({
  breachCount,
  oldestBreachRef = 'SAM-2026-000982',
  depotName = 'Palakkad Depot',
}) => {
  if (breachCount <= 0) return null;

  return (
    <div className="w-full bg-[var(--surface-primary)] border border-[var(--semantic-error)] rounded-[12px] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
      <div className="flex items-start sm:items-center gap-3.5">
        <div className="w-9 h-9 rounded-[8px] bg-[var(--surface-secondary)] border border-[var(--semantic-error)] text-[var(--semantic-error)] flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-[15px] font-bold text-[var(--semantic-error)]">
              {breachCount} Grievances Breached Official Depot SLA
            </h4>
            <span className="text-[10px] font-mono font-bold uppercase bg-[var(--semantic-error)] text-white px-1.5 py-0.5 rounded-[4px]">
              ACTION REQUIRED
            </span>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Active escalation: Case <span className="font-mono font-bold text-[var(--text-primary)]">{oldestBreachRef}</span> at {depotName} exceeded resolution window and is escalated to DTO.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden lg:flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] font-mono">
          <Clock className="w-3.5 h-3.5 text-[var(--semantic-warning)]" />
          <span>Auto-escalation active</span>
        </div>
        <Link
          to="/admin/depot/escalations"
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-[8px] bg-[var(--semantic-error)] hover:opacity-90 text-white text-[13px] font-medium transition-all active:scale-[0.98]"
        >
          <span>Review Escalations</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
