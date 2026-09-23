import type { DraftComplaint } from '../context/ComplaintDraftContext';
import type { ComplaintCategory } from '../types';

/** Heuristic field extraction from spoken/text complaint (no LLM). */
export function parseTranscriptIntoStructuredData(text: string): Partial<DraftComplaint> {
  const lower = text.toLowerCase();

  let category: ComplaintCategory = 'cleanliness';
  if (lower.includes('clean') || lower.includes('dirty') || lower.includes('trash') || lower.includes('smell')) {
    category = 'cleanliness';
  } else if (lower.includes('delay') || lower.includes('late') || lower.includes('cancelled')) {
    category = 'delay_schedule';
  } else if (lower.includes('safe') || lower.includes('speed') || lower.includes('rash')) {
    category = 'safety';
  } else if (lower.includes('rude') || lower.includes('conductor') || lower.includes('driver') || lower.includes('concession')) {
    category = 'staff_behaviour';
  } else if (lower.includes('broken') || lower.includes('window') || lower.includes('door') || lower.includes('seat')) {
    category = 'bus_condition';
  }

  let origin = '';
  let destination = '';
  let via = '';

  const fromTo = text.match(/\bfrom\s+([A-Za-z\s]+?)\s+to\s+([A-Za-z\s]+?)(?:\.|,|$|\s+(?:bus|the|was|is))/i);
  if (fromTo) {
    origin = fromTo[1].trim();
    destination = fromTo[2].trim();
  } else if (lower.includes('palakkad') && lower.includes('thrissur')) {
    origin = 'Palakkad';
    destination = 'Thrissur';
    via = 'Alathur - Vadakkencherry';
  } else if (lower.includes('guruvayur') && lower.includes('kozhikode')) {
    origin = 'Guruvayur';
    destination = 'Kozhikode';
    via = 'Ponnani - Tirur';
  } else if (lower.includes('kottayam') && lower.includes('kumily')) {
    origin = 'Kottayam';
    destination = 'Kumily';
    via = 'Mundakkayam';
  }

  const busMatch = text.match(/\bKL[-\s]?\d{1,2}[-\s]?[A-Z][-\s]?\d{3,5}\b/i);
  const busNumber = busMatch ? busMatch[0].replace(/\s+/g, '-').toUpperCase() : undefined;

  return {
    category,
    ...(origin ? { origin } : {}),
    ...(destination ? { destination } : {}),
    ...(via ? { via } : {}),
    ...(busNumber ? { busNumber } : {}),
    description: text,
    audioTranscript: text,
  };
}
