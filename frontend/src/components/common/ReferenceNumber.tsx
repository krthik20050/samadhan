import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface ReferenceNumberProps {
  value: string;
  size?: 'sm' | 'md' | 'lg';
  showCopy?: boolean;
}

export const ReferenceNumber: React.FC<ReferenceNumberProps> = ({
  value,
  size = 'md',
  showCopy = true,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sizes = {
    sm: 'text-sm font-mono px-2 py-0.5',
    md: 'text-base sm:text-lg font-mono font-bold px-3 py-1.5',
    lg: 'text-xl sm:text-2xl font-mono font-extrabold px-4 py-2 tracking-wide',
  };

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`bg-[#123C3A]/8 text-[#0B2927] border border-[#123C3A]/20 rounded-lg select-all font-mono ${sizes[size]}`}
      >
        {value}
      </span>
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          title="Copy Reference Number"
          aria-label="Copy reference number to clipboard"
          className="p-1.5 rounded-lg text-[#66716D] hover:text-[#123C3A] hover:bg-[#F6F3EC] active:scale-[0.98] transition-all cursor-pointer"
        >
          {copied ? (
            <span className="inline-flex items-center text-xs font-semibold text-[#287A58] gap-1">
              <Check className="w-4 h-4" /> Copied
            </span>
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
};
