// CrimeSphere AI — Dashboard stats API (live counts computed from DynamoDB)
import { axiosClient } from './axiosClient';
import type { StatCard } from '../types';

export const statsApi = {
  getAll: async (): Promise<StatCard[]> => {
    const { data } = await axiosClient.get<StatCard[]>('/stats');
    return data;
  },
};
