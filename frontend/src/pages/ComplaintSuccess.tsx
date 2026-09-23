import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useComplaintDraft } from '../hooks/useComplaintDraft';
import { ReferenceNumber } from '../components/common/ReferenceNumber';
import { Button } from '../components/common/Button';
import { ArrowRight, Check } from 'lucide-react';

export const ComplaintSuccess: React.FC = () => {
  const navigate = useNavigate();
  const { lastSubmittedComplaint, draft } = useComplaintDraft();

  const referenceNumber = lastSubmittedComplaint?.referenceNumber || 'SAM-2026-001429';
  const origin = lastSubmittedComplaint?.route?.origin || draft.origin || 'Guruvayur';
  const destination = lastSubmittedComplaint?.route?.destination || draft.destination || 'Kozhikode';
  const depotName = lastSubmittedComplaint?.assignedDepot?.name || 'Assigned Operating Depot';
  const channel = draft.preferredContactChannel || 'WhatsApp';

  return (
    <div className="app-container py-12 sm:py-16 text-left max-w-2xl">
      {/* Small subtle checkmark indicator */}
      <div className="w-10 h-10 rounded-full bg-[var(--brand)] text-white flex items-center justify-center mb-6">
        <Check className="w-5 h-5 stroke-[2.5]" />
      </div>

      {/* Main Title */}
      <div className="space-y-2 mb-8">
        <h1 className="text-[34px] sm:text-[42px] font-extrabold text-[var(--text-primary)] tracking-tight font-['Plus_Jakarta_Sans'] leading-tight">
          Complaint received.
        </h1>
        <p className="text-[16px] text-[var(--text-secondary)] leading-relaxed">
          Your grievance has been registered and forwarded to the operating depot. You can use this reference to track your complaint.
        </p>
      </div>

      {/* Reference Number Block */}
      <div className="py-6 border-t border-b border-[var(--border-standard)] space-y-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] block">
          YOUR REFERENCE NUMBER
        </span>
        <ReferenceNumber value={referenceNumber} size="lg" />
      </div>

      {/* Clean Structured Receipt */}
      <div className="divide-y divide-[var(--border-standard)] border-b border-[var(--border-standard)] text-[14px]">
        <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-[var(--text-secondary)]">Route</span>
          <span className="font-bold text-[var(--text-primary)]">
            {origin} → {destination}
          </span>
        </div>

        <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-[var(--text-secondary)]">Assigned Depot</span>
          <span className="font-medium text-[var(--text-primary)]">{depotName}</span>
        </div>

        <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-[var(--text-secondary)]">Updates via</span>
          <span className="capitalize font-medium text-[var(--brand)]">{channel}</span>
        </div>
      </div>

      {/* Primary & Secondary Actions */}
      <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
        <Button
          variant="primary"
          size="lg"
          onClick={() => navigate(`/track?ref=${referenceNumber}`)}
          icon={<ArrowRight className="w-4 h-4" />}
          iconPosition="right"
          className="w-full sm:w-auto font-semibold px-8"
        >
          Track Complaint
        </Button>

        <Link to="/" className="w-full sm:w-auto">
          <Button
            variant="secondary"
            size="lg"
            className="w-full sm:w-auto font-medium"
          >
            Done
          </Button>
        </Link>
      </div>
    </div>
  );
};
