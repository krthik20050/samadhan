import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useComplaintDraft } from '../hooks/useComplaintDraft';
import type { DraftComplaint } from '../context/ComplaintDraftContext';
import { useLanguage } from '../hooks/useLanguage';
import { VoiceRecorder } from '../components/voice/VoiceRecorder';
import { ExtractedDetailsCard } from '../components/complaint/ExtractedDetailsCard';
import { ArrowLeft, Volume2, ShieldCheck } from 'lucide-react';
import { Button } from '../components/common/Button';

export const VoiceComplaint: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { draft, updateDraft } = useComplaintDraft();

  const [step, setStep] = useState<'recording' | 'review_extracted'>('recording');

  const handleTranscriptionComplete = (result: {
    transcript: string;
    extracted: Partial<DraftComplaint>;
  }) => {
    updateDraft({
      ...result.extracted,
      audioTranscript: result.transcript,
    });
    setStep('review_extracted');
  };

  const handleConfirmExtracted = () => {
    navigate('/file-complaint/review');
  };

  return (
    <div className="app-container py-10 sm:py-16 max-w-3xl">
      {/* Top Navigation & Step Indicator */}
      <div className="flex items-center justify-between mb-8">
        <button
          type="button"
          onClick={() => (step === 'review_extracted' ? setStep('recording') : navigate('/file-complaint'))}
          className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{step === 'review_extracted' ? 'Record Voice Again' : 'Back to Options'}</span>
        </button>

        <div className="flex items-center gap-2 text-[12px] font-mono font-bold uppercase tracking-wider text-[var(--brand)]">
          <span>{step === 'recording' ? 'STEP 01: VOICE INTAKE' : 'STEP 02: VERIFICATION'}</span>
        </div>
      </div>

      {step === 'recording' ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-1.5">
            <h1 className="text-[30px] sm:text-[38px] font-extrabold text-[var(--text-primary)] tracking-tight font-['Plus_Jakarta_Sans']">
              {t('voicePromptHeading')}
            </h1>
            <p className="text-[15px] text-[var(--text-secondary)] max-w-lg mx-auto leading-relaxed">
              {t('voiceInstruction')}
            </p>
          </div>

          {/* Voice Recorder Component */}
          <VoiceRecorder
            onTranscriptionComplete={handleTranscriptionComplete}
            onCancel={() => navigate('/file-complaint')}
          />

          {/* Privacy Note */}
          <div className="mt-8 p-4 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--border-standard)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px] text-[var(--text-secondary)]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--brand)] shrink-0" />
              <span>Spoken audio is converted to text solely to register your grievance.</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/file-complaint')}
              className="text-[var(--brand)] font-medium hover:underline shrink-0 text-left sm:text-right"
            >
              Type instead
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-left space-y-1.5">
            <div className="inline-flex items-center gap-2 text-[12px] font-mono uppercase tracking-wider text-[var(--semantic-success)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--semantic-success)]" />
              <span>Voice Converted</span>
            </div>
            <h2 className="text-[28px] sm:text-[32px] font-extrabold text-[var(--text-primary)] tracking-tight font-['Plus_Jakarta_Sans']">
              Review What We Understood
            </h2>
            <p className="text-[15px] text-[var(--text-secondary)]">
              Inspect the extracted details below. You can edit any field before submitting.
            </p>
          </div>

          {/* Extracted Details Card with Inline Edit & Confirm Action */}
          <ExtractedDetailsCard
            draft={draft}
            onUpdate={updateDraft}
            onConfirm={handleConfirmExtracted}
          />

          <div className="flex justify-center pt-2">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setStep('recording')}
              icon={<Volume2 className="w-4 h-4" />}
            >
              Record voice again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
