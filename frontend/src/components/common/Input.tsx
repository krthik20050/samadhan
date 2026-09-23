import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="text-[14px] font-semibold text-[#171A19]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 text-[#6B706C] pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full bg-white text-[#171A19] placeholder:text-[#8B908B] border rounded-[10px] py-3 text-[15px] min-h-[48px] transition-all duration-150 focus:outline-none focus:border-[#164E48] focus:ring-2 focus:ring-[#D8FF3E]/40 ${
              leftIcon ? 'pl-11' : 'pl-3.5'
            } ${rightIcon ? 'pr-11' : 'pr-3.5'} ${
              error ? 'border-[#B34747] focus:border-[#B34747] focus:ring-[#B34747]/20' : 'border-[#D9D7D0]'
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 text-[#6B706C] flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <span className="text-[12px] font-semibold text-[#B34747] mt-0.5">{error}</span>}
        {helperText && !error && (
          <span className="text-[12px] text-[#6B706C] leading-relaxed">{helperText}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
