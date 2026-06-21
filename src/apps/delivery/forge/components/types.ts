export type ReleaseTier = 'major' | 'minor';
export type ReleaseQuarterFilter = 'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type ReleaseStatus = 'planned' | 'in progress' | 'released' | 'deprecated';

export interface ReleaseVersionUsageRow {
  id: string;
  version_label: string | null;
  release_tier: ReleaseTier;
  version_number: string | null;
  release_year: number | null;
  release_cycle: string | null;
  release_date: string | null;
  rollout_date?: string | null;
  sprint_start_date?: string | null;
  sprint_end_date?: string | null;
  testing_start_date?: string | null;
  testing_end_date?: string | null;
  release_candidate_date?: string | null;
  status: string;
  is_active: boolean;
  ticket_count?: number | null;
  active_ticket_count?: number | null;
  initiative_count?: number | null;
  active_task_count?: number | null;
  is_used?: boolean | null;
  notes: string | null;
  sort_date?: string | null;
  created_at: string | null;
  updated_at?: string | null;
  parent_major_release_id?: string | null;
  environment?: string | null;
}

export interface TicketRow {
  id: string;
  ticket_number: string | null;
  subject: string | null;
  requester_name: string | null;
  requester_email: string | null;
  created_at: string | null;
  updated_at: string | null;
  status?: { key: string; label: string } | null;
  priority?: { key: string; label: string; weight: number } | null;
}

export interface InitiativeRow {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  target_quarter: string | null;
  target_year: number | null;
  progress: number | null;
  major_release_id: string | null;
  app_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  app_name?: string | null;
}

export type InitiativesByReleaseId = Record<string, InitiativeRow[]>;

export const QUARTER_FILTERS: ReleaseQuarterFilter[] = ['all', 'Q1', 'Q2', 'Q3', 'Q4'];

export const QUARTER_LABELS: Record<ReleaseQuarterFilter, string> = {
  all: 'All quarters',
  Q1: 'Q1',
  Q2: 'Q2',
  Q3: 'Q3',
  Q4: 'Q4',
};
