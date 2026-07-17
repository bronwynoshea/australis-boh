import { getCurrentBohUserContext } from '../../../boh/api/bohApi';
import { supabase } from '../../../lib/supabase';
import type {
  Funnel,
  FunnelOpportunity,
  FunnelOpportunityInput,
  FunnelOpportunityStage,
  PatronOrganisationSummary,
} from '../types';

async function requireFunnelContext() {
  const context = await getCurrentBohUserContext();
  if (!context) throw new Error('No active BOH tenant context was found.');
  return context;
}

export async function fetchFunnels(): Promise<Funnel[]> {
  const { tenant_id } = await requireFunnelContext();
  const { data, error } = await supabase
    .from('funnel')
    .select('*')
    .eq('tenant_id', tenant_id)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Funnel[];
}

export async function fetchOpportunityStages(funnelId: string): Promise<FunnelOpportunityStage[]> {
  const { tenant_id } = await requireFunnelContext();
  const { data, error } = await supabase
    .from('funnel_opportunity_stage')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('funnel_id', funnelId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((stage) => ({
    ...stage,
    default_probability: Number(stage.default_probability),
  })) as FunnelOpportunityStage[];
}

export async function fetchOpportunities(funnelId: string): Promise<FunnelOpportunity[]> {
  const { tenant_id } = await requireFunnelContext();
  const { data, error } = await supabase
    .from('funnel_opportunity')
    .select('*, organisation:patron_organisation!funnel_opportunity_primary_organisation_id_fkey(id, name)')
    .eq('tenant_id', tenant_id)
    .eq('funnel_id', funnelId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((opportunity) => ({
    ...opportunity,
    value_amount: Number(opportunity.value_amount),
    probability_override: opportunity.probability_override == null
      ? null
      : Number(opportunity.probability_override),
  })) as unknown as FunnelOpportunity[];
}

export async function fetchFunnelOrganisations(): Promise<PatronOrganisationSummary[]> {
  const { tenant_id } = await requireFunnelContext();
  const { data, error } = await supabase
    .from('patron_organisation')
    .select('id, name')
    .eq('tenant_id', tenant_id)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PatronOrganisationSummary[];
}

export async function createOpportunity(input: FunnelOpportunityInput): Promise<FunnelOpportunity> {
  const context = await requireFunnelContext();
  const { data, error } = await supabase
    .from('funnel_opportunity')
    .insert({
      ...input,
      tenant_id: context.tenant_id,
      owner_id: context.id,
      created_by: context.id,
      updated_by: context.id,
    })
    .select('*')
    .single();

  if (error) throw error;
  return { ...data, value_amount: Number(data.value_amount), organisation: null } as FunnelOpportunity;
}

export async function updateOpportunity(
  opportunityId: string,
  updates: Partial<Pick<
    FunnelOpportunity,
    | 'stage_id'
    | 'name'
    | 'primary_organisation_id'
    | 'value_amount'
    | 'currency'
    | 'probability_override'
    | 'expected_close_date'
    | 'next_action'
    | 'next_action_due_at'
    | 'outcome_reason'
    | 'competitor_name'
    | 'reentry_date'
  >>,
): Promise<void> {
  const context = await requireFunnelContext();
  const { error } = await supabase
    .from('funnel_opportunity')
    .update({ ...updates, updated_by: context.id })
    .eq('tenant_id', context.tenant_id)
    .eq('id', opportunityId);

  if (error) throw error;
}

export async function updateOpportunityStage(
  stageId: string,
  updates: Partial<Pick<
    FunnelOpportunityStage,
    'label' | 'reportable_milestone' | 'exit_criteria' | 'default_probability' | 'is_optional' | 'is_active'
  >>,
): Promise<void> {
  const context = await requireFunnelContext();
  const { error } = await supabase
    .from('funnel_opportunity_stage')
    .update(updates)
    .eq('tenant_id', context.tenant_id)
    .eq('id', stageId);

  if (error) throw error;
}
