import { useContext } from 'react';
import { ComplaintDraftContext } from '../context/ComplaintDraftContext';
import type { ComplaintDraftContextType } from '../context/ComplaintDraftContext';

export const useComplaintDraft = (): ComplaintDraftContextType => {
  const context = useContext(ComplaintDraftContext);
  if (!context) {
    throw new Error('useComplaintDraft must be used within a ComplaintDraftProvider');
  }
  return context;
};
