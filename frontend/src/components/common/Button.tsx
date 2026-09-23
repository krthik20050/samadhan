import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  isLoading = false,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold text-[15px] sm:text-[16px] transition-all duration-200 ease-out cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#164E48] focus-visible:ring-offset-2';

  const variants = {
    primary:
      'bg-[#164E48] hover:bg-[#0B302D] active:bg-[#082220] text-white hover:-translate-y-[1px] active:scale-[0.98] border border-transparent shadow-[0_1px_2px_rgba(11,48,45,0.12)]',
    secondary:
      'bg-white hover:bg-[#ECEAE4] text-[#171A19] border border-[#D9D7D0] hover:border-[#B8B5AC] hover:-translate-y-[1px] active:scale-[0.98]',
    outline:
      'bg-transparent border border-[#164E48] text-[#164E48] hover:bg-[#ECEAE4] hover:-translate-y-[1px] active:scale-[0.98]',
    ghost:
      'bg-transparent text-[#6B706C] hover:text-[#171A19] hover:bg-[#ECEAE4]/60 border border-transparent active:scale-[0.98]',
    danger:
      'bg-[#B34747] hover:bg-[#963737] text-white hover:-translate-y-[1px] active:scale-[0.98] border border-transparent',
  };

  const sizes = {
    sm: 'h-[40px] px-3.5 text-[14px] gap-1.5',
    md: 'h-[48px] px-5 sm:px-6 text-[15px] gap-2',
    lg: 'h-[52px] px-6 sm:px-7 text-[16px] gap-2.5',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
          <span>{children}</span>
          {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
        </>
      )}
    </button>
  );
};
