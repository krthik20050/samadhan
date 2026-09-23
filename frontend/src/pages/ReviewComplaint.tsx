import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useComplaintDraft } from '../hooks/useComplaintDraft';
import { useLanguage } from '../hooks/useLanguage';
import { COMPLAINT_CATEGORIES } from '../lib/constants';
import { complaintsService } from '../lib/api';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  FileText,
  MapPin,
  Bus,
  Tag,
  Paperclip,
  ShieldCheck,
} from 'lucide-react';

export const ReviewComplaint: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { draft, updateDraft, setLastSubmittedComplaint } = useComplaintDraft();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const [phone, setPhone] = useState(draft.contactPhone || '');
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'email'>(
    draft.preferredContactChannel || 'whatsapp'
  );

  const activeCategory = COMPLAINT_CATEGORIES.find((c) => c.id === draft.category) || COMPLAINT_CATEGORIES[0];

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const result = await complaintsService.submitComplaint({
        category: draft.category,
        route: {
          origin: draft.origin || 'Guruvayur',
          destination: draft.destination || 'Kozhikode',
          via: draft.via,
        },
        busNumber: draft.busNumber,
        location: draft.location || 'Onboard bus',
        description: draft.description || 'Grievance reported by passenger.',
        audioTranscript: draft.audioTranscript,
        contactPhone: phone.trim() ? phone.trim() : undefined,
        preferredContactChannel: channel,
      });

      updateDraft({
        contactPhone: phone.trim(),
        preferredContactChannel: channel,
      });

      setLastSubmittedComplaint(result);
      navigate('/file-complaint/success');
    } catch (err) {
      console.error(err);
      setSubmissionError('We couldn’t reach SAMADHAN right now. Your complaint details are still here.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-container py-12 sm:py-16 text-left max-w-3xl">
      {/* Top back button */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate('/file-complaint?step=2')}
          className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Edit details</span>
        </button>
      </div>

      {/* Step Header */}
      <div className="mb-8 space-y-2">
        <div className="text-[12px] font-mono font-bold tracking-wider text-[var(--brand)] uppercase">
          STEP 03 / 03
        </div>
        <h1 className="text-[34px] sm:text-[42px] font-extrabold text-[var(--text-primary)] tracking-tight font-['Plus_Jakarta_Sans'] leading-tight">
          Review your complaint.
        </h1>
        <p className="text-[16px] text-[var(--text-secondary)] max-w-xl leading-relaxed">
          Please verify the information below. Once submitted, your grievance is assigned to the operating depot for time-bound resolution.
        </p>
      </div>

      {submissionError && (
        <div className="mb-6 p-4 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--semantic-error)] text-[var(--semantic-error)] text-[14px] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Unable to submit right now</div>
            <p className="text-[13px] mt-0.5">{submissionError}</p>
            <button
              type="button"
              onClick={handleSubmit}
              className="mt-2 text-[12px] font-mono uppercase underline font-bold"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Review Structure (Editorial Flow with 1px Separators) */}
      <div className="divide-y divide-[var(--border-standard)] border-t border-b border-[var(--border-standard)]">
        {/* WHAT YOU REPORTED */}
        <div className="py-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[var(--brand)]" />
              <span>WHAT YOU REPORTED</span>
            </span>
            <button
              type="button"
              onClick={() => navigate('/file-complaint?step=1')}
              className="text-[13px] font-medium text-[var(--brand)] hover:underline cursor-pointer"
            >
              Edit
            </button>
          </div>
          <p className="text-[15px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
            {draft.description || 'No description provided.'}
          </p>
        </div>

        {/* JOURNEY ROUTE */}
        <div className="py-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[var(--brand)]" />
              <span>JOURNEY ROUTE</span>
            </span>
            <button
              type="button"
              onClick={() => navigate('/file-complaint?step=2')}
              className="text-[13px] font-medium text-[var(--brand)] hover:underline cursor-pointer"
            >
              Edit
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-3">
            <span className="text-[20px] font-bold text-[var(--text-primary)]">
              {draft.origin || 'Not specified'}
            </span>
            <span className="text-[var(--text-muted)] hidden sm:inline">→</span>
            <span className="text-[20px] font-bold text-[var(--text-primary)]">
              {draft.destination || 'Not specified'}
            </span>
          </div>

          {draft.via && (
            <div className="text-[13px] text-[var(--text-secondary)]">
              Via: <span className="text-[var(--text-primary)] font-medium">{draft.via}</span>
            </div>
          )}

          <div className="text-[12px] text-[var(--text-secondary)] pt-1">
            Route identified. The appropriate operating depot will be assigned automatically.
          </div>
        </div>

        {/* CATEGORY */}
        <div className="py-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[var(--brand)]" />
              <span>CATEGORY</span>
            </span>
            <button
              type="button"
              onClick={() => navigate('/file-complaint?step=1')}
              className="text-[13px] font-medium text-[var(--brand)] hover:underline cursor-pointer"
            >
              Edit
            </button>
          </div>
          <div className="text-[16px] font-bold text-[var(--text-primary)]">
            {language === 'ml' ? activeCategory.labelMl : activeCategory.labelEn}
          </div>
        </div>

        {/* BUS & LOCATION (IF PROVIDED) */}
        {(draft.busNumber || (draft.location && draft.location !== 'Onboard bus')) && (
          <div className="py-5 space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Bus className="w-3.5 h-3.5 text-[var(--brand)]" />
              <span>VEHICLE & LOCATION</span>
            </div>
            <div className="flex flex-wrap gap-6 text-[14px]">
              {draft.busNumber && (
                <div>
                  <span className="text-[var(--text-secondary)] text-[12px] block">Bus Registration:</span>
                  <span className="font-mono font-medium text-[var(--text-primary)]">{draft.busNumber}</span>
                </div>
              )}
              {draft.location && draft.location !== 'Onboard bus' && (
                <div>
                  <span className="text-[var(--text-secondary)] text-[12px] block">Location:</span>
                  <span className="text-[var(--text-primary)]">{draft.location}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* EVIDENCE (IF PROVIDED) */}
        {draft.evidenceFiles && draft.evidenceFiles.length > 0 && (
          <div className="py-5 space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-[var(--brand)]" />
              <span>EVIDENCE ATTACHED</span>
            </div>
            <div className="flex flex-wrap gap-2 text-[13px]">
              {draft.evidenceFiles.map((file, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-[6px] bg-[var(--surface-primary)] border border-[var(--border-standard)] font-mono text-[var(--text-primary)]"
                >
                  {file}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* NOTIFICATION PREFERENCES */}
        <div className="py-6 space-y-4">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] block">
              STATUS NOTIFICATIONS
            </span>
            <div className="text-[14px] text-[var(--text-secondary)] mt-0.5">
              Where should we send your tracking reference and depot action updates?
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Mobile Number (Optional)"
              type="tel"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              helperText="Only used to send reference code and resolution milestones."
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[var(--text-primary)]">
                Updates Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as 'whatsapp' | 'sms' | 'email')}
                className="w-full bg-[var(--surface-primary)] text-[var(--text-primary)] border border-[var(--border-standard)] rounded-[10px] py-2.5 px-3 text-[14px] h-[48px] focus:outline-none focus:border-[var(--brand)]"
              >
                <option value="whatsapp">WhatsApp (Recommended)</option>
                <option value="sms">SMS Text</option>
                <option value="email">Email</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
            <ShieldCheck className="w-4 h-4 text-[var(--brand)] shrink-0" />
            <span>Complainant identity is protected under public transport privacy guidelines.</span>
          </div>
        </div>
      </div>

      {/* Confirmation & Submit Action Bar */}
      <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/file-complaint?step=2')}
          className="text-[14px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 cursor-pointer order-2 sm:order-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Edit details</span>
        </button>

        <div className="flex items-center gap-4 w-full sm:w-auto order-1 sm:order-2">
          <span className="text-[14px] text-[var(--text-secondary)] hidden md:inline">
            Everything look right?
          </span>

          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            icon={isSubmitting ? undefined : <ArrowRight className="w-4 h-4" />}
            iconPosition="right"
            className="w-full sm:w-auto font-semibold px-8 h-[48px]"
          >
            {isSubmitting ? 'Submitting your complaint…' : 'Submit Complaint'}
          </Button>
        </div>
      </div>
    </div>
  );
};
