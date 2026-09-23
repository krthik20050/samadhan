import type { ComplaintData } from '../../types';
import { complaintsService } from './complaintsService';

export const trackingService = {
  async trackByReference(refNumber: string): Promise<ComplaintData | null> {
    // Normalise reference number input (trim whitespace, uppercase)
    const cleaned = refNumber.trim().toUpperCase();
    if (!cleaned) return null;
    return complaintsService.getById(cleaned);
  },
};
