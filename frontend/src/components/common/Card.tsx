import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'soft' | 'interactive' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'surface',
  padding = 'md',
  className = '',
  ...props
}) => {
  const paddings = {
    none: 'p-0',
    sm: 'p-4 sm:p-5',
    md: 'p-6 sm:p-7',
    lg: 'p-7 sm:p-8',
  };

  const variants = {
    surface: 'bg-white border border-[#D9D7D0]',
    soft: 'bg-[#ECEAE4] border border-[#D9D7D0]',
    interactive:
      'bg-white border border-[#D9D7D0] hover:border-[#164E48]/60 transition-colors duration-150 cursor-pointer',
    bordered: 'bg-transparent border border-[#D9D7D0]',
  };

  return (
    <div
      className={`rounded-[14px] ${variants[variant]} ${paddings[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
