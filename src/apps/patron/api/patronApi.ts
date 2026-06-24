import { supabase } from '../../../lib/supabase';
import { getCurrentBohUserContext } from '../../../boh/api/bohApi';
import type { PatronPipelineStage, PatronPerson, PatronOrganisation, PatronActivity } from '../types';

async function getCurrentPatronTenantId(): Promise<string | null> {
  const context = await getCurrentBohUserContext();
  return context?.tenant_id ?? null;
}

// Pipeline Stages
export async function fetchPatronStages(): Promise<PatronPipelineStage[]> {
  const tenantId = await getCurrentPatronTenantId();
  if (!tenantId) return [];

  const { data, error } = await supabase
    .from('patron_pipeline_stage')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching patron pipeline stages:', error);
    throw error;
  }

  return (data || []) as PatronPipelineStage[];
}

// People
export async function fetchPatronPeople(filters?: {
  search?: string;
  pipelineStageId?: string;
  assignedTo?: string;
}): Promise<PatronPerson[]> {
  const tenantId = await getCurrentPatronTenantId();
  if (!tenantId) return [];

  let query = supabase
    .from('patron_person')
    .select('*')
    .eq('tenant_id', tenantId);

  if (filters?.search) {
    const searchTerm = `%${filters.search.toLowerCase()}%`;
    query = query.or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm}`);
  }

  if (filters?.pipelineStageId) {
    query = query.eq('pipeline_stage_id', filters.pipelineStageId);
  }

  if (filters?.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching patron people:', error);
    throw error;
  }

  return (data || []) as PatronPerson[];
}

// Organisations
export async function fetchPatronOrganisations(filters?: {
  search?: string;
  pipelineStageId?: string;
}): Promise<PatronOrganisation[]> {
  const tenantId = await getCurrentPatronTenantId();
  if (!tenantId) return [];

  let query = supabase
    .from('patron_organisation')
    .select('*')
    .eq('tenant_id', tenantId);

  if (filters?.search) {
    const searchTerm = `%${filters.search.toLowerCase()}%`;
    query = query.or(`name.ilike.${searchTerm},website.ilike.${searchTerm}`);
  }

  if (filters?.pipelineStageId) {
    query = query.eq('pipeline_stage_id', filters.pipelineStageId);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching patron organisations:', error);
    throw error;
  }

  return (data || []) as PatronOrganisation[];
}

// Activities
export async function fetchPatronActivities(filters?: {
  personId?: string;
  organisationId?: string;
}): Promise<PatronActivity[]> {
  const tenantId = await getCurrentPatronTenantId();
  if (!tenantId) return [];

  let query = supabase
    .from('patron_activity')
    .select('*')
    .eq('tenant_id', tenantId);

  if (filters?.personId) {
    query = query.eq('person_id', filters.personId);
  }

  if (filters?.organisationId) {
    query = query.eq('organisation_id', filters.organisationId);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching patron activities:', error);
    throw error;
  }

  return (data || []) as PatronActivity[];
}

// Get person by ID
export async function fetchPatronPersonById(personId: string): Promise<PatronPerson | null> {
  const tenantId = await getCurrentPatronTenantId();
  if (!tenantId) return null;

  const { data, error } = await supabase
    .from('patron_person')
    .select('*')
    .eq('id', personId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    console.error('Error fetching patron person:', error);
    throw error;
  }

  return data as PatronPerson | null;
}

// Get organisation by ID
export async function fetchPatronOrganisationById(organisationId: string): Promise<PatronOrganisation | null> {
  const tenantId = await getCurrentPatronTenantId();
  if (!tenantId) return null;

  const { data, error } = await supabase
    .from('patron_organisation')
    .select('*')
    .eq('id', organisationId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    console.error('Error fetching patron organisation:', error);
    throw error;
  }

  return data as PatronOrganisation | null;
}

