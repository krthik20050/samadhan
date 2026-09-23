import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { trackingService } from '../lib/api';
import type { ComplaintData } from '../types';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { ReferenceNumber } from '../components/common/ReferenceNumber';
import { ComplaintTimeline } from '../components/complaint/ComplaintTimeline';
import {
  Search,
  RotateCcw,
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Complaint received',
  assigned: 'Assigned for review',
  acknowledged: 'Under review',
  in_progress: 'Action in progress',
  resolved: 'Resolved',
  sla_breached: 'SLA Overdue',
  escalated: 'Escalated to DTO',
  rejected: 'Rejected',
};

export const TrackComplaint: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [refInput, setRefInput] = useState(searchParams.get('ref') || '');
  const [isLoading, setIsLoading] = useState(() => Boolean(searchParams.get('ref')));
  const [complaint, setComplaint] = useState<ComplaintData | null>(null);
  const [searched, setSearched] = useState(() => Boolean(searchParams.get('ref')));
  const [sampleCases, setSampleCases] = useState<ComplaintData[]>([]);

  const handleSearch = async (refCodeToSearch?: string) => {
    const code = refCodeToSearch || refInput;
    if (!code.trim()) return;

    setIsLoading(true);
    setSearched(true);

    try {
      const result = await trackingService.trackByReference(code);
      setComplaint(result);
      if (result) {
        setSearchParams({ ref: result.referenceNumber });
      }
    } catch (err) {
      console.error(err);
      setComplaint(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    trackingService.getRecentSampleCases().then((cases) => {
      if (!ignore) setSampleCases(cases);
    });

    const refQuery = searchParams.get('ref');
    if (refQuery) {
      trackingService.trackByReference(refQuery).then((result) => {
        if (!ignore) {
          setComplaint(result);
          setIsLoading(false);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [searchParams]);

  const handleSelectSample = (sample: ComplaintData) => {
    setRefInput(sample.referenceNumber);
    handleSearch(sample.referenceNumber);
  };

  return (
    <div className="app-container py-12 sm:py-16 text-left max-w-3xl">
      {/* Page Header (Editorial Left Alignment) */}
      <div className="mb-8 space-y-2">
        <div className="text-[12px] font-mono font-bold tracking-wider text-[var(--brand)] uppercase">
          STATUS LOOKUP
        </div>
        <h1 className="text-[34px] sm:text-[42px] font-extrabold text-[var(--text-primary)] tracking-tight font-['Plus_Jakarta_Sans'] leading-tight">
          Track a complaint.
        </h1>
        <p className="text-[16px] text-[var(--text-secondary)] max-w-xl leading-relaxed">
          Enter your reference number below to check depot assignment, inspection status, and resolution progress.
        </p>
      </div>

      {/* Search Input Row (NO Giant Card Around Input) */}
      <div className="mb-10 space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex flex-col sm:flex-row items-end gap-3"
        >
          <div className="flex-1 w-full">
            <Input
              label="Complaint Reference Number"
              placeholder="e.g. SAM-2026-001284"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-[var(--text-muted)]" />}
              className="font-mono uppercase font-bold text-[15px]"
              required
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            className="w-full sm:w-auto font-medium px-8 shrink-0 h-[48px]"
          >
            Track Status
          </Button>
        </form>

        {/* Prototype Sample Cases */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[12px]">
          <span className="font-mono text-[11px] uppercase text-[var(--text-muted)]">Demo references:</span>
          {sampleCases.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => handleSelectSample(sample)}
              className={`px-2 py-0.5 rounded-[4px] border font-mono transition-colors cursor-pointer ${
                complaint?.referenceNumber === sample.referenceNumber
                  ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                  : 'bg-[var(--surface-primary)] text-[var(--text-secondary)] border-[var(--border-standard)] hover:text-[var(--text-primary)]'
              }`}
            >
              {sample.referenceNumber}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="py-12 text-left space-y-2">
          <div className="w-6 h-6 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[14px] text-[var(--text-secondary)]">
            Retrieving your complaint…
          </p>
        </div>
      )}

      {/* Empty / Not Found State */}
      {!isLoading && searched && !complaint && (
        <div className="py-8 space-y-3">
          <h3 className="text-[18px] font-bold text-[var(--text-primary)]">
            We couldn’t locate that complaint.
          </h3>
          <p className="text-[14px] text-[var(--text-secondary)] max-w-md">
            Check the reference number format (e.g. SAM-2026-001284), or select an active demo reference above.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleSelectSample(sampleCases[0])}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Load Sample Case
          </Button>
        </div>
      )}

      {/* Loaded Result (Simple Document Layout: REFERENCE, STATUS, CURRENT STEP, TIMELINE) */}
      {!isLoading && complaint && (
        <div className="space-y-8 pt-4 border-t border-[var(--border-standard)]">
          {/* REFERENCE NUMBER & STATUS */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] block">
                REFERENCE NUMBER
              </span>
              <div className="mt-1">
                <ReferenceNumber value={complaint.referenceNumber} size="lg" />
              </div>
            </div>

            <div className="sm:text-right">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] block">
                CURRENT STATUS
              </span>
              <div className="inline-flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${
                  complaint.status === 'resolved'
                    ? 'bg-[var(--semantic-success)]'
                    : complaint.status === 'sla_breached' || complaint.status === 'escalated'
                    ? 'bg-[var(--semantic-error)]'
                    : 'bg-[var(--brand)]'
                }`} />
                <span className="font-semibold text-[14px] text-[var(--text-primary)]">
                  {STATUS_LABELS[complaint.status] || complaint.status}
                </span>
              </div>
            </div>
          </div>

          {/* Structured Details (Thin Rules, NO Box inside Box) */}
          <div className="divide-y divide-[var(--border-standard)] border-t border-b border-[var(--border-standard)] text-[14px]">
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-[var(--text-secondary)]">Route & Corridor</span>
              <span className="font-bold text-[var(--text-primary)]">
                {complaint.route.origin} → {complaint.route.destination}
                {complaint.route.via && <span className="font-normal text-[var(--text-secondary)]"> (Via {complaint.route.via})</span>}
              </span>
            </div>

            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-[var(--text-secondary)]">Assigned Operating Depot</span>
              <span className="font-bold text-[var(--text-primary)]">
                {complaint.assignedDepot?.name || 'Assigned Depot'} ({complaint.assignedDepot?.zone})
              </span>
            </div>

            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-[var(--text-secondary)]">Citizen Charter Target</span>
              <span className="font-mono text-[var(--text-primary)]">
                Within {complaint.slaTargetHours} Hours
                {complaint.isEscalated && (
                  <span className="text-[var(--semantic-error)] font-bold ml-2">[Auto-escalated to DTO]</span>
                )}
              </span>
            </div>

            <div className="py-3.5 space-y-1">
              <span className="text-[var(--text-secondary)] block">Reported Grievance</span>
              <p className="text-[var(--text-primary)] leading-relaxed">
                {complaint.description}
              </p>
            </div>
          </div>

          {/* TIMELINE SECTION */}
          <div className="space-y-4 pt-2">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] block">
                TIMELINE
              </span>
              <h2 className="text-[20px] font-bold text-[var(--text-primary)] mt-0.5">
                Resolution progress
              </h2>
            </div>

            <ComplaintTimeline
              timeline={complaint.timeline}
              isEscalated={complaint.isEscalated}
              slaBreachTime={complaint.slaBreachTime}
            />
          </div>
        </div>
      )}
    </div>
  );
};
