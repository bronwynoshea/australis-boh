// Tablez App Type Definitions

export type TablezTaskStatus = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  sort_order: number;
  color_token: string | null;
  is_active: boolean;
};

export type TablezTaskPriority = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  weight: number;
  color_token: string | null;
  is_active: boolean;
};

export type TablezProject = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  section_id: string | null;
  table_id: string | null;
  color: string | null;
  app_context: string;
  status_id: string | null;
};

export type TablezTask = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  tags: string[] | null;
  section_id: string;
  table_id: string;
  chair_id: string | null;
  tablez_project_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  related_contact_id: string | null;
  related_org_id: string | null;
  related_ticket_id: string | null;
  source: string;
  is_archived: boolean;
  app_context: string;
  created_at: string;
  updated_at: string;
  search_vector: string | null;
  status_id: string;
  priority_id: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  is_all_day: boolean;
  timezone: string | null;
  calendar_provider: string | null;
  calendar_external_id: string | null;
  calendar_sync_status: string | null;
  calendar_last_synced_at: string | null;
  // Joined data
  status?: TablezTaskStatus;
  priority?: TablezTaskPriority;
  project?: TablezProject;
};
