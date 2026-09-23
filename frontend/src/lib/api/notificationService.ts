import type { NotificationLogItem } from '../../types';
import { MOCK_NOTIFICATIONS } from '../mockData';

let storedNotifications: NotificationLogItem[] = [...MOCK_NOTIFICATIONS];

export const notificationService = {
  async getAll(): Promise<NotificationLogItem[]> {
    await new Promise((res) => setTimeout(res, 150));
    return [...storedNotifications];
  },

  async logNotification(
    notification: Omit<NotificationLogItem, 'id' | 'timestamp'>
  ): Promise<NotificationLogItem> {
    const newItem: NotificationLogItem = {
      ...notification,
      id: `notif-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    storedNotifications = [newItem, ...storedNotifications];
    return newItem;
  },
};
