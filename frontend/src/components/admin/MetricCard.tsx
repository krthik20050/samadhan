import React from 'react';
import { Card } from '../common/Card';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  variant?: 'default' | 'danger' | 'warning' | 'success';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'default',
}) => {
  const borderStyles = {
    default: 'border-[var(--border-standard)] bg-[var(--surface-primary)]',
    danger: 'border-[var(--semantic-error)]/40 bg-[var(--surface-primary)]',
    warning: 'border-[var(--semantic-warning)]/40 bg-[var(--surface-primary)]',
    success: 'border-[var(--semantic-success)]/40 bg-[var(--surface-primary)]',
  };

  const textStyles = {
    default: 'text-[var(--text-primary)]',
    danger: 'text-[var(--semantic-error)]',
    warning: 'text-[var(--semantic-warning)]',
    success: 'text-[var(--semantic-success)]',
  };

  return (
    <Card className={`text-left ${borderStyles[variant]} transition-colors`}>
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {title}
          </span>
          <div className={`text-3xl sm:text-4xl font-extrabold mt-1 tracking-tight ${textStyles[variant]}`}>
            {value}
          </div>
        </div>
        {icon && (
          <div className="p-2 rounded-[8px] bg-[var(--bg-primary)] border border-[var(--border-standard)] text-[var(--brand)]">
            {icon}
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[12px]">
          {subtitle && <span className="text-[var(--text-secondary)]">{subtitle}</span>}
          {trend && (
            <span
              className={`font-mono font-medium ${
                trend.isPositive ? 'text-[var(--semantic-success)]' : 'text-[var(--semantic-error)]'
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
      )}
    </Card>
  );
};
