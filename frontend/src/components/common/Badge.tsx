import React from 'react';
import type { ComplaintStatus, PriorityLevel } from '../../types';

export interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'status' | 'category' | 'priority' | 'neutral';
  status?: ComplaintStatus;
  priority?: PriorityLevel;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  status,
  priority,
  className = '',
}) => {
  const getDotColor = (st?: ComplaintStatus) => {
    switch (st) {
      case 'submitted':
        return 'bg-[#8B908B]';
      case 'assigned':
        return 'bg-[#416A82]';
      case 'acknowledged':
        return 'bg-[#164E48]';
      case 'in_progress':
        return 'bg-[#A56B20]';
      case 'sla_breached':
      case 'escalated':
        return 'bg-[#B34747]';
      case 'resolved':
        return 'bg-[#247A52]';
      case 'rejected':
      default:
        return 'bg-[#8B908B]';
    }
  };

  const getStatusLabel = (st?: ComplaintStatus) => {
    switch (st) {
      case 'submitted':
        return 'Submitted';
      case 'assigned':
        return 'Assigned';
      case 'acknowledged':
        return 'Acknowledged';
      case 'in_progress':
        return 'In Progress';
      case 'sla_breached':
        return 'SLA Overdue';
      case 'escalated':
        return 'Escalated to DTO';
      case 'resolved':
        return 'Resolved';
      case 'rejected':
        return 'Closed';
      default:
        return st;
    }
  };

  if (variant === 'status' && status) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[13px] font-medium text-[#171A19] ${className}`}
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${getDotColor(status)} ${
            status === 'in_progress' ? 'animate-pulse' : ''
          }`}
          aria-hidden="true"
        />
        <span>{children || getStatusLabel(status)}</span>
      </span>
    );
  }

  if (variant === 'priority' && priority) {
    const isUrgent = priority === 'urgent';
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${
          isUrgent ? 'text-[#B34747]' : 'text-[#6B706C]'
        } ${className}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isUrgent ? 'bg-[#B34747]' : 'bg-[#8B908B]'
          }`}
          aria-hidden="true"
        />
        <span className="capitalize">{children || `${priority} Priority`}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[#ECEAE4] text-[#171A19] text-[12px] font-medium border border-[#D9D7D0] ${className}`}
    >
      {children}
    </span>
  );
};
