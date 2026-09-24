import type { DraftComplaint } from '../context/ComplaintDraftContext';
import type { ComplaintCategory } from '../types';

/**
 * Common Malayalam to English town mapping for KSRTC routes.
 */
const MALAYALAM_TOWNS: Record<string, string> = {
  'ഗുരുവായൂർ': 'Guruvayur',
  'ഗുരുവായൂർക്ക്': 'Guruvayur',
  'കോഴിക്കോട്': 'Kozhikode',
  'കോഴിക്കോട്ടേക്ക്': 'Kozhikode',
  'പാലക്കാട്': 'Palakkad',
  'തൃശ്ശൂർ': 'Thrissur',
  'തൃശൂർ': 'Thrissur',
  'കോട്ടയം': 'Kottayam',
  'കുമളി': 'Kumily',
  'തിരുവനന്തപുരം': 'Thiruvananthapuram',
  'എറണാകുളം': 'Ernakulam',
  'കൊച്ചി': 'Ernakulam',
  'ആലപ്പുഴ': 'Alappuzha',
  'കണ്ണൂർ': 'Kannur',
  'കൊല്ലം': 'Kollam',
  'സുൽത്താൻ ബത്തേരി': 'Sulthan Bathery',
  'മാനന്തവാടി': 'Mananthavady',
  'മൂന്നാർ': 'Munnar',
  'അടൂർ': 'Adoor',
};

/**
 * Heuristic field extraction from spoken/text complaint (supporting English & Malayalam via Sarvam).
 */
export function parseTranscriptIntoStructuredData(
  text: string,
  englishText?: string | null,
): Partial<DraftComplaint> {
  const combined = `${text} ${englishText ?? ''}`.toLowerCase();

  let category: ComplaintCategory = 'cleanliness';

  // Malayalam & English keywords matching
  if (
    combined.includes('clean') ||
    combined.includes('dirty') ||
    combined.includes('trash') ||
    combined.includes('smell') ||
    combined.includes('വൃത്തി') ||
    combined.includes('അഴുക്ക്') ||
    combined.includes('മാലിന്യം') ||
    combined.includes('നാറ്റം')
  ) {
    category = 'cleanliness';
  } else if (
    combined.includes('delay') ||
    combined.includes('late') ||
    combined.includes('cancelled') ||
    combined.includes('വൈകി') ||
    combined.includes('താമസം') ||
    combined.includes('റദ്ദാക്ക') ||
    combined.includes('സമയത്ത്')
  ) {
    category = 'delay_schedule';
  } else if (
    combined.includes('safe') ||
    combined.includes('speed') ||
    combined.includes('rash') ||
    combined.includes('accident') ||
    combined.includes('അമിതവേഗത') ||
    combined.includes('ഡ്രൈവിങ്') ||
    combined.includes('അപകടം')
  ) {
    category = 'safety';
  } else if (
    combined.includes('rude') ||
    combined.includes('conductor') ||
    combined.includes('driver') ||
    combined.includes('concession') ||
    combined.includes('behaviour') ||
    combined.includes('കണ്ടക്ടർ') ||
    combined.includes('ഡ്രൈവർ') ||
    combined.includes('പെരുമാറ്റം') ||
    combined.includes('കൺസഷൻ')
  ) {
    category = 'staff_behaviour';
  } else if (
    combined.includes('broken') ||
    combined.includes('window') ||
    combined.includes('door') ||
    combined.includes('seat') ||
    combined.includes('സീറ്റ്') ||
    combined.includes('വാതിൽ') ||
    combined.includes('ജനൽ') ||
    combined.includes('തകരാർ')
  ) {
    category = 'bus_condition';
  }

  let origin = '';
  let destination = '';
  let via = '';

  // English pattern match: "from X to Y"
  const targetForOriginDest = englishText || text;
  const fromTo = targetForOriginDest.match(
    /\bfrom\s+([A-Za-z\s]+?)\s+to\s+([A-Za-z\s]+?)(?:\.|,|$|\s+(?:bus|the|was|is))/i,
  );
  if (fromTo) {
    origin = fromTo[1].trim();
    destination = fromTo[2].trim();
  }

  // Malayalam stop detection
  if (!origin || !destination) {
    const detectedTowns: string[] = [];
    for (const [malName, engName] of Object.entries(MALAYALAM_TOWNS)) {
      if (text.includes(malName) && !detectedTowns.includes(engName)) {
        detectedTowns.push(engName);
      }
    }
    if (detectedTowns.length >= 2) {
      origin = detectedTowns[0];
      destination = detectedTowns[1];
    } else if (detectedTowns.length === 1 && !origin) {
      origin = detectedTowns[0];
    }
  }

  // Known corridor fallbacks
  if (combined.includes('palakkad') && combined.includes('thrissur')) {
    origin = origin || 'Palakkad';
    destination = destination || 'Thrissur';
    via = via || 'Alathur - Vadakkencherry';
  } else if (combined.includes('guruvayur') && combined.includes('kozhikode')) {
    origin = origin || 'Guruvayur';
    destination = destination || 'Kozhikode';
    via = via || 'Ponnani - Tirur';
  } else if (combined.includes('kottayam') && combined.includes('kumily')) {
    origin = origin || 'Kottayam';
    destination = destination || 'Kumily';
    via = via || 'Mundakkayam';
  }

  // Bus registration plate match (e.g. KL 15 A 1234 or KL-15-A-1234)
  const busMatch = combined.match(/\bKL[-\s]?\d{1,2}[-\s]?[A-Z]{1,2}[-\s]?\d{3,5}\b/i);
  const busNumber = busMatch ? busMatch[0].replace(/\s+/g, '-').toUpperCase() : undefined;

  return {
    category,
    ...(origin ? { origin } : {}),
    ...(destination ? { destination } : {}),
    ...(via ? { via } : {}),
    ...(busNumber ? { busNumber } : {}),
    description: englishText ? `${text}\n(Translation: ${englishText})` : text,
    audioTranscript: text,
  };
}
