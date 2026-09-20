// CrimeSphere AI — Zustand Auth Store
import { create } from 'zustand';
import type { Officer, Role } from '../types';
import { MOCK_ROLE_ACCOUNTS, MOCK_OFFICER } from '../constants/mockData';
import { authApi } from '../api/authApi';
import { USE_MOCK } from '../api/config';
import { session } from '../api/session';
import { apiErrorMessage } from '../api/errors';
import { useCaseStore } from './caseStore';

interface AuthState {
  isAuthenticated: boolean;
  officer: Officer | null;
  isLoading: boolean;
  error: string | null;
  login: (badgeNumber: string, pin: string, selectedRole?: Role) => Promise<void>;
  switchRole: (role: Role) => void;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  officer: null,
  isLoading: false,
  error: null,

  login: async (badgeNumber: string, pin: string, selectedRole?: Role) => {
    set({ isLoading: true, error: null });

    if (!USE_MOCK) {
      // Real login: Cognito via the backend. The server decides the role, not the UI.
      try {
        const res = await authApi.login(badgeNumber.trim(), pin.trim());
        session.setToken(res.token);
        set({ isAuthenticated: true, officer: res.officer, isLoading: false });
        void useCaseStore.getState().fetchCases();
      } catch (e) {
        set({ error: apiErrorMessage(e, 'Invalid badge number or PIN. Please try again.'), isLoading: false });
      }
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 800));

    const cleanBadge = badgeNumber.trim().toUpperCase();

    // Check specific role badge numbers
    let matchedOfficer: Officer | undefined;
    for (const key of Object.keys(MOCK_ROLE_ACCOUNTS)) {
      if (MOCK_ROLE_ACCOUNTS[key].badgeNumber.toUpperCase() === cleanBadge) {
        matchedOfficer = MOCK_ROLE_ACCOUNTS[key];
        break;
      }
    }

    if (!matchedOfficer && selectedRole && MOCK_ROLE_ACCOUNTS[selectedRole]) {
      matchedOfficer = MOCK_ROLE_ACCOUNTS[selectedRole];
    }

    if (!matchedOfficer && cleanBadge.length > 3 && pin.length >= 4) {
      // Default demo officer
      matchedOfficer = MOCK_OFFICER;
    }

    if (matchedOfficer && pin.length >= 4) {
      set({ isAuthenticated: true, officer: matchedOfficer, isLoading: false });
    } else {
      set({ error: 'Invalid badge number or PIN. Please try again.', isLoading: false });
    }
  },

  switchRole: (role: Role) => {
    if (MOCK_ROLE_ACCOUNTS[role]) {
      set({ officer: MOCK_ROLE_ACCOUNTS[role], isAuthenticated: true });
    }
  },

  logout: () => {
    session.setToken(null);
    useCaseStore.getState().reset();
    set({ isAuthenticated: false, officer: null, error: null });
  },

  clearError: () => set({ error: null }),
}));

// An expired/invalid token (HTTP 401) signs the officer out
session.setUnauthorizedHandler(() => useAuthStore.getState().logout());
