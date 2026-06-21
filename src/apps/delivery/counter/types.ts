// Counter App Type Definitions

export type Page = 'Dashboard' | 'Inbox' | 'My Tickets' | 'All Tickets' | 'New Ticket' | 'Agents' | 'Settings';

export type Theme = 'light' | 'dark';

export enum TicketSeverity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low'
}

export enum InternalPriority {
  Unassigned = 'Unassigned',
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Urgent = 'Urgent'
}

export type AppKey = string;

export type CareerModuleKey = 'none' | 'journey' | 'coach' | 'cafe' | 'other';

export enum TicketCategory {
  Bug = 'Bug',
  FeatureIdea = 'Feature idea',
  Question = 'Question',
  AccountIssue = 'Account issue',
  Other = 'Other'
}

export type AgentRole = 'Admin' | 'Support' | 'Viewer' | 'Lead' | 'Bot' | 'Other';

export interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp: string;
}

export interface CounterTicketUser {
  id: string;
  full_name: string | null;
  email: string | null;
}

export interface Ticket {
  id: string;
  ticketNumber?: string; // human-friendly ticket number from counter_ticket.ticket_number
  subject: string;
  app: AppKey;
  app_id?: string | null; // UUID reference to boh_app
  app_context?: string | null; // BOH/cafe/etc context copied from boh_app for reporting and filtering
  app_area_id?: string | null; // UUID reference to counter_app_area
  release_version_id?: string | null; // UUID FK to boh_release_version
  release_version_label?: string | null;
  release_environment?: string | null;
  careerModule?: CareerModuleKey | null;
  category: TicketCategory;
  severity: TicketSeverity;
  statusId: string;
  statusKey: string;
  statusLabel: string;
  priorityId: string;
  priorityKey: string;
  priorityLabel: string;
  priorityWeight?: number | null;
  createdById?: string | null;
  assignedToId?: string | null;
  assignee: string;
  requesterName: string;
  requesterEmail: string;
  description: string;
  createdAt: Date;
  lastUpdatedAt: Date;
  source?: 'chatbot' | 'email' | 'manual';
  chatTranscript?: ChatMessage[];
  // User objects from explicit joins
  created_by_user?: CounterTicketUser | null;
  assigned_to_user?: CounterTicketUser | null;
}

export interface Agent {
  id: string;
  bohUserId?: string | null;
  name: string;
  email: string;
  role: AgentRole;
  isActive: boolean;
  canReceiveTickets: boolean;
}

export interface Activity {
  id?: string;
  authorId?: string | null;
  author: string;
  timestamp: string;
  note: string;
  type: string;
}

export interface TicketFilterState {
  statuses: Set<string>; // counter_ticket_status.id
  severities: Set<TicketSeverity>;
  apps: Set<AppKey>;
  priorities: Set<string>; // counter_ticket_priority.id
  assignees: Set<string>;
  releases: Set<string>; // boh_release_version.id or 'none'
  appAreas: Set<string>; // counter_app_area.id
}

// Re-export BohUser from parent types
export type { BohUser } from '../../../types';

export const PRIORITY_OPTIONS: Record<InternalPriority, string> = {
  [InternalPriority.Unassigned]: 'Unassigned',
  [InternalPriority.Low]: 'Low',
  [InternalPriority.Medium]: 'Medium',
  [InternalPriority.High]: 'High',
  [InternalPriority.Urgent]: 'Urgent'
};

// Counter App Area from Supabase
export type CounterAppArea = {
  id: string;
  code: string;
  label: string;
  audience: 'external' | 'internal';
  is_active: boolean;
  sort_order: number;
};

export type CounterAppOption = {
  id: string;
  slug: string | null;
  name: string | null;
  app_context: string | null;
  type: 'internal_tool' | 'external_app' | string;
  surface?: 'internal' | 'external' | 'hybrid' | string | null;
  primary_color?: string | null;
  sort_order?: number | null;
};

// Counter Ticket Status from lookup table
export type CounterTicketStatus = {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  sort_order?: number | null;
  color_token?: string | null;
};

// Counter Ticket Priority from lookup table
export type CounterTicketPriority = {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  weight?: number | null;
  color_token?: string | null;
};

export interface ReleaseVersion {
  id: string;
  environment?: string | null;
  version_label: string;
  version_number?: string | null;
  release_year?: number | null;
  release_cycle?: string | null;
  release_tier?: 'major' | 'minor' | null;
  release_date?: string | null;
  sort_date?: string | null;
  status?: string;
  is_active: boolean;
  notes?: string | null;
  ticket_count?: number | null;
  parent_major_release_id?: string | null;
  created_at?: string | null;
}


