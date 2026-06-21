// Menu Product Release Reports Type Definitions
// These types support the strategic reporting feature for Menu

export type ReportWindow = '90days' | 'next_quarter' | '6months' | '12months';

export type InitiativeReadiness =
  | 'on_track'
  | 'needs_attention'
  | 'at_risk'
  | 'parked'
  | 'no_coding_planned'
  | 'complete';

export type ReleaseReadiness = 'ready' | 'in_progress' | 'blocked' | 'at_risk';

export interface QuarterInfo {
  id: string;
  year: number;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  start_date: string;
  end_date: string;
  label: string;
}

export interface ReleaseVersionInfo {
  id: string;
  version_label: string;
  version_number: string | null;
  release_tier: 'major' | 'minor' | 'patch';
  release_date: string;
  release_year: number;
  release_cycle: string;
  quarter: string | null;
  status: string;
  summary: string | null;
  parent_major_release_id: string | null;
  parent_major_release?: {
    id: string;
    version_label: string;
    version_number: string | null;
  } | null;
}

export interface InitiativeInfo {
  id: string;
  title: string;
  description: string | null;
  status: string;
  planning_stage_key: string;
  planning_stage_label: string;
  target_quarter: string | null;
  target_year: number | null;
  no_coding_planned: boolean;
  is_archived: boolean;
  progress: number;
  app_id: string;
  app_name: string;
  app_slug: string;
  major_release_id: string | null;
  major_release?: ReleaseVersionInfo | null;
  readiness: InitiativeReadiness;
  readiness_reason: string;
  linked_minor_releases: ReleaseVersionInfo[];
  user_story_count: number;
  incomplete_user_story_count: number;
  ticket_count: number;
  outstanding_ticket_count: number;
  high_priority_ticket_count: number;
  governance_notes: string | null;
}

export interface UserStoryInfo {
  id: string;
  title: string;
  description: string | null;
  status: string;
  story_points: number | null;
  estimated_hours: number | null;
  is_archived: boolean;
  completed_at: string | null;
  target_release_id: string | null;
  target_release?: ReleaseVersionInfo | null;
}

export interface TicketInfo {
  id: string;
  ticket_number: string | null;
  subject: string;
  category: string;
  severity: string;
  status_key: string;
  status_label: string;
  priority_key: string;
  priority_label: string;
  priority_weight: number;
  created_at: string;
  assigned_to_name: string | null;
  is_outstanding: boolean;
}

export interface AppSummary {
  app_id: string;
  app_name: string;
  app_slug: string;
  initiative_count: number;
  active_initiative_count: number;
  planned_initiative_count: number;
  parked_initiative_count: number;
  at_risk_count: number;
  no_coding_count: number;
  total_user_stories: number;
  incomplete_user_stories: number;
  total_tickets: number;
  outstanding_tickets: number;
  high_priority_tickets: number;
  initiatives: InitiativeInfo[];
}

export interface OverviewReportData {
  report_window: ReportWindow;
  window_start_date: string;
  window_end_date: string;
  generated_at: string;
  apps: AppSummary[];
  total_initiatives: number;
  total_active_initiatives: number;
  total_planned_initiatives: number;
  total_parked_initiatives: number;
  total_at_risk: number;
  total_user_stories: number;
  total_incomplete_stories: number;
  total_tickets: number;
  total_outstanding_tickets: number;
  total_high_priority_tickets: number;
}

export interface InitiativeDetailReport {
  initiative: InitiativeInfo;
  user_stories: UserStoryInfo[];
  tickets: TicketInfo[];
  related_minor_releases: ReleaseVersionInfo[];
  generated_at: string;
}

export interface MinorReleaseReport {
  release: ReleaseVersionInfo;
  parent_major_release: ReleaseVersionInfo | null;
  related_initiatives: InitiativeInfo[];
  outstanding_tickets: TicketInfo[];
  completed_tickets: TicketInfo[];
  incomplete_user_stories: UserStoryInfo[];
  readiness: ReleaseReadiness;
  readiness_reason: string;
  generated_at: string;
}

export interface ExecutiveSummaryMetrics {
  total_apps_with_active_initiatives: number;
  initiatives_at_risk: number;
  initiatives_without_major_release: number;
  initiatives_without_user_stories: number;
  total_incomplete_stories: number;
  total_open_tickets: number;
  total_high_priority_open_tickets: number;
  releases_with_unresolved_work: number;
}

export interface InitiativeRiskItem {
  initiative_id: string;
  initiative_title: string;
  app_name: string;
  risk_reason: string;
  severity: 'high' | 'medium' | 'low';
}

export interface ExecutiveSummaryReport {
  report_window: ReportWindow;
  window_start_date: string;
  window_end_date: string;
  generated_at: string;
  metrics: ExecutiveSummaryMetrics;
  at_risk_initiatives: InitiativeRiskItem[];
  releases_needing_attention: {
    release_id: string;
    version_label: string;
    unresolved_ticket_count: number;
    incomplete_story_count: number;
  }[];
  summary_paragraph: string;
}

export interface ReportFilters {
  report_window: ReportWindow;
  app_id?: string;
  quarter?: string;
  year?: number;
  readiness?: InitiativeReadiness;
  planning_stage?: string;
  ticket_status?: string;
  story_completion?: 'complete' | 'incomplete' | 'all';
  // Forge-specific filters
  environment?: 'internal' | 'external';
  release_tier?: 'major' | 'minor' | 'patch';
  status?: string;
}

// API Request/Response types
export interface ProductReleaseReportRequest {
  report_window: ReportWindow;
  app_id?: string;
  quarter?: string;
  year?: number;
  readiness_filter?: InitiativeReadiness;
}

export interface ProductReleaseReportResponse {
  success: boolean;
  data?: OverviewReportData;
  error?: string;
}

export interface InitiativeDetailRequest {
  initiative_id: string;
}

export interface InitiativeDetailResponse {
  success: boolean;
  data?: InitiativeDetailReport;
  error?: string;
}

export interface MinorReleaseReportRequest {
  release_id: string;
}

export interface MinorReleaseReportResponse {
  success: boolean;
  data?: MinorReleaseReport;
  error?: string;
}

export interface ExecutiveSummaryRequest {
  report_window: ReportWindow;
}

export interface ExecutiveSummaryResponse {
  success: boolean;
  data?: ExecutiveSummaryReport;
  error?: string;
}
