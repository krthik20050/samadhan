import React from 'react';
import type { NotificationLogItem } from '../../types';
import { MessageSquare, Mail, Phone, CheckCheck, Clock, AlertCircle } from 'lucide-react';

interface NotificationItemProps {
  item: NotificationLogItem;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({ item }) => {
  const getChannelIcon = (channel: NotificationLogItem['channel']) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageSquare className="w-4 h-4 text-[var(--semantic-success)]" />;
      case 'sms':
        return <Phone className="w-4 h-4 text-[var(--semantic-info)]" />;
      case 'email':
        return <Mail className="w-4 h-4 text-[var(--semantic-warning)]" />;
    }
  };

  const getStatusBadge = (status: NotificationLogItem['status']) => {
    switch (status) {
      case 'read':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-[var(--brand)] bg-[var(--surface-secondary)] px-2 py-0.5 rounded-[4px]">
            <CheckCheck className="w-3 h-3" /> Read
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-[var(--semantic-success)] bg-[var(--surface-secondary)] px-2 py-0.5 rounded-[4px]">
            <CheckCheck className="w-3 h-3" /> Delivered
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-[var(--semantic-info)] bg-[var(--surface-secondary)] px-2 py-0.5 rounded-[4px]">
            <Clock className="w-3 h-3" /> Sent
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-[var(--semantic-warning)] bg-[var(--surface-secondary)] px-2 py-0.5 rounded-[4px]">
            <Clock className="w-3 h-3" /> Queued
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-[var(--semantic-error)] bg-[var(--surface-secondary)] px-2 py-0.5 rounded-[4px]">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
    }
  };

  return (
    <div className="p-4 bg-[var(--surface-primary)] rounded-[10px] border border-[var(--border-standard)] text-left transition-colors hover:border-[var(--brand)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-[6px] bg-[var(--bg-primary)] border border-[var(--border-standard)]">
            {getChannelIcon(item.channel)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[var(--text-primary)] text-sm">
                {item.subject}
              </span>
              <span className="text-[10px] uppercase font-mono font-bold text-[var(--text-muted)] px-1.5 py-0.2 bg-[var(--bg-primary)] border border-[var(--border-standard)] rounded-[4px]">
                {item.channel}
              </span>
            </div>
            <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">
              To: <span className="font-mono">{item.recipientAnonymized}</span> • Ref:{' '}
              <span className="font-mono font-medium text-[var(--text-primary)]">
                {item.complaintRef}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge(item.status)}
          <time className="text-[11px] font-mono text-[var(--text-muted)]">
            {item.timestamp ? item.timestamp.substring(11, 16) : 'Just now'}
          </time>
        </div>
      </div>

      <p className="mt-2.5 text-[13px] text-[var(--text-secondary)] bg-[var(--bg-primary)] p-2.5 rounded-[6px] border border-[var(--border-subtle)] font-mono leading-relaxed">
        {item.messageContent}
      </p>
    </div>
  );
};
