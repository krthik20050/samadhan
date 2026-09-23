import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, X, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '../common/Button';
import { VoiceWaveform } from './VoiceWaveform';
import { useLanguage } from '../../hooks/useLanguage';
import { transcribeAudio, voiceAvailable } from '../../lib/api/voiceService';
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
];

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onTranscriptionComplete,
  onCancel,
}) => {
  const { language } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [sttAvailable, setSttAvailable] = useState<boolean | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    voiceAvailable().then(setSttAvailable).catch(() => setSttAvailable(false));
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const finishWithTranscript = (transcript: string) => {
    const text = transcript.trim();
    if (text.length < 10) {
      setErrorMessage('Please speak a bit longer (at least one full sentence about your issue).');
      setIsProcessing(false);
      return;
    }
    setLiveTranscript(text);
    onTranscriptionComplete({
      transcript: text,
      extracted: parseTranscriptIntoStructuredData(text),
    });
    setIsProcessing(false);
  };

  const startRecording = async () => {
    setErrorMessage(null);
    setLiveTranscript('');
    setRecordingSeconds(0);

    if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
      setErrorMessage('Recording is not supported in this browser. Use the sample or type your complaint.');
      return;
    }
    if (sttAvailable === false) {
      setErrorMessage(
        'Voice-to-text is not configured on the server yet. Add SARVAM_API_KEY, or use the sample below.',
      );
      return;
    }

    const mime = pickMimeType();
    if (!mime) {
      setErrorMessage('Audio recording is not supported here. Use the sample or type instead.');
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
      setErrorMessage('Microphone access was denied. Allow the mic in browser settings, or use the sample below.');
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

    if (blob.size < 800) {
      setIsProcessing(false);
      setErrorMessage('No audio captured — hold the mic longer and speak clearly.');
      return;
    }

    const langCode = language === 'ml' ? 'ml-IN' : 'unknown';
    try {
      const { transcript } = await transcribeAudio(blob, langCode);
      finishWithTranscript(transcript);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transcription failed';
      setIsProcessing(false);
      if (msg === 'VOICE_NOT_CONFIGURED') {
        setSttAvailable(false);
        setErrorMessage('Voice-to-text is not configured on the server (SARVAM_API_KEY).');
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
    onCancel?.();
  };

  const loadSample = () => {
    const sample = DEMO_VOICE_SAMPLES[0];
    setLiveTranscript(sample.transcript);
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
        <div className="p-4 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--border-standard)] text-[var(--text-secondary)] text-[13px] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[var(--semantic-warning)] shrink-0 mt-0.5" />
          <p className="leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {sttAvailable === true && !errorMessage && (
        <p className="text-[12px] text-[var(--semantic-success)] font-mono uppercase tracking-wide">
          Sarvam voice recognition ready
        </p>
      )}

      <div className="space-y-4">
        <div>
          <h2 className="text-[20px] font-bold text-[var(--text-primary)]">Record your complaint</h2>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">
            Tap the mic, speak naturally (route + what happened), then tap stop. We transcribe with Sarvam AI
            (Malayalam & English).
          </p>
        </div>

        <div className="flex items-center gap-5 pt-2">
          <button
            type="button"
            onClick={isRecording ? () => void stopRecording() : () => void startRecording()}
            disabled={isProcessing}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            className={`w-[76px] h-[76px] rounded-full flex flex-col items-center justify-center transition-all duration-150 cursor-pointer shrink-0 ${
              isRecording
                ? 'bg-[var(--brand)] text-white ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-primary)]'
                : 'bg-[var(--brand)] text-white hover:bg-[var(--brand-deep)] active:scale-[0.98]'
            } ${isProcessing ? 'opacity-80' : ''}`}
          >
            {isProcessing ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isRecording ? (
              <Square className="w-5 h-5 fill-current" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>

          <div>
            {isRecording ? (
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-[14px] font-mono font-medium text-[var(--text-primary)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                  <span>Recording ({formatTimer(recordingSeconds)} / {formatTimer(MAX_SECONDS)})</span>
                </div>
                <p className="text-[12px] text-[var(--text-secondary)]">Tap square when finished</p>
              </div>
            ) : isProcessing ? (
              <div className="space-y-0.5">
                <div className="text-[14px] font-medium text-[var(--brand)]">Transcribing with Sarvam…</div>
                <p className="text-[12px] text-[var(--text-secondary)]">Structuring route and issue category</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                <div className="text-[14px] font-medium text-[var(--text-primary)]">
                  {language === 'ml' ? 'റെക്കോർഡ് ചെയ്യാൻ അമർത്തുക' : 'Tap to record'}
                </div>
                <p className="text-[12px] text-[var(--text-secondary)]">Up to {MAX_SECONDS} seconds</p>
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

      <div className="pt-4 border-t border-[var(--border-standard)] text-[13px] text-[var(--text-secondary)] space-y-1.5">
        {liveTranscript ? (
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--brand)] block">
              Transcript:
            </span>
            <p className="text-[14px] text-[var(--text-primary)] mt-1 font-mono leading-relaxed">{liveTranscript}</p>
          </div>
        ) : (
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)] block">
              Example phrasing:
            </span>
            <p className="italic text-[13px] text-[var(--text-secondary)] mt-0.5">
              “I have a cleanliness complaint about the bus travelling from Guruvayur to Kozhikode. The seats in the
              middle row were very dirty.”
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        {isRecording ? (
          <>
            <Button variant="primary" size="md" onClick={() => void stopRecording()} icon={<Square className="w-3.5 h-3.5 fill-current" />}>
              Done Speaking
            </Button>
            <Button variant="secondary" size="md" onClick={cancelRecording} icon={<X className="w-3.5 h-3.5" />}>
              Cancel
            </Button>
          </>
        ) : (
          <button
            type="button"
            onClick={loadSample}
            className="text-[13px] font-mono text-[var(--brand)] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Load sample spoken complaint</span>
          </button>
        )}
      </div>
    </div>
  );
};
