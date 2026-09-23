import React, { createContext, useContext, useState } from 'react';
import type { ComplaintCategory, ComplaintData } from '../types';


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
}

const DEFAULT_DRAFT: DraftComplaint = {
  category: 'cleanliness',
  origin: 'Guruvayur',
  destination: 'Kozhikode',
  via: 'Ponnani - Tirur',
  busNumber: 'KL-15-A-4892',
  location: 'Middle row seats',
  description: 'The seats in the middle row were very dirty and had snack wrappers left behind.',
  audioTranscript: 'I have a cleanliness complaint about the bus travelling from Guruvayur to Kozhikode. The middle seats are dirty.',
  preferredContactChannel: 'whatsapp',
  contactPhone: '9847012345',
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
