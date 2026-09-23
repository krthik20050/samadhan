import type { ComplaintData } from '../../types';
import { complaintsService } from './complaintsService';
import { INITIAL_COMPLAINTS } from '../mockData';

export const trackingService = {
  async trackByReference(refNumber: string): Promise<ComplaintData | null> {
    // Normalise reference number input (trim whitespace, uppercase)
    const cleaned = refNumber.trim().toUpperCase();
    if (!cleaned) return null;
    return complaintsService.getById(cleaned);
  },

  async getRecentSampleCases(): Promise<ComplaintData[]> {
    // Return curated public sample demonstration cases without querying admin master records
    return INITIAL_COMPLAINTS.slice(0, 4);
  },
};
