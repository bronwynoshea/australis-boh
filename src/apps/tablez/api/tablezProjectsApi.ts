import { supabase } from '../../../lib/supabase';
import type { TablezProject } from '../types';

export async function fetchProjectsForOwner(ownerId: string): Promise<TablezProject[]> {
  const { data, error } = await supabase
    .from('tablez_project')
    .select('id, name, description, section_id, table_id, color, app_context, status_id, created_at, updated_at')
    .eq('app_context', 'tablez')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[tablezProjectsApi] Error fetching projects', error);
    throw error;
  }

  return (data || []) as unknown as TablezProject[];
}

export async function createProject(ownerId: string, input: {
  name: string;
  description?: string | null;
  color?: string | null;
}): Promise<TablezProject> {
  const { data, error } = await supabase
    .from('tablez_project')
    .insert({
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? null,
      owner_id: ownerId,
      app_context: 'tablez',
    })
    .select('id, name, description, section_id, table_id, color, app_context, status_id, created_at, updated_at')
    .single();

  if (error) {
    console.error('[tablezProjectsApi] Error creating project', error);
    throw error;
  }

  return data as unknown as TablezProject;
}

export async function updateProject(projectId: string, updates: {
  name: string;
  description?: string | null;
  color?: string | null;
}): Promise<TablezProject> {
  const { data, error } = await supabase
    .from('tablez_project')
    .update({
      name: updates.name,
      description: updates.description ?? null,
      color: updates.color ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .select('id, name, description, section_id, table_id, color, app_context, status_id, created_at, updated_at')
    .single();

  if (error) {
    console.error('[tablezProjectsApi] Error updating project', error);
    throw error;
  }

  return data as unknown as TablezProject;
}

export async function archiveProject(projectId: string): Promise<void> {
  // Temporary fallback: hard delete.
  // Prefer soft-archive via is_archived once DB migration is applied.
  const { error } = await supabase
    .from('tablez_project')
    .delete()
    .eq('id', projectId);

  if (error) {
    console.error('[tablezProjectsApi] Error archiving project', error);
    throw error;
  }
}
