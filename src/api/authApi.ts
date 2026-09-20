// CrimeSphere AI — Auth API (Amazon Cognito behind POST /auth/login)
import { axiosClient } from './axiosClient';
import type { Officer } from '../types';

export interface LoginResponse {
  token: string;
  refreshToken: string | null;
  expiresIn: number;
  officer: Officer;
}

export const authApi = {
  login: async (badgeNumber: string, pin: string): Promise<LoginResponse> => {
    const { data } = await axiosClient.post<LoginResponse>('/auth/login', { badgeNumber, pin });
    return data;
  },
};
