export type FunnelStatus =
  | 'draft'
  | 'planning'
  | 'in_production'
  | 'ready_for_review'
  | 'ready_to_launch'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived';

export type OpportunityStatus = 'open' | 'won' | 'lost';
export type OpportunityStageType = 'open' | 'won' | 'lost';

export interface Funnel {
  id: string;
  tenant_id: string;
  funnel_key: string;
  name: string;
  description: string | null;
  conversion_objective: string | null;
  status: FunnelStatus;
  owner_id: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface FunnelOpportunityStage {
  id: string;
  tenant_id: string;
  funnel_id: string;
  stage_key: string;
  label: string;
  reportable_milestone: string;
  exit_criteria: string;
  default_probability: number;
  sort_order: number;
  stage_type: OpportunityStageType;
  is_optional: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatronOrganisationSummary {
  id: string;
  name: string;
}

export interface FunnelOpportunity {
  id: string;
  tenant_id: string;
  funnel_id: string;
  stage_id: string;
  primary_organisation_id: string | null;
  name: string;
  description?: string | null;
  value_amount: number;
  currency: string;
  probability_override: number | null;
  owner_id: string | null;
  expected_close_date: string | null;
  next_action: string | null;
  next_action_due_at: string | null;
  source: string | null;
  status: OpportunityStatus;
  outcome_reason: string | null;
  competitor_name: string | null;
  reentry_date: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  organisation: PatronOrganisationSummary | null;
}

export interface FunnelStageGroup {
  stage: FunnelOpportunityStage;
  opportunities: FunnelOpportunity[];
  totalValue: number;
  weightedValue: number;
}

export interface FunnelPipelineMetrics {
  openValue: number;
  weightedValue: number;
  wonValue: number;
  lostValue: number;
  openCount: number;
}

export interface FunnelOpportunityInput {
  funnel_id: string;
  stage_id: string;
  name: string;
  primary_organisation_id?: string | null;
  value_amount: number;
  currency: string;
  probability_override?: number | null;
  expected_close_date?: string | null;
  next_action?: string | null;
  next_action_due_at?: string | null;
  source?: string | null;
  outcome_reason?: string | null;
}
