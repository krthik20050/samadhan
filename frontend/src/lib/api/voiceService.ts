const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '');

export interface VoiceTranscribeResult {
  transcript: string;
  language_code?: string | null;
  request_id?: string | null;
}

export async function voiceAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/v1/voice/status`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
    const body = (await res.json()) as { available?: boolean };
    return Boolean(body.available);
  } catch {
    return false;
  }
}

export async function transcribeAudio(
  blob: Blob,
  languageCode: 'unknown' | 'ml-IN' | 'en-IN' = 'unknown',
): Promise<VoiceTranscribeResult> {
  const form = new FormData();
  const ext = blob.type.includes('webm') ? 'webm' : blob.type.includes('ogg') ? 'ogg' : 'wav';
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
  return (await res.json()) as VoiceTranscribeResult;
}
