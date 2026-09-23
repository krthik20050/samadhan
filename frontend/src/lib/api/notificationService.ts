import type { NotificationLogItem } from '../../types';
import { authService } from '../auth';
import { api } from './client';

export const notificationService = {
  async getAll(): Promise<NotificationLogItem[]> {
    // Data breach protection: notification dispatch audit log restricted to authorized staff
    if (!authService.isAdmin()) {
      throw new Error('Access Denied: Administrative authorization required to view communication audit logs.');
    }
    return api<NotificationLogItem[]>('/api/v1/notifications');
  },

  async logNotification(
    notification: Omit<NotificationLogItem, 'id' | 'timestamp'>
  ): Promise<NotificationLogItem> {
    void notification;
    throw new Error('Notification dispatch is not available from the configured backend.');
  },
};
