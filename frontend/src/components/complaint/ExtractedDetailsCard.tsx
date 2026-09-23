import React, { useState } from 'react';
import type { DraftComplaint } from '../../context/ComplaintDraftContext';
import { COMPLAINT_CATEGORIES } from '../../lib/constants';
import { useLanguage } from '../../hooks/useLanguage';
import {
  MapPin,
  Bus,
  Edit3,
  Check,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface ExtractedDetailsCardProps {
  draft: DraftComplaint;
  onUpdate: (fields: Partial<DraftComplaint>) => void;
  onConfirm: () => void;
  isEditableDefault?: boolean;
}

export const ExtractedDetailsCard: React.FC<ExtractedDetailsCardProps> = ({
  draft,
  onUpdate,
  onConfirm,
  isEditableDefault = false,
}) => {
  const { language } = useLanguage();
  const [isEditing, setIsEditing] = useState(isEditableDefault);
  const [formData, setFormData] = useState<DraftComplaint>({ ...draft });

  const activeCategoryMeta = COMPLAINT_CATEGORIES.find((c) => c.id === draft.category);

  const handleSaveEdit = () => {
    onUpdate(formData);
    setIsEditing(false);
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header bar (Editorial Row, NO Box) */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-standard)]">
        <div>
          <h3 className="text-[17px] font-bold text-[var(--text-primary)]">
            Review structured details
          </h3>
          <p className="text-[13px] text-[var(--text-secondary)]">
            Extracted from spoken speech. You can edit any field.
          </p>
        </div>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--brand)] hover:underline cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSaveEdit}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--semantic-success)] hover:underline cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save edits</span>
          </button>
        )}
      </div>

      {/* Spoken Transcript Preview */}
      {draft.audioTranscript && (
        <div className="space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] block">
            Original Spoken Transcript:
          </span>
          <p className="text-[14px] italic text-[var(--text-primary)] leading-relaxed">
            “{draft.audioTranscript}”
          </p>
        </div>
      )}

      {/* Document Fields Breakdown (NO Nested Cards) */}
      {!isEditing ? (
        <div className="divide-y divide-[var(--border-standard)] border-t border-b border-[var(--border-standard)]">
          {/* Route */}
          <div className="py-4 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              <MapPin className="w-3.5 h-3.5 text-[var(--brand)]" />
              <span>Route</span>
            </div>
            <div className="text-[18px] font-bold text-[var(--text-primary)]">
              {draft.origin || 'Origin stop'} → {draft.destination || 'Destination stop'}
            </div>
            {draft.via && (
              <div className="text-[13px] text-[var(--text-secondary)]">
                Via: {draft.via}
              </div>
            )}
          </div>

          {/* Category */}
          <div className="py-4 space-y-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              Issue Category
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold text-[var(--text-primary)]">
                {language === 'ml'
                  ? activeCategoryMeta?.labelMl
                  : activeCategoryMeta?.labelEn}
              </span>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                {activeCategoryMeta?.slaHours}h target window
              </span>
            </div>
          </div>

          {/* Bus Number & Location */}
          <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                <Bus className="w-3.5 h-3.5 text-[var(--brand)]" />
                <span>Bus / Fleet Number</span>
              </div>
              <div className="text-[15px] font-mono font-medium text-[var(--text-primary)] mt-0.5">
                {draft.busNumber || 'Pending verification'}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Location
              </div>
              <div className="text-[14px] text-[var(--text-primary)] mt-0.5">
                {draft.location || 'Inside passenger coach'}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="py-4 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              <FileText className="w-3.5 h-3.5 text-[var(--brand)]" />
              <span>Grievance Summary</span>
            </div>
            <div className="text-[14px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
              {draft.description}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Origin (Starting Stop)"
              value={formData.origin}
              onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
              placeholder="e.g. Guruvayur"
            />
            <Input
              label="Destination (Ending Stop)"
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              placeholder="e.g. Kozhikode"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[var(--text-primary)]">
                Grievance Category
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    category: e.target.value as DraftComplaint['category'],
                  })
                }
                className="w-full bg-[var(--surface-primary)] text-[var(--text-primary)] border border-[var(--border-standard)] rounded-[10px] py-2.5 px-3 text-[14px] h-[48px] focus:outline-none focus:border-[var(--brand)]"
              >
                {COMPLAINT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Bus Registration (Optional)"
              value={formData.busNumber}
              onChange={(e) => setFormData({ ...formData, busNumber: e.target.value })}
              placeholder="e.g. KL-15-A-4892"
            />
          </div>

          <Input
            label="Location on Bus or Stop"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="e.g. Middle row seats"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--text-primary)]">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-[var(--surface-primary)] text-[var(--text-primary)] border border-[var(--border-standard)] rounded-[10px] p-3 text-[14px] focus:outline-none focus:border-[var(--brand)]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFormData({ ...draft });
                setIsEditing(false);
              }}
            >
              Cancel Edits
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Depot notice */}
      <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
        <AlertCircle className="w-4 h-4 text-[var(--brand)] shrink-0" />
        <span>Operating depot will be resolved from official route schedules.</span>
      </div>

      {!isEditing && (
        <div className="pt-2 flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            className="font-medium"
            onClick={onConfirm}
            icon={<Check className="w-4 h-4" />}
          >
            Looks Correct — Continue
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setIsEditing(true)}
          >
            Edit Details
          </Button>
        </div>
      )}
    </div>
  );
};
