import React, { useState, useEffect } from 'react';
import { notificationService } from '../../lib/api';
import type { NotificationLogItem } from '../../types';
import { NotificationItem } from '../../components/admin/NotificationItem';
import {
  Bell,
  Filter,
} from 'lucide-react';

export const AdminNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationLogItem[]>([]);
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    notificationService.getAll().then(setNotifications).catch((error: Error) => {
      setLoadError(error.message);
    });
  }, []);

  const filtered = notifications.filter(
    (n) => channelFilter === 'all' || n.channel === channelFilter
  );

  return (
    <div className="space-y-6 text-left">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[6px] bg-[var(--surface-secondary)] border border-[var(--border-standard)] text-[var(--brand)] text-[11px] font-mono font-bold uppercase tracking-wider mb-2">
            <Bell className="w-3.5 h-3.5" />
            <span>MULTI-CHANNEL COMMUNICATION LOG</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] font-['Plus_Jakarta_Sans']">
            Passenger Notification Dispatch
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Backend notification records for WhatsApp, SMS, and Email milestones.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="p-4 rounded-[10px] border border-[var(--border-standard)] text-sm text-[var(--text-secondary)]">
          Notification data is unavailable from the configured backend: {loadError}
        </div>
      )}

      {/* Channel Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[var(--surface-primary)] rounded-[12px] border border-[var(--border-standard)]">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[var(--text-secondary)]">
          <Filter className="w-4 h-4" />
          <span>Filter by channel:</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setChannelFilter('all')}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-mono font-medium transition-all active:scale-[0.98] cursor-pointer ${
              channelFilter === 'all'
                ? 'bg-[var(--brand)] text-white'
                : 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-standard)] hover:bg-[var(--surface-secondary)]'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setChannelFilter('whatsapp')}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-mono font-medium transition-all active:scale-[0.98] cursor-pointer ${
              channelFilter === 'whatsapp'
                ? 'bg-[var(--semantic-success)] text-white'
                : 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-standard)] hover:bg-[var(--surface-secondary)]'
            }`}
          >
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => setChannelFilter('sms')}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-mono font-medium transition-all active:scale-[0.98] cursor-pointer ${
              channelFilter === 'sms'
                ? 'bg-[var(--semantic-info)] text-white'
                : 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-standard)] hover:bg-[var(--surface-secondary)]'
            }`}
          >
            SMS
          </button>
          <button
            type="button"
            onClick={() => setChannelFilter('email')}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-mono font-medium transition-all active:scale-[0.98] cursor-pointer ${
              channelFilter === 'email'
                ? 'bg-[var(--semantic-warning)] text-white'
                : 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-standard)] hover:bg-[var(--surface-secondary)]'
            }`}
          >
            Email
          </button>
        </div>
      </div>

      {/* Notification Stream */}
      <div className="space-y-3">
        {filtered.map((item) => (
          <NotificationItem key={item.id} item={item} />
        ))}
        {!loadError && filtered.length === 0 && (
          <p className="py-8 text-sm text-[var(--text-secondary)]">
            No notification records are available from the backend.
          </p>
        )}
      </div>
    </div>
  );
};
