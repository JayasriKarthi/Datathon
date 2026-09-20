// CrimeSphere AI — Copilot API
import { axiosClient } from './axiosClient';
import type { ChatMessage } from '../types';

import { USE_MOCK } from './config';

const MOCK_RESPONSES: Record<string, string> = {
  default:
    "I've searched the case files and found relevant matches. Let me pull up the details for you — check the Case Files section for the full records.",
  'chain snatch':
    "Three active chain snatching cases near Hoodi — FIR 1142, 1098, and 1076. All within half a kilometre of Hoodi Circle, all evening hours. Same two-wheeler MO. I'd recommend pulling CCTV from the ITPL junction camera.",
  'cyber fraud':
    "Nine UPI fraud complaints from Whitefield in the last 48 hours, against a weekly average of 3. This looks like a coordinated campaign. FIR 1156 (QuickCash Pro) may be part of the same network.",
  vehicle:
    "Vehicle KA-05-AB-4471 is flagged across two separate FIRs — KA-CR-1149 (vehicle theft, ITPL) and an older complaint from Sector 6. Recommend querying the VAHAN database for owner history.",
  patrol:
    "PCR-14 has been off-route near ITPL Main Road for the past 18 minutes. PCR-09 and PCR-03 are on assigned routes. All sectors are covered.",
  summary:
    "Current shift summary: 27 open cases, 6 FIRs filed today, 18 patrol units active, 4 alerts requiring attention. Priority cases: KA-CR-1142 (chain snatching cluster), KA-CR-1156 (loan app harassment).",
};

function generateMockResponse(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('chain') || q.includes('snatch') || q.includes('hoodi')) {
    return MOCK_RESPONSES['chain snatch'];
  }
  if (q.includes('cyber') || q.includes('fraud') || q.includes('upi')) {
    return MOCK_RESPONSES['cyber fraud'];
  }
  if (q.includes('vehicle') || q.includes('car') || q.includes('bike')) {
    return MOCK_RESPONSES['vehicle'];
  }
  if (q.includes('patrol') || q.includes('pcr') || q.includes('unit')) {
    return MOCK_RESPONSES['patrol'];
  }
  if (q.includes('summary') || q.includes('overview') || q.includes('today')) {
    return MOCK_RESPONSES['summary'];
  }
  return MOCK_RESPONSES['default'];
}

export const copilotApi = {
  sendMessage: async (query: string, history: ChatMessage[]): Promise<string> => {
    if (USE_MOCK) {
      // Simulate network latency
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 800));
      return generateMockResponse(query);
    }
    // The model can take a while on the first call (Lambda cold start + tool use), so allow 30s
    const { data } = await axiosClient.post<{ response: string; source?: 'bedrock' | 'fallback' }>(
      '/copilot/query',
      { query, history: history.map((m) => ({ role: m.role, content: m.content })) },
      { timeout: 30000 }
    );
    return data.response;
  },
};
