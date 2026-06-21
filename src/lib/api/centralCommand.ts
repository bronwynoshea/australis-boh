import { supabase } from '../supabase';
import type { Task } from '../../types/product';

export interface CentralLookupOption {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface CentralCommandLookups {
  taskStatuses: CentralLookupOption[];
  engagementTypes: CentralLookupOption[];
  engagementStatuses: CentralLookupOption[];
  capabilities: CentralLookupOption[];
}

export interface CentralCommandTask extends Task {
  user_story?: {
    id: string;
    title: string;
    status: string;
    initiative_id: string;
    initiative?: {
      id: string;
      title: string;
      target_quarter?: string | null;
      target_year?: number | null;
      app?: {
        id: string;
        name: string;
        slug: string;
      } | null;
      module?: {
        id: string;
        label: string;
        key: string;
      } | null;
      major_release?: {
        id: string;
        version_label: string;
        status: string;
      } | null;
    } | null;
  } | null;
}

const lookupSelect = 'id, key, label, description, sort_order, is_active';

export async function fetchCentralCommandLookups(): Promise<CentralCommandLookups> {
  const [taskStatuses, engagementTypes, engagementStatuses, capabilities] = await Promise.all([
    supabase
      .from('boh_task_status')
      .select(lookupSelect)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('forge_agent_engagement_type')
      .select(lookupSelect)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('forge_agent_engagement_status')
      .select(lookupSelect)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('forge_agent_capability')
      .select(lookupSelect)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ]);

  const firstError =
    taskStatuses.error ||
    engagementTypes.error ||
    engagementStatuses.error ||
    capabilities.error;

  if (firstError) {
    throw firstError;
  }

  return {
    taskStatuses: (taskStatuses.data || []) as CentralLookupOption[],
    engagementTypes: (engagementTypes.data || []) as CentralLookupOption[],
    engagementStatuses: (engagementStatuses.data || []) as CentralLookupOption[],
    capabilities: (capabilities.data || []) as CentralLookupOption[],
  };
}

export async function fetchCentralCommandTasks(): Promise<CentralCommandTask[]> {
  const { data, error } = await supabase
    .from('boh_task')
    .select(`
      *,
      assigned_user:boh_user!boh_task_assigned_to_fkey(id, full_name, email, status),
      created_user:boh_user!boh_task_created_by_fkey(id, full_name, email, status),
      agent_engagement_type:forge_agent_engagement_type(id, key, label, description, sort_order, is_active),
      agent_engagement_status:forge_agent_engagement_status(id, key, label, description, sort_order, is_active),
      agent_capability:forge_agent_capability(id, key, label, description, sort_order, is_active),
      user_story:boh_user_story(
        id,
        title,
        status,
        initiative_id,
        initiative:boh_initiative(
          id,
          title,
          target_quarter,
          target_year,
          app:boh_app(id, name, slug),
          module:boh_app_module(id, label, key),
          major_release:boh_release_version(id, version_label, status)
        )
      )
    `)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) {
    throw error;
  }

  return (data || []) as CentralCommandTask[];
}

export async function updateCentralCommandTask(
  taskId: string,
  patch: Pick<
    Task,
    | 'agent_engagement_type_id'
    | 'agent_engagement_status_id'
    | 'agent_capability_id'
    | 'agent_readiness_notes'
    | 'assigned_to'
    | 'status'
  >
): Promise<CentralCommandTask> {
  const readyPatch = patch.agent_engagement_status_id
    ? await buildAgentReadyPatch(patch.agent_engagement_status_id)
    : {};

  const { data, error } = await supabase
    .from('boh_task')
    .update({
      ...patch,
      ...readyPatch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select(`
      *,
      assigned_user:boh_user!boh_task_assigned_to_fkey(id, full_name, email, status),
      agent_engagement_type:forge_agent_engagement_type(id, key, label, description, sort_order, is_active),
      agent_engagement_status:forge_agent_engagement_status(id, key, label, description, sort_order, is_active),
      agent_capability:forge_agent_capability(id, key, label, description, sort_order, is_active)
    `)
    .single();

  if (error) {
    throw error;
  }

  return data as CentralCommandTask;
}

async function buildAgentReadyPatch(statusId: string) {
  const { data, error } = await supabase
    .from('forge_agent_engagement_status')
    .select('key')
    .eq('id', statusId)
    .maybeSingle();

  if (error || data?.key !== 'ready_for_agent') {
    return {};
  }

  return { agent_ready_at: new Date().toISOString() };
}
