import React, { useEffect, useState } from 'react';

interface VoiceWaveformProps {
  isRecording: boolean;
  barCount?: number;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  isRecording,
  barCount = 28,
}) => {
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: barCount }, () => 15)
  );

  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setLevels((prev) =>
        prev.map((_, i) => {
          // Dynamic wave pattern that mimics human voice cadence
          const centerBias = Math.sin((i / barCount) * Math.PI);
          const randomFactor = Math.random() * 0.7 + 0.3;
          const height = Math.floor(centerBias * randomFactor * 75) + 12;
          return Math.min(height, 85);
        })
      );
    }, 90);

    return () => clearInterval(interval);
  }, [isRecording, barCount]);

  const activeLevels = isRecording ? levels : Array.from({ length: barCount }, () => 15);

  return (
    <div
      className="flex items-center justify-center gap-1 sm:gap-1.5 h-16 sm:h-20 px-4 bg-white rounded-[10px] border border-[#D9D7D0]"
      aria-label="Voice audio waveform"
    >
      {activeLevels.map((level, idx) => (
        <div
          key={idx}
          className={`w-1 rounded-full transition-all duration-100 ${
            isRecording ? 'bg-[#164E48]' : 'bg-[#D9D7D0]'
          }`}
          style={{
            height: `${level}%`,
            opacity: isRecording ? 0.5 + (level / 85) * 0.5 : 0.35,
          }}
        />
      ))}
    </div>
  );
};
