// CrimeSphere AI — Type Definitions

// ─── Severity / Priority ──────────────────────────────────────────────────────
export type Severity = 'red' | 'amber' | 'green' | 'navy';
export type Priority = 'urgent' | 'review' | 'routine';
export type CaseStatus = 'open' | 'closed' | 'pending';
export type CaseCategory = 'cyber' | 'property' | 'assault' | 'vehicle' | 'other';
export type AlertType = 'pattern' | 'patrol' | 'trend' | 'link' | 'system';
export type EvidenceType = 'document' | 'photo' | 'cctv' | 'sketch' | 'screenshot' | 'audio';
export type NodeType = 'suspect' | 'alias' | 'phone' | 'address' | 'fir' | 'vehicle' | 'associate';

// ─── Roles & RBAC ──────────────────────────────────────────────────────────────
export type Role =
  | 'commissioner'
  | 'inspector'
  | 'sub_inspector'
  | 'head_constable'
  | 'constable';

// ─── Officer ──────────────────────────────────────────────────────────────────
export interface Officer {
  id: string;
  name: string;
  initials: string;
  role: Role;
  rank: string;
  station: string;
  force: string;
  shift: string;
  badgeNumber: string;
  email: string;
  phone: string;
  joiningDate: string;
  currentAssignment: string;
  photoUrl: string | null;
  casesCount?: number;
  performanceScore?: number;
}

// ─── Police Station (Commissioner) ─────────────────────────────────────────────
export interface PoliceStation {
  id: string;
  name: string;
  code: string;
  stationHouseOfficer: string;
  address: string;
  phone: string;
  inspectorsCount: number;
  sisCount: number;
  headConstablesCount: number;
  constablesCount: number;
  activeCasesCount: number;
  pendingCasesCount: number;
  closedCasesCount: number;
  highPriorityCasesCount: number;
  status: 'operational' | 'busy' | 'alert';
}

// ─── Performance Metric (Commissioner) ─────────────────────────────────────────
export interface StationPerformance {
  stationId: string;
  stationName: string;
  resolutionRate: number; // percentage
  avgDisposalDays: number;
  pendingFirSlaBreach: number;
  evidenceCollectionRate: number;
  score: number; // out of 100
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export interface StatCard {
  id: string;
  value: number;
  label: string;
  delta: string;
  trend: 'up' | 'down' | 'neutral';
  color: 'red' | 'amber' | 'green' | 'navy';
}

// ─── Ticker Item ──────────────────────────────────────────────────────────────
export interface TickerItem {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  time: string;
}

// ─── Evidence ─────────────────────────────────────────────────────────────────
export interface Evidence {
  id: string;
  type: EvidenceType;
  title: string;
  description: string;
  date: string;
  url?: string;
  s3Key?: string;
  contentType?: string;
  uploadedBy?: string;
}

// ─── Timeline Entry ───────────────────────────────────────────────────────────
export interface TimelineEntry {
  id: string;
  date: string;
  time: string;
  event: string;
  officer: string;
  note?: string;
  type?: string;
}

// ─── Case ─────────────────────────────────────────────────────────────────────
export interface Case {
  id: string;
  firNumber: string;
  title: string;
  priority: Priority;
  filedDate: string;
  complainant: string;
  investigatingOfficer: string;
  description: string;
  entities: string[];
  footerNote: string;
  category: CaseCategory | string;
  status: CaseStatus;
  linkedCases: string[];
  sector: string;
  location: string;
  latitude?: number;
  longitude?: number;
  evidence: Evidence[];
  timeline: TimelineEntry[];
  createdAt?: string;
  complainantPhone?: string;
}

// ─── Alert ────────────────────────────────────────────────────────────────────
export interface Alert {
  id: string;
  type: AlertType;
  severity: Severity;
  title: string;
  description: string;
  time: string;
  timestamp: string;
  isRead: boolean;
  linkedCaseId: string | null;
}

// ─── Notification ─────────────────────────────────────────────────────────────
export interface Notification extends Alert {
  category: 'alert' | 'system';
}

// ─── Chat Message ─────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: 'user' | 'copilot';
  content: string;
  time: string;
  timestamp: string;
}

// ─── Network Graph ────────────────────────────────────────────────────────────
export interface NetworkNode {
  id: string;
  label: string;
  type: NodeType;
  x: number;
  y: number;
  radius: number;
  color: string;
}

export interface NetworkEdge {
  id: string;
  from: string;
  to: string;
  color: string;
  width: number;
}

// ─── Map ──────────────────────────────────────────────────────────────────────
export interface MapPin {
  id: string;
  type: 'hotspot' | 'watch' | 'cleared';
  severity: Severity;
  x: number;
  y: number;
  label: string;
  radius: number;
  dotRadius: number;
}

export interface PatrolUnit {
  id: string;
  x: number;
  y: number;
  label: string;
  status: 'active' | 'deviated' | 'inactive';
}

export interface Layer {
  id: string;
  label: string;
  enabled: boolean;
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
export interface BarDataPoint {
  x: string;
  y: number;
}

export interface ChartDataPoint {
  day: string;
  count: number;
  isToday: boolean;
}
