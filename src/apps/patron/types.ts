export interface PatronPipelineStage {
  id: string;
  tenant_id?: string;
  key: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface PatronPerson {
  id: string;
  tenant_id?: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  assigned_to: string | null;
  created_by: string | null;
  pipeline_stage_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PatronOrganisation {
  id: string;
  tenant_id?: string;
  name: string;
  website: string | null;
  industry: string | null;
  size: string | null;
  status: string | null;
  pipeline_stage_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type PatronActivityType =
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'
  | 'task'
  | 'other';

export interface PatronActivity {
  id: string;
  tenant_id?: string;
  person_id: string | null;
  organisation_id: string | null;
  type: PatronActivityType;
  body: string | null;
  created_by: string | null;
  created_at: string | null;
}

