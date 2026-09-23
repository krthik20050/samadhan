import React, { useState, useEffect } from 'react';
import { complaintsService } from '../../lib/api';
import type { ComplaintData } from '../../types';
import { ReferenceNumber } from '../../components/common/ReferenceNumber';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  CheckCircle,
} from 'lucide-react';

export const AdminEscalations: React.FC = () => {
  const [escalatedCases, setEscalatedCases] = useState<ComplaintData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    complaintsService.getAll().then((all) => {
      // Find cases that have breached SLA or are escalated
      const breachedOrEscalated = all.filter(
        (c) => c.status === 'sla_breached' || c.status === 'escalated' || c.isEscalated
      );
      setEscalatedCases(breachedOrEscalated);
      setIsLoading(false);
    });
  }, []);

  const handleResolveEscalation = async (refNumber: string) => {
    await complaintsService.updateStatus(
      refNumber,
      'resolved',
      'DTO Intervention: Issue investigated with depot authorities and disciplinary/corrective actions completed.'
    );
    const updated = await complaintsService.getAll();
    setEscalatedCases(
      updated.filter((c) => c.status === 'sla_breached' || c.status === 'escalated' || c.isEscalated)
    );
  };

  return (
    <div className="space-y-6 text-left">
      {/* Title */}
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[6px] bg-[var(--surface-primary)] border border-[var(--semantic-error)] text-[var(--semantic-error)] text-[11px] font-mono font-bold uppercase tracking-wider mb-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>AUTOMATED CITIZEN CHARTER SLA MONITOR</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] font-['Plus_Jakarta_Sans']">
          Escalations & SLA Breach Command
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Grievances that exceeded depot SLA thresholds are automatically forwarded to District Transport Officers (DTO) and Zonal Directors.
        </p>
      </div>

      {/* Escalation Hierarchy Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--border-standard)]">
          <div className="text-[11px] font-mono uppercase text-[var(--text-muted)] tracking-wider">
            Tier 1: Depot Level
          </div>
          <div className="text-[16px] font-bold text-[var(--text-primary)] mt-1">
            Depot Grievance Officer
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] mt-1">
            Initial 0 - 12h resolution window for operational grievances.
          </p>
        </div>

        <div className="p-4 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--semantic-error)]">
          <div className="text-[11px] font-mono font-bold uppercase text-[var(--semantic-error)] tracking-wider">
            Tier 2: District Level (Active)
          </div>
          <div className="text-[16px] font-bold text-[var(--semantic-error)] mt-1">
            District Transport Officer (DTO)
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] mt-1">
            12 - 24h breach. Direct executive intervention and inquiry.
          </p>
        </div>

        <div className="p-4 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--border-standard)]">
          <div className="text-[11px] font-mono uppercase text-[var(--text-muted)] tracking-wider">
            Tier 3: Apex Level
          </div>
          <div className="text-[16px] font-bold text-[var(--text-primary)] mt-1">
            Zonal Executive Director
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] mt-1">
            24h+ critical breach. State transport governance review.
          </p>
        </div>
      </div>

      {/* Active Escalated Cases */}
      <div className="bg-[var(--surface-primary)] rounded-[14px] border border-[var(--border-standard)] p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-standard)] pb-3">
          <div>
            <h3 className="text-[17px] font-bold text-[var(--text-primary)]">
              Active Escalated Grievances ({escalatedCases.length})
            </h3>
            <p className="text-[12px] text-[var(--text-secondary)]">
              These cases have triggered red-alerts across operating depots.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
            Scanning depot logs for SLA overruns...
          </div>
        ) : escalatedCases.length === 0 ? (
          <div className="p-8 text-center bg-[var(--bg-primary)] rounded-[10px] border border-[var(--border-standard)]">
            <CheckCircle className="w-7 h-7 text-[var(--semantic-success)] mx-auto mb-2" />
            <p className="font-bold text-[var(--text-primary)]">No Active SLA Breaches</p>
            <p className="text-[12px] text-[var(--text-secondary)]">
              All assigned complaints are currently being resolved within Citizen Charter time limits.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {escalatedCases.map((c) => (
              <div
                key={c.id}
                className="p-4 sm:p-5 rounded-[10px] border border-[var(--semantic-error)] bg-[var(--surface-primary)] space-y-3.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <ReferenceNumber value={c.referenceNumber} size="sm" />
                    <Badge variant="status" status={c.status} />
                    <span className="text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded-[4px] bg-[var(--semantic-error)] text-white">
                      Escalated to: {c.escalatedTo || 'DTO Office'}
                    </span>
                  </div>
                  <div className="text-[12px] font-mono text-[var(--semantic-error)] font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Breach Window: Exceeded {c.slaTargetHours}h SLA</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-[11px] font-mono uppercase text-[var(--text-muted)]">Route:</span>
                    <p className="font-bold text-[var(--text-primary)] mt-0.5">
                      {c.route.origin} → {c.route.destination}
                    </p>
                    <p className="text-[11px] font-mono text-[var(--text-muted)]">Bus: {c.busNumber}</p>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono uppercase text-[var(--text-muted)]">Default Depot:</span>
                    <p className="font-bold text-[var(--text-primary)] mt-0.5">
                      {c.assignedDepot?.name || 'Assigned Depot'}
                    </p>
                    <p className="text-[12px] text-[var(--text-secondary)]">
                      Officer: {c.assignedDepot?.officerInCharge}
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono uppercase text-[var(--text-muted)]">Complainant Updates:</span>
                    <p className="font-mono text-[12px] text-[var(--text-primary)] mt-0.5">
                      {c.passengerContact?.anonymizedTarget}
                    </p>
                    <p className="text-[11px] text-[var(--brand)] capitalize">
                      {c.passengerContact?.preferredChannel} auto-alerts on
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[var(--bg-primary)] rounded-[8px] border border-[var(--border-standard)] text-[13px] text-[var(--text-primary)]">
                  <strong>Grievance:</strong> {c.description}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1.5 text-[12px] text-[var(--semantic-error)] font-medium font-mono">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Executive inquiry file #ESC-{c.referenceNumber.slice(-4)} opened</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleResolveEscalation(c.referenceNumber)}
                    >
                      Record DTO Resolution & Close
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
