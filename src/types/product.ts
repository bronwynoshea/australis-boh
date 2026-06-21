// Product Management Type Definitions

export interface PlanningStage {
  id: string;
  key: string;
  label: string;
  description?: string;
  color_token?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface ProductAppSummary {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  route?: string | null;
  primary_color?: string | null;
  type: 'internal_tool' | 'external_app';
  location?: 'Internal' | 'External' | null;
  surface?: 'internal' | 'external' | 'hybrid' | null;
  offering_status?: 'planned' | 'active' | 'paused' | 'retired' | null;
  operational_since?: string | null;
  is_active: boolean;
  sort_order?: number | null;
}

export interface ProductAppModule {
  id: string;
  app_id: string;
  key: string;
  label: string;
  description?: string | null;
  route: string;
  icon_key?: string | null;
  group_label?: string | null;
  surface?: 'internal' | 'external' | 'hybrid' | null;
  offering_status?: 'planned' | 'active' | 'paused' | 'retired' | null;
  operational_since?: string | null;
  sort_order: number;
  is_primary: boolean;
  is_active: boolean;
}

export interface ProductAppInput {
  slug: string;
  name: string;
  description?: string | null;
  route?: string | null;
  external_url?: string | null;
  primary_color?: string | null;
  type: 'internal_tool' | 'external_app';
  location?: 'Internal' | 'External' | null;
  surface?: 'internal' | 'external' | 'hybrid' | null;
  offering_status?: 'planned' | 'active' | 'paused' | 'retired' | null;
  operational_since?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
}

export interface ProductAppModuleInput {
  app_id: string;
  key: string;
  label: string;
  description?: string | null;
  route?: string | null;
  icon_key?: string | null;
  group_label?: string | null;
  surface?: 'internal' | 'external' | 'hybrid' | null;
  offering_status?: 'planned' | 'active' | 'paused' | 'retired' | null;
  operational_since?: string | null;
  sort_order?: number | null;
  is_primary?: boolean;
  is_active?: boolean;
}

export interface PriorityOption {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  weight: number;
  color_token?: string | null;
  is_active?: boolean;
}

export interface Initiative {
  id: string;
  title: string; // Changed from 'name' to 'title'
  description: string;
  status: 'planned' | 'in progress' | 'blocked' | 'done' | 'cancelled'; // Updated status values
  target_quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  target_year: number;
  progress: number; // 0-100
  owner_user_id?: string; // Foreign key to boh_user
  major_release_id?: string; // Existing field
  app_id: string;
  module_id?: string | null;
  planning_stage_id?: string | null;
  priority_id?: string | null;
  governance_notes?: string | null;
  target_start_date?: string; // Existing field
  target_end_date?: string; // Existing field
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Menu-to-Forge handoff fields (initiatives remain Menu-owned; Forge reads these for intake/execution)
  forge_status_id?: string | null;
  committed_quarter_calendar_id?: string | null;
  submitted_to_forge_at?: string | null;
  forge_reviewed_at?: string | null;
  forge_reviewed_by?: string | null;
  forge_decision_notes?: string | null;
  // Computed fields
  ticket_count?: number;
  release_count?: number;
  workstream_count?: number;
  user_story_count?: number;
  task_count?: number;
  has_release?: boolean;
  has_tickets?: boolean;
  releases?: Release[];
  // Optional joined fields
  owner_user?: {
    id: string;
    full_name: string | null;
    email: string | null;
    status: string;
  } | null;
  major_release?: {
    id: string;
    version_label: string;
    status: string;
    release_date?: string;
  } | null;
  app?: ProductAppSummary | null;
  module?: ProductAppModule | null;
  planning_stage?: PlanningStage | null;
  priority?: PriorityOption | null;
  // Forge handoff status lookup
  forge_status?: {
    id: string;
    key: string;
    label: string;
    description?: string | null;
    color_token?: string | null;
    sort_order: number;
    is_active: boolean;
  } | null;
  // Committed quarter lookup
  committed_quarter?: {
    id: string;
    year: number;
    quarter: string;
    start_date: string;
    end_date: string;
    label: string;
    is_active: boolean;
  } | null;
}

export interface Release {
  id: string;
  version_label: string; // Changed from 'name' to 'version_label'
  version_number?: string;
  release_tier: 'major' | 'minor' | 'patch'; // Changed from 'type' to 'release_tier'
  status: 'planned' | 'in-progress' | 'released' | 'deprecated'; // Updated status values
  release_date?: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
  cycle: string;
  environment: 'internal' | 'external';
  app_id?: string;
  summary?: string;
  is_active: boolean; // Existing field
  notes?: string; // Existing field
  parent_major_release_id?: string; // Existing field
  created_at: string;
  updated_at: string;
  // Computed fields
  ticket_count?: number;
  initiatives?: Initiative[];
}

export interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  app_context: 'boh' | 'cafe' | 'career_studio' | 'counter' | 'talent' | 'other';
  release_version_id?: string;
  release_version_label?: string;
  category: string;
  severity: string;
  status_id: string;
  status_key: string;
  status_label: string;
  priority_id: string;
  priority_key: string;
  priority_label: string;
  priority_weight?: number;
  requester_email: string;
  requester_name?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface QuarterlyMetrics {
  total_initiatives: number;
  active_initiatives: number;
  completed_initiatives: number;
  total_releases: number;
  major_releases: number;
  minor_releases: number;
  total_tickets: number;
  internal_tickets: number;
  external_tickets: number;
  average_initiative_progress: number;
  releases_per_initiative: number;
}

export interface ProductOverview {
  metrics: {
    active_initiatives: number;
    total_initiatives: number;
    active_releases: number;
    total_releases: number;
    internal_tickets: number;
    external_tickets: number;
  };
  recent_initiatives: Initiative[];
  recent_releases: Release[];
  upcoming_releases: Release[];
}

export interface InitiativeRelease {
  initiative_id: string;
  release_id: string;
  created_at: string;
}

export interface CreateInitiativeInput {
  title: string;
  description: string;
  status: Initiative['status'];
  target_quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  target_year: number;
  app_id: string;
  planning_stage_id?: string | null;
  module_id?: string | null;
  owner_user_id?: string;
  priority_id?: string | null;
  major_release_id?: string;
  target_start_date?: string;
  target_end_date?: string;
  governance_notes?: string | null;
}

export interface UpdateInitiativeInput {
  title?: string;
  description?: string;
  status?: Initiative['status'];
  target_quarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  target_year?: number;
  progress?: number;
  app_id?: string;
  planning_stage_id?: string | null;
  module_id?: string | null;
  owner_user_id?: string;
  priority_id?: string | null;
  major_release_id?: string;
  target_start_date?: string;
  target_end_date?: string;
  governance_notes?: string | null;
  forge_status_id?: string | null;
  committed_quarter_calendar_id?: string | null;
  submitted_to_forge_at?: string | null;
  forge_reviewed_at?: string | null;
  forge_reviewed_by?: string | null;
  forge_decision_notes?: string | null;
  is_archived?: boolean;
}

export interface CreateReleaseInput {
  version_label: string;
  version_number?: string;
  release_tier: 'major' | 'minor' | 'patch';
  status?: Release['status'];
  release_date?: string;
  environment: 'internal' | 'external';
  app_id?: string;
  summary?: string;
  notes?: string;
  parent_major_release_id?: string;
  initiative_ids?: string[];
}

export interface UpdateReleaseInput {
  version_label?: string;
  version_number?: string;
  release_tier?: 'major' | 'minor' | 'patch';
  status?: Release['status'];
  release_date?: string;
  environment?: 'internal' | 'external';
  app_id?: string;
  summary?: string;
  notes?: string;
  parent_major_release_id?: string;
  initiative_ids?: string[];
}

export interface ProductFilters {
  quarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year?: number;
  status?: string;
  owner_user_id?: string;
  app_id?: string;
  module_id?: string | null;
  planning_stage_id?: string;
  priority_id?: string;
  include_archived?: boolean;
  has_release?: boolean;
  has_tickets?: boolean;
  search?: string;
}

export interface QuarterlyReportData {
  quarter: string;
  year: number;
  metrics: QuarterlyMetrics;
  initiatives: Initiative[];
  releases: Release[];
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pages: number;
  has_more: boolean;
}

// Error types
export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

// User Story Types
export interface UserStory {
  id: string;
  initiative_id: string;
  title: string;
  description?: string;
  acceptance_criteria?: string;
  story_points?: number;
  estimated_hours?: number;
  status: 'not_started' | 'in_progress' | 'blocked' | 'review' | 'done' | 'cancelled';
  priority_id?: string;
  owner_user_id?: string;
  target_release_id?: string;
  blocked_reason?: string;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  progress: number; // 0-100
  // Optional joined fields
  priority?: {
    id: string;
    key: string;
    label: string;
    weight: number;
    color_token?: string;
  };
  owner_user?: {
    id: string;
    full_name: string | null;
    email: string | null;
    status: string;
  };
  target_release?: {
    id: string;
    version_label: string;
    status: string;
    release_date?: string;
  };
  // Computed fields
  task_count?: number;
  completed_task_count?: number;
  tasks?: Task[];
}

export interface Task {
  id: string;
  user_story_id: string;
  title: string;
  description?: string;
  status: 'not_started' | 'in_progress' | 'blocked' | 'review' | 'done';
  assigned_to?: string;
  estimated_hours?: number;
  actual_hours?: number;
  blocked_reason?: string;
  sort_order: number;
  created_by?: string;
  agent_engagement_type_id?: string | null;
  agent_engagement_status_id?: string | null;
  agent_capability_id?: string | null;
  agent_readiness_notes?: string | null;
  agent_ready_at?: string | null;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  // Optional joined fields
  assigned_user?: {
    id: string;
    full_name: string | null;
    email: string | null;
    status: string;
  };
  created_user?: {
    id: string;
    full_name: string | null;
    email: string | null;
    status: string;
  };
  agent_engagement_type?: {
    id: string;
    key: string;
    label: string;
    description?: string | null;
    sort_order?: number;
    is_active?: boolean;
  } | null;
  agent_engagement_status?: {
    id: string;
    key: string;
    label: string;
    description?: string | null;
    sort_order?: number;
    is_active?: boolean;
  } | null;
  agent_capability?: {
    id: string;
    key: string;
    label: string;
    description?: string | null;
    sort_order?: number;
    is_active?: boolean;
  } | null;
  // Computed fields
  comment_count?: number;
  comments?: TaskComment[];
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  // Optional joined fields
  author?: {
    id: string;
    full_name: string | null;
    email: string | null;
    status: string;
  };
}

// Input types for CRUD operations
export interface CreateUserStoryInput {
  initiative_id: string;
  title: string;
  description?: string;
  acceptance_criteria?: string;
  story_points?: number;
  estimated_hours?: number;
  status?: UserStory['status'];
  priority_id?: string;
  owner_user_id?: string;
  target_release_id?: string;
  sort_order?: number;
}

export interface UpdateUserStoryInput {
  title?: string;
  description?: string;
  acceptance_criteria?: string;
  story_points?: number;
  estimated_hours?: number;
  status?: UserStory['status'];
  priority_id?: string;
  owner_user_id?: string;
  target_release_id?: string;
  blocked_reason?: string;
  sort_order?: number;
  is_archived?: boolean;
  progress?: number;
}

export interface CreateTaskInput {
  user_story_id: string;
  title: string;
  description?: string;
  status?: Task['status'];
  assigned_to?: string;
  estimated_hours?: number;
  sort_order?: number;
  created_by?: string;
  agent_engagement_type_id?: string | null;
  agent_engagement_status_id?: string | null;
  agent_capability_id?: string | null;
  agent_readiness_notes?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: Task['status'];
  assigned_to?: string;
  estimated_hours?: number;
  actual_hours?: number;
  blocked_reason?: string;
  sort_order?: number;
  started_at?: string;
  completed_at?: string;
  agent_engagement_type_id?: string | null;
  agent_engagement_status_id?: string | null;
  agent_capability_id?: string | null;
  agent_readiness_notes?: string | null;
  agent_ready_at?: string | null;
}

export interface CreateTaskCommentInput {
  task_id: string;
  body: string;
}

export interface UpdateTaskCommentInput {
  body?: string;
}
