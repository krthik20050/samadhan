import React, { createContext, useContext, useState } from 'react';
import type { ComplaintCategory, ComplaintData } from '../types';


export interface UploadedEvidence {
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  name: string;
}

export interface DraftComplaint {
  category: ComplaintCategory;
  origin: string;
  destination: string;
  via?: string;
  busNumber: string;
  location: string;
  description: string;
  audioTranscript?: string;
  preferredContactChannel: 'whatsapp' | 'sms' | 'email';
  contactPhone: string;
  evidenceFiles?: string[];
  /** Ticket photo read by the vision slot (raw payload kept for audit). */
  ticketExtracted?: Record<string, unknown> | null;
  travelDate?: string | null;
  /** Evidence already uploaded to the bucket (paths, not File objects). */
  uploadedEvidence?: UploadedEvidence[];
}

const DEFAULT_DRAFT: DraftComplaint = {
  category: 'cleanliness',
  origin: '',
  destination: '',
  via: '',
  busNumber: '',
  location: '',
  description: '',
  preferredContactChannel: 'whatsapp',
  contactPhone: '',
  evidenceFiles: [],
};

export interface ComplaintDraftContextType {
  draft: DraftComplaint;
  setDraft: React.Dispatch<React.SetStateAction<DraftComplaint>>;
  updateDraft: (fields: Partial<DraftComplaint>) => void;
  resetDraft: () => void;
  lastSubmittedComplaint: ComplaintData | null;
  setLastSubmittedComplaint: (complaint: ComplaintData | null) => void;
}

export const ComplaintDraftContext = createContext<ComplaintDraftContextType | undefined>(undefined);


export const ComplaintDraftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [draft, setDraft] = useState<DraftComplaint>(DEFAULT_DRAFT);
  const [lastSubmittedComplaint, setLastSubmittedComplaint] = useState<ComplaintData | null>(null);

  const updateDraft = (fields: Partial<DraftComplaint>) => {
    setDraft((prev) => ({ ...prev, ...fields }));
  };

  const resetDraft = () => {
    setDraft({
      category: 'cleanliness',
      origin: '',
      destination: '',
      via: '',
      busNumber: '',
      location: '',
      description: '',
      audioTranscript: '',
      preferredContactChannel: 'whatsapp',
      contactPhone: '',
    });
  };

  return (
    <ComplaintDraftContext.Provider
      value={{
        draft,
        setDraft,
        updateDraft,
        resetDraft,
        lastSubmittedComplaint,
        setLastSubmittedComplaint,
      }}
    >
      {children}
    </ComplaintDraftContext.Provider>
  );
};

export const useComplaintDraft = (): ComplaintDraftContextType => {
  const context = useContext(ComplaintDraftContext);
  if (!context) {
    throw new Error('useComplaintDraft must be used within a ComplaintDraftProvider');
  }
  return context;
};
