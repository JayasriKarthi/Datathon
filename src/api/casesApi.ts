// CrimeSphere AI — Cases API
import { axiosClient } from './axiosClient';
import { USE_MOCK } from './config';
import type { Case, Evidence, EvidenceType, Priority } from '../types';
import { MOCK_CASES } from '../constants/mockData';

/** Fields collected by the Register FIR form. */
export interface CreateCasePayload {
  title: string;
  description: string;
  complainant: string;
  complainantPhone?: string;
  category: string;
  priority: Priority;
  location: string;
  sector: string;
  entities: string[];
  /** Used only in offline/mock mode; the server always sets the officer from the login token. */
  officerName?: string;
}

export interface PresignedPost {
  url: string;
  fields: Record<string, string>;
}

function mockFirNumber(): string {
  const d = new Date();
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `KA-CR-${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}-${seq}`;
}

function buildMockCase(p: CreateCasePayload): Case {
  const firNumber = mockFirNumber();
  const day = new Date().toISOString().slice(0, 10);
  const officer = p.officerName ?? 'Duty Officer';
  return {
    id: `CASE-${Date.now()}`,
    firNumber,
    title: p.title,
    priority: p.priority,
    filedDate: day,
    complainant: p.complainant,
    investigatingOfficer: officer,
    description: p.description,
    entities: p.entities,
    footerNote: `Filed by ${officer} on ${day}`,
    category: p.category,
    status: 'open',
    linkedCases: [],
    sector: p.sector || 'Sector 4',
    location: p.location,
    evidence: [],
    timeline: [
      {
        id: `evt-${Date.now()}`,
        date: day,
        time: '',
        event: 'FIR Registered',
        officer,
        note: `FIR ${firNumber} registered. Complainant: ${p.complainant}.`,
        type: 'note',
      },
    ],
  };
}

export const casesApi = {
  getAll: async (): Promise<Case[]> => {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 600));
      return MOCK_CASES;
    }
    const { data } = await axiosClient.get<Case[]>('/cases');
    return data;
  },

  getById: async (id: string): Promise<Case> => {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 400));
      const found = MOCK_CASES.find((c) => c.id === id);
      if (!found) throw new Error(`Case ${id} not found`);
      return found;
    }
    const { data } = await axiosClient.get<Case>(`/cases/${id}`);
    return data;
  },

  search: async (query: string): Promise<Case[]> => {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 400));
      const q = query.toLowerCase();
      return MOCK_CASES.filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.complainant.toLowerCase().includes(q)
      );
    }
    const { data } = await axiosClient.get<Case[]>('/cases/search', { params: { q: query } });
    return data;
  },

  create: async (payload: CreateCasePayload): Promise<Case> => {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 600));
      return buildMockCase(payload);
    }
    const { officerName: _ignored, ...body } = payload;
    const { data } = await axiosClient.post<Case>('/cases', body);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    if (USE_MOCK) return;
    await axiosClient.delete(`/cases/${id}`);
  },

  // ── Evidence upload (two steps; the file goes straight to S3, not through Lambda) ──
  // 1) register the evidence and get a presigned S3 POST
  addEvidence: async (
    caseId: string,
    meta: { type: EvidenceType; title: string; description?: string; filename: string; contentType: string }
  ): Promise<{ evidence: Evidence; upload: PresignedPost }> => {
    const { data } = await axiosClient.post(`/cases/${caseId}/evidence`, { description: '', ...meta });
    return data;
  },

  // 2) send the file to S3. `file` is a Blob on web, or { uri, name, type } in React Native.
  uploadToS3: async (upload: PresignedPost, file: Blob | { uri: string; name: string; type: string }): Promise<void> => {
    const form = new FormData();
    Object.entries(upload.fields).forEach(([k, v]) => form.append(k, v));
    form.append('file', file as any); // S3 requires the file to be the LAST field
    const res = await fetch(upload.url, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  },
};
