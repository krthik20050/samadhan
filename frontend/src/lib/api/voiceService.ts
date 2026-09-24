/**
 * Voice transcription service integrating Sarvam AI's Speech-to-Text API.
 * Supports direct client-side Sarvam API (CORS enabled by Sarvam) with fallback
 * to the backend proxy endpoint (/api/v1/voice/transcribe).
 */

const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
const SARVAM_API_KEY = (import.meta.env.VITE_SARVAM_API_KEY ?? '').trim();
const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';

export interface VoiceTranscribeResult {
  transcript: string;
  englishTranscript?: string | null;
  language_code?: string | null;
  request_id?: string | null;
  provider: 'sarvam-direct' | 'sarvam-backend';
}

export type TranscriptionMode = 'transcribe' | 'translate';

/**
 * Check if voice transcription via Sarvam is configured and ready.
 * Returns true if direct Sarvam key is present OR backend reports available.
 */
export async function voiceAvailable(): Promise<boolean> {
  if (SARVAM_API_KEY) {
    return true;
  }
  try {
    const res = await fetch(`${BASE}/api/v1/voice/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { available?: boolean };
    return Boolean(body.available);
  } catch {
    return false;
  }
}

/**
 * Perform direct transcription using Sarvam AI REST API (Saaras v3).
 */
async function transcribeWithSarvamDirect(
  blob: Blob,
  languageCode: string = 'unknown',
  mode: TranscriptionMode = 'transcribe',
): Promise<VoiceTranscribeResult> {
  if (!SARVAM_API_KEY) {
    throw new Error('VITE_SARVAM_API_KEY is not configured');
  }

  const form = new FormData();
  const ext = blob.type.includes('webm')
    ? 'webm'
    : blob.type.includes('ogg')
    ? 'ogg'
    : blob.type.includes('mp4')
    ? 'mp4'
    : 'wav';
  form.append('file', blob, `voice_recording.${ext}`);
  form.append('model', 'saaras:v3');
  form.append('mode', mode);
  if (languageCode && languageCode !== 'unknown') {
    form.append('language_code', languageCode);
  }

  const res = await fetch(SARVAM_STT_URL, {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
    },
    body: form,
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    let detail = `Sarvam STT HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.detail) detail = parsed.detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  const data = (await res.json()) as {
    transcript?: string;
    language_code?: string;
    request_id?: string;
  };

  const text = (data.transcript ?? '').trim();
  if (!text) {
    throw new Error('Sarvam returned an empty transcript. Please speak clearly and try again.');
  }

  return {
    transcript: text,
    language_code: data.language_code ?? (languageCode !== 'unknown' ? languageCode : null),
    request_id: data.request_id ?? null,
    provider: 'sarvam-direct',
  };
}

/**
 * Perform transcription via backend proxy endpoint.
 */
async function transcribeWithBackend(
  blob: Blob,
  languageCode: string = 'unknown',
): Promise<VoiceTranscribeResult> {
  const form = new FormData();
  const ext = blob.type.includes('webm')
    ? 'webm'
    : blob.type.includes('ogg')
    ? 'ogg'
    : blob.type.includes('mp4')
    ? 'mp4'
    : 'wav';
  form.append('file', blob, `recording.${ext}`);
  form.append('language_code', languageCode);

  const res = await fetch(`${BASE}/api/v1/voice/transcribe`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(60000),
  });

  if (res.status === 503) {
    throw new Error('VOICE_NOT_CONFIGURED');
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? `Transcription failed (${res.status})`);
  }

  const data = (await res.json()) as {
    transcript: string;
    language_code?: string | null;
    request_id?: string | null;
  };

  return {
    transcript: data.transcript,
    language_code: data.language_code ?? null,
    request_id: data.request_id ?? null,
    provider: 'sarvam-backend',
  };
}

/**
 * Primary transcription entrypoint.
 * Automatically tries direct Sarvam STT (if key present) or backend proxy,
 * and falls back gracefully. Also supports optional English translation for Malayalam speech.
 */
export async function transcribeAudio(
  blob: Blob,
  languageCode: 'unknown' | 'ml-IN' | 'en-IN' | string = 'unknown',
  options?: {
    mode?: TranscriptionMode;
    translateToEnglishIfIndic?: boolean;
  },
): Promise<VoiceTranscribeResult> {
  const mode = options?.mode ?? 'transcribe';

  // 1. If direct Sarvam key is available in client, try direct first for speed and zero backend hop
  if (SARVAM_API_KEY) {
    try {
      const primaryResult = await transcribeWithSarvamDirect(blob, languageCode, mode);

      // If speech was Malayalam or other Indic language and translation was requested
      if (options?.translateToEnglishIfIndic && languageCode === 'ml-IN' && mode === 'transcribe') {
        try {
          const transResult = await transcribeWithSarvamDirect(blob, languageCode, 'translate');
          if (transResult.transcript && transResult.transcript !== primaryResult.transcript) {
            primaryResult.englishTranscript = transResult.transcript;
          }
        } catch {
          // Soft fail for optional secondary translation
        }
      }

      return primaryResult;
    } catch (directErr) {
      console.warn('Direct Sarvam STT failed, falling back to backend:', directErr);
      // Fall through to backend proxy
    }
  }

  // 2. Try backend endpoint
  try {
    return await transcribeWithBackend(blob, languageCode);
  } catch (backendErr) {
    // If backend failed and we haven't tried direct Sarvam yet (e.g. key configured but not tested)
    if (SARVAM_API_KEY) {
      return await transcribeWithSarvamDirect(blob, languageCode, mode);
    }
    throw backendErr;
  }
}
