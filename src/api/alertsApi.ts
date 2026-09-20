// CrimeSphere AI — Alerts API
import { axiosClient } from './axiosClient';
import type { Alert } from '../types';
import { MOCK_ALERTS } from '../constants/mockData';

import { USE_MOCK } from './config';

export const alertsApi = {
  getAll: async (): Promise<Alert[]> => {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 500));
      return MOCK_ALERTS;
    }
    const { data } = await axiosClient.get<Alert[]>('/alerts');
    return data;
  },

  markRead: async (id: string): Promise<void> => {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 200));
      return;
    }
    await axiosClient.patch(`/alerts/${id}/read`);
  },

  markAllRead: async (): Promise<void> => {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 200));
      return;
    }
    await axiosClient.post('/alerts/mark-all-read');
  },
};
