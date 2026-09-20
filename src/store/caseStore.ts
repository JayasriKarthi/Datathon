// CrimeSphere AI — Zustand Case Store
import { create } from 'zustand';
import type { Case } from '../types';
import { MOCK_CASES } from '../constants/mockData';
import { casesApi, type CreateCasePayload } from '../api/casesApi';
import { USE_MOCK } from '../api/config';
import { apiErrorMessage } from '../api/errors';

interface CaseState {
  cases: Case[];
  activeFilter: string;
  selectedCaseId: string | null;
  searchQuery: string;
  isLoading: boolean;
  loadError: string | null;
  fetchCases: () => Promise<void>;
  createCase: (payload: CreateCasePayload) => Promise<Case>;
  reset: () => void;
  setFilter: (filter: string) => void;
  setSelectedCase: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  addCase: (newCase: Case) => void;
  deleteCase: (id: string) => void;
  getCaseById: (id: string) => Case | undefined;
  getFilteredCases: () => Case[];
}

export const useCaseStore = create<CaseState>((set, get) => ({
  cases: USE_MOCK ? MOCK_CASES : [],
  activeFilter: 'all',
  selectedCaseId: null,
  searchQuery: '',
  isLoading: false,
  loadError: null,

  // Load the case list from the backend (no-op in offline/mock mode)
  fetchCases: async () => {
    if (USE_MOCK) return;
    set({ isLoading: true, loadError: null });
    try {
      set({ cases: await casesApi.getAll(), isLoading: false });
    } catch (e) {
      set({ isLoading: false, loadError: apiErrorMessage(e, 'Could not load cases.') });
    }
  },

  // Register a new FIR. Throws on failure so the form can show the reason.
  createCase: async (payload) => {
    const created = await casesApi.create(payload);
    set((state) => ({ cases: [created, ...state.cases] }));
    return created;
  },

  reset: () => set({ cases: USE_MOCK ? MOCK_CASES : [], selectedCaseId: null, searchQuery: '', activeFilter: 'all', loadError: null }),

  setFilter: (filter) => set({ activeFilter: filter }),
  setSelectedCase: (id) => set({ selectedCaseId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  // Optimistic: remove locally, then tell the server. If the server refuses (e.g. role
  // lacks DELETE_CASES) reload the real list so the case reappears.
  deleteCase: (id) => {
    set((state) => ({ cases: state.cases.filter((c) => c.id !== id) }));
    if (!USE_MOCK) casesApi.remove(id).catch(() => get().fetchCases());
  },
  addCase: (newCase) => set((state) => ({ cases: [newCase, ...state.cases] })),

  getCaseById: (id) => get().cases.find((c) => c.id === id),

  getFilteredCases: () => {
    const { cases, activeFilter, searchQuery } = get();
    let filtered = cases;

    if (activeFilter !== 'all') {
      if (activeFilter === 'urgent') {
        filtered = filtered.filter((c) => c.priority === 'urgent');
      } else if (activeFilter === 'unassigned') {
        filtered = filtered.filter((c) => !c.investigatingOfficer);
      } else {
        filtered = filtered.filter((c) => c.category === activeFilter);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.complainant.toLowerCase().includes(q) ||
          c.investigatingOfficer.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.entities.some((e) => e.toLowerCase().includes(q))
      );
    }

    return filtered;
  },
}));
