import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, X, AlertCircle } from 'lucide-react';
import { Button } from '../common/Button';
import { VoiceWaveform } from './VoiceWaveform';
import { useLanguage } from '../../hooks/useLanguage';
import type { DraftComplaint } from '../../context/ComplaintDraftContext';
import type { ComplaintCategory } from '../../types';

interface VoiceRecorderProps {
  onTranscriptionComplete: (result: {
    transcript: string;
    extracted: Partial<DraftComplaint>;
  }) => void;
  onCancel?: () => void;
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
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return (
      typeof window === 'undefined' ||
      !(
        'SpeechRecognition' in window ||
        'webkitSpeechRecognition' in window
      )
    );
  });

  const recognitionRef = useRef<unknown>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition;

    if (SpeechRecognitionAPI) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recognition = new (SpeechRecognitionAPI as any)();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript + ' ';
          }
          setLiveTranscript(currentTranscript.trim());
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onerror = (event: any) => {
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setIsDemoMode(true);
            setIsRecording(false);
            setErrorMessage('Microphone access is unavailable. Voice reporting requires browser speech recognition.');
          }
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('SpeechRecognition initialization error:', err);
      }
    }

    return () => {
      if (recognitionRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (recognitionRef.current as any).abort?.();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = () => {
    if (isDemoMode || !recognitionRef.current) {
      setErrorMessage('Voice recognition is unavailable in this browser. Please use the text complaint form.');
      return;
    }
    setErrorMessage(null);
    setLiveTranscript('');
    setRecordingSeconds(0);
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => {
        if (prev >= 60) {
          stopRecording();
          return 60;
        }
        return prev + 1;
      });
    }, 1000);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognitionRef.current as any).start();
    } catch {
      setIsDemoMode(true);
      setIsRecording(false);
      setErrorMessage('Voice recognition could not be started. Please use the text complaint form.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (recognitionRef.current && !isDemoMode) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (recognitionRef.current as any).stop();
      } catch (e) {
        console.warn(e);
      }
    }

    setIsRecording(false);
    setIsProcessing(true);

    setTimeout(() => {
      const finalTranscript = liveTranscript.trim();
      if (!finalTranscript) {
        setIsProcessing(false);
        setErrorMessage('No speech was captured. Please try again or use the text complaint form.');
        return;
      }

      const extracted = parseTranscriptIntoStructuredData(finalTranscript);

      setIsProcessing(false);
      onTranscriptionComplete({
        transcript: finalTranscript,
        extracted,
      });
    }, 550);
  };

  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognitionRef.current as any).abort?.();
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    setLiveTranscript('');
    if (onCancel) onCancel();
  };

  const parseTranscriptIntoStructuredData = (text: string): Partial<DraftComplaint> => {
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

    if (lower.includes('palakkad') && lower.includes('thrissur')) {
      origin = 'Palakkad';
      destination = 'Thrissur';
      via = 'Alathur - Vadakkencherry';
    } else if (lower.includes('kottayam') && lower.includes('kumily')) {
      origin = 'Kottayam';
      destination = 'Kumily';
      via = 'Mundakkayam';
    } else if (lower.includes('thiruvananthapuram') || lower.includes('trivandrum')) {
      origin = 'Thiruvananthapuram';
      destination = 'Ernakulam';
      via = 'Kollam - Alappuzha';
    } else if (lower.includes('kannur')) {
      origin = 'Kannur';
      destination = 'Mananthavady';
      via = 'Mattannur';
    }

    return {
      category,
      origin,
      destination,
      via,
      location: '',
      description: text,
      audioTranscript: text,
    };
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="w-full text-left space-y-6">
      {/* Notice if microphone permissions unavailable */}
      {errorMessage && (
        <div className="p-4 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--border-standard)] text-[var(--text-secondary)] text-[13px] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[var(--semantic-warning)] shrink-0 mt-0.5" />
          <p className="leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* Focused Recording Area */}
      <div className="space-y-4">
        <div>
          <h2 className="text-[20px] font-bold text-[var(--text-primary)]">
            Speak naturally
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">
            Tell us your route and what happened. Spoken description will be converted into a structured grievance.
          </p>
        </div>

        {/* Microphone Button & State */}
        <div className="flex items-center gap-5 pt-2">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            aria-label={isRecording ? 'Done speaking' : 'Tap to speak your complaint'}
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
                  <span>Listening ({formatTimer(recordingSeconds)})</span>
                </div>
                <p className="text-[12px] text-[var(--text-secondary)]">Tap square when finished</p>
              </div>
            ) : isProcessing ? (
              <div className="space-y-0.5">
                <div className="text-[14px] font-medium text-[var(--brand)]">Understanding your complaint…</div>
                <p className="text-[12px] text-[var(--text-secondary)]">Structuring route and issue category</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                <div className="text-[14px] font-medium text-[var(--text-primary)]">
                  {language === 'ml' ? 'സംസാരിക്കാൻ അമർത്തുക' : 'Tap to speak'}
                </div>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  Supports Malayalam & English
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quiet waveform when recording */}
        {isRecording && (
          <div className="w-full pt-1">
            <VoiceWaveform isRecording={isRecording} />
          </div>
        )}
      </div>

      {/* Live Transcript / Example phrasing (NO giant card) */}
      <div className="pt-4 border-t border-[var(--border-standard)] text-[13px] text-[var(--text-secondary)] space-y-1.5">
        {isRecording ? (
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--brand)] block">
              Live Transcript:
            </span>
            <p className="text-[14px] text-[var(--text-primary)] mt-1 font-mono">
              {liveTranscript || 'Listening for your speech...'}
            </p>
          </div>
        ) : (
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)] block">
              Example phrasing:
            </span>
            <p className="italic text-[13px] text-[var(--text-secondary)] mt-0.5">
              “Describe the route, what happened, and where the issue occurred.”
            </p>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-3 pt-2">
        {isRecording && (
          <>
            <Button
              variant="primary"
              size="md"
              onClick={stopRecording}
              icon={<Square className="w-3.5 h-3.5 fill-current" />}
            >
              Done Speaking
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={cancelRecording}
              icon={<X className="w-3.5 h-3.5" />}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
