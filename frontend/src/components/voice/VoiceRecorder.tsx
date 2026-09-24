import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, X, RotateCcw, AlertCircle, Sparkles, Globe, CheckCircle2 } from 'lucide-react';
import { Button } from '../common/Button';
import { VoiceWaveform } from './VoiceWaveform';
import { useLanguage } from '../../hooks/useLanguage';
import { transcribeAudio, voiceAvailable, type TranscriptionMode } from '../../lib/api/voiceService';
import { parseTranscriptIntoStructuredData } from '../../lib/voiceExtract';
import type { DraftComplaint } from '../../context/ComplaintDraftContext';
import type { ComplaintCategory } from '../../types';

interface VoiceRecorderProps {
  onTranscriptionComplete: (result: {
    transcript: string;
    extracted: Partial<DraftComplaint>;
  }) => void;
  onCancel?: () => void;
}

const MAX_SECONDS = 30;

const DEMO_VOICE_SAMPLES = [
  {
    transcript:
      'I have a cleanliness complaint about the bus travelling from Guruvayur to Kozhikode. The seats in the middle row were very dirty and had discarded trash.',
    englishTranscript:
      'I have a cleanliness complaint about the bus travelling from Guruvayur to Kozhikode. The seats in the middle row were very dirty and had discarded trash.',
    extracted: {
      category: 'cleanliness' as ComplaintCategory,
      origin: 'Guruvayur',
      destination: 'Kozhikode',
      via: 'Ponnani - Tirur',
      busNumber: 'KL-15-A-4892',
      location: 'Middle row seats',
      description:
        'The seats in the middle row were very dirty and had discarded trash left behind.',
    },
  },
  {
    transcript:
      'ഗുരുവായൂരിൽ നിന്ന് കോഴിക്കോട്ടേക്ക് പോയ ബസിൽ സീറ്റുകൾ വളരെ വൃത്തിഹീനമായിരുന്നു.',
    englishTranscript:
      'The seats were very dirty on the bus that went from Guruvayur to Kozhikode.',
    extracted: {
      category: 'cleanliness' as ComplaintCategory,
      origin: 'Guruvayur',
      destination: 'Kozhikode',
      via: 'Ponnani - Tirur',
      description:
        'ഗുരുവായൂരിൽ നിന്ന് കോഴിക്കോട്ടേക്ക് പോയ ബസിൽ സീറ്റുകൾ വളരെ വൃത്തിഹീനമായിരുന്നു.\n(Translation: The seats were very dirty on the bus that went from Guruvayur to Kozhikode.)',
    },
  },
];

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onTranscriptionComplete,
  onCancel,
}) => {
  const { language } = useLanguage();
  const [selectedLang, setSelectedLang] = useState<string>(
    language === 'ml' ? 'ml-IN' : 'en-IN',
  );
  const [transcriptionMode] = useState<TranscriptionMode>('transcribe');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [englishTranslation, setEnglishTranslation] = useState<string | null>(null);
  const [sttAvailable, setSttAvailable] = useState<boolean | null>(null);
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    voiceAvailable()
      .then(setSttAvailable)
      .catch(() => setSttAvailable(false));
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Sync selected spoken language when main UI language toggles
  useEffect(() => {
    setSelectedLang(language === 'ml' ? 'ml-IN' : 'en-IN');
  }, [language]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const finishWithTranscript = (transcript: string, englishTranscript?: string | null) => {
    const text = transcript.trim();
    if (text.length < 5) {
      setErrorMessage('Spoken audio was too short. Please speak at least one complete sentence.');
      setIsProcessing(false);
      return;
    }
    setLiveTranscript(text);
    if (englishTranscript) {
      setEnglishTranslation(englishTranscript);
    }
    onTranscriptionComplete({
      transcript: text,
      extracted: parseTranscriptIntoStructuredData(text, englishTranscript),
    });
    setIsProcessing(false);
  };

  const startRecording = async () => {
    setErrorMessage(null);
    setLiveTranscript('');
    setEnglishTranslation(null);
    setRecordingSeconds(0);
    setDetectedProvider(null);

    if (sttAvailable === false) {
      setErrorMessage(
        'Voice transcription is not available at the moment. Please type your complaint or use the sample.',
      );
      return;
    }

    if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
      setErrorMessage(
        'Recording is not supported in this browser. Use the sample or type your complaint.',
      );
      return;
    }

    const mime = pickMimeType();
    if (!mime) {
      setErrorMessage('Audio recording is not supported in this browser. Use the sample or type instead.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onerror = () => {
        setErrorMessage('Recording failed. Try again or use the sample complaint.');
        setIsRecording(false);
        stopStream();
      };

      recorder.start(400);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= MAX_SECONDS - 1) {
            void stopRecording();
            return MAX_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setErrorMessage(
        'Microphone access was denied. Allow microphone permissions in your browser settings, or use the sample below.',
      );
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setIsRecording(false);
      return;
    }

    setIsRecording(false);
    setIsProcessing(true);

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
    mediaRecorderRef.current = null;
    stopStream();
    chunksRef.current = [];

    if (blob.size < 600) {
      setIsProcessing(false);
      setErrorMessage('No audio captured. Hold the mic longer and speak clearly.');
      return;
    }

    try {
      const result = await transcribeAudio(blob, selectedLang, {
        mode: transcriptionMode,
        translateToEnglishIfIndic: selectedLang === 'ml-IN',
      });
      setDetectedProvider(result.provider);
      finishWithTranscript(result.transcript, result.englishTranscript);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transcription failed';
      setIsProcessing(false);
      if (msg === 'VOICE_NOT_CONFIGURED') {
        setSttAvailable(false);
        setErrorMessage('Voice-to-text is not configured (SARVAM_API_KEY).');
      } else {
        setErrorMessage(`${msg}. Try again or use the sample complaint.`);
      }
    }
  };

  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    stopStream();
    setIsRecording(false);
    setRecordingSeconds(0);
    setLiveTranscript('');
    setEnglishTranslation(null);
    onCancel?.();
  };

  const loadSample = (index = 0) => {
    const sample = DEMO_VOICE_SAMPLES[index];
    setLiveTranscript(sample.transcript);
    setEnglishTranslation(sample.englishTranscript ?? null);
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onTranscriptionComplete({
        transcript: sample.transcript,
        extracted: sample.extracted,
      });
    }, 400);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="w-full text-left space-y-6">
      {errorMessage && (
        <div className="p-4 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--semantic-danger)]/30 text-[var(--text-secondary)] text-[13px] flex items-start gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-[var(--semantic-danger)] shrink-0 mt-0.5" />
          <p className="leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* Sarvam STT Status & Language Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[12px] bg-[var(--surface-primary)] border border-[var(--border-standard)]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[12px] font-mono font-medium text-[var(--text-primary)]">
            Sarvam AI Saaras v3
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-mono">
            STT Active
          </span>
        </div>

        {/* Spoken Language Toggle */}
        <div className="flex items-center gap-1.5 text-[12px]">
          <Globe className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className="text-[var(--text-muted)] font-mono text-[11px]">Spoken:</span>
          <div className="inline-flex rounded-lg bg-[var(--bg-primary)] p-0.5 border border-[var(--border-standard)]">
            <button
              type="button"
              onClick={() => setSelectedLang('ml-IN')}
              disabled={isRecording || isProcessing}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                selectedLang === 'ml-IN'
                  ? 'bg-[var(--brand)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              മലയാളം (Malayalam)
            </button>
            <button
              type="button"
              onClick={() => setSelectedLang('en-IN')}
              disabled={isRecording || isProcessing}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                selectedLang === 'en-IN'
                  ? 'bg-[var(--brand)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setSelectedLang('unknown')}
              disabled={isRecording || isProcessing}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                selectedLang === 'unknown'
                  ? 'bg-[var(--brand)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Auto Detect
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-[20px] font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span>Record your complaint</span>
            <Sparkles className="w-4 h-4 text-[var(--brand)]" />
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">
            Tap the mic, speak naturally about your trip (bus route, time, and grievance), then tap stop.
            Transcribed in real-time with Sarvam AI.
          </p>
        </div>

        <div className="flex items-center gap-5 pt-2">
          <button
            type="button"
            onClick={isRecording ? () => void stopRecording() : () => void startRecording()}
            disabled={isProcessing}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            className={`w-[76px] h-[76px] rounded-full flex flex-col items-center justify-center transition-all duration-150 cursor-pointer shrink-0 shadow-lg ${
              isRecording
                ? 'bg-[var(--semantic-danger)] text-white ring-4 ring-red-200 animate-pulse'
                : 'bg-[var(--brand)] text-white hover:bg-[var(--brand-deep)] active:scale-[0.98]'
            } ${isProcessing ? 'opacity-80' : ''}`}
          >
            {isProcessing ? (
              <span className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
            ) : isRecording ? (
              <Square className="w-6 h-6 fill-current" />
            ) : (
              <Mic className="w-7 h-7" />
            )}
          </button>

          <div>
            {isRecording ? (
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-[14px] font-mono font-medium text-[var(--text-primary)]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--semantic-danger)] animate-ping" />
                  <span>
                    Recording ({formatTimer(recordingSeconds)} / {formatTimer(MAX_SECONDS)})
                  </span>
                </div>
                <p className="text-[12px] text-[var(--text-secondary)]">Tap square when finished speaking</p>
              </div>
            ) : isProcessing ? (
              <div className="space-y-0.5">
                <div className="text-[14px] font-semibold text-[var(--brand)] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--brand)] animate-ping" />
                  <span>Transcribing with Sarvam AI…</span>
                </div>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  Extracting route, bus number, and grievance category
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                <div className="text-[14px] font-medium text-[var(--text-primary)]">
                  {selectedLang === 'ml-IN' ? 'റെക്കോർഡ് ചെയ്യാൻ മൈക്ക് അമർത്തുക' : 'Tap mic to start speaking'}
                </div>
                <p className="text-[12px] text-[var(--text-secondary)]">Up to {MAX_SECONDS} seconds · Audio processed securely</p>
              </div>
            )}
          </div>
        </div>

        {isRecording && (
          <div className="w-full pt-1">
            <VoiceWaveform isRecording={isRecording} />
          </div>
        )}
      </div>

      {/* Transcript Results */}
      <div className="pt-4 border-t border-[var(--border-standard)] text-[13px] text-[var(--text-secondary)] space-y-2">
        {liveTranscript ? (
          <div className="space-y-2 bg-[var(--surface-primary)] p-4 rounded-[12px] border border-[var(--border-standard)]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--brand)] font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Transcribed with Sarvam AI:</span>
              </span>
              {detectedProvider && (
                <span className="text-[10px] font-mono text-[var(--text-muted)]">
                  via {detectedProvider}
                </span>
              )}
            </div>
            <p className="text-[14px] text-[var(--text-primary)] font-medium leading-relaxed">
              {liveTranscript}
            </p>

            {englishTranslation && englishTranslation !== liveTranscript && (
              <div className="pt-2 border-t border-[var(--border-standard)] mt-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">
                  English Translation (Sarvam Saaras):
                </span>
                <p className="text-[13px] text-[var(--text-secondary)] italic mt-0.5">
                  “{englishTranslation}”
                </p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)] block">
              Sample phrasing:
            </span>
            <p className="italic text-[13px] text-[var(--text-secondary)] mt-0.5">
              “I have a cleanliness complaint about the bus travelling from Guruvayur to Kozhikode. The seats in the
              middle row were very dirty.”
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        {isRecording ? (
          <>
            <Button
              variant="primary"
              size="md"
              onClick={() => void stopRecording()}
              icon={<Square className="w-3.5 h-3.5 fill-current" />}
            >
              Done Speaking
            </Button>
            <Button variant="secondary" size="md" onClick={cancelRecording} icon={<X className="w-3.5 h-3.5" />}>
              Cancel
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => loadSample(0)}
              className="text-[12px] font-mono text-[var(--brand)] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Load sample English voice</span>
            </button>
            <button
              type="button"
              onClick={() => loadSample(1)}
              className="text-[12px] font-mono text-[var(--brand)] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Load sample മലയാളം voice</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
