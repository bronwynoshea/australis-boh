import { supabase } from '../../../lib/supabase';
import { getCurrentBohUserContext } from '../../../boh/api/bohApi';
import type { TablezProject } from '../types';

async function getCurrentTablezContext(): Promise<{ tenantId: string }> {
  const context = await getCurrentBohUserContext();
  if (!context?.tenant_id) {
    throw new Error('No BOH tenant matched the current session.');
  }
  return { tenantId: context.tenant_id };
}

async function assertOwnerInTenant(ownerId: string, tenantId: string): Promise<void> {
  const { data, error } = await supabase
    .from('boh_user')
    .select('id')
    .eq('id', ownerId)
    .eq('tenant_id', tenantId)
    .eq('app_context', 'boh')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Selected project owner is not part of the current BOH tenant.');
}

export async function fetchProjectsForOwner(ownerId: string): Promise<TablezProject[]> {
  const { tenantId } = await getCurrentTablezContext();
  await assertOwnerInTenant(ownerId, tenantId);

  const { data, error } = await supabase
    .from('tablez_project')
    .select('id, name, description, section_id, table_id, color, app_context, status_id, created_at, updated_at')
    .eq('tenant_id', tenantId)
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
  const { tenantId } = await getCurrentTablezContext();
  await assertOwnerInTenant(ownerId, tenantId);

  const { data, error } = await supabase
    .from('tablez_project')
    .insert({
      tenant_id: tenantId,
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
  const { tenantId } = await getCurrentTablezContext();

  const { data, error } = await supabase
    .from('tablez_project')
    .update({
      name: updates.name,
      description: updates.description ?? null,
      color: updates.color ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .eq('app_context', 'tablez')
    .select('id, name, description, section_id, table_id, color, app_context, status_id, created_at, updated_at')
    .single();

  if (error) {
    console.error('[tablezProjectsApi] Error updating project', error);
    throw error;
  }

  return data as unknown as TablezProject;
}

export async function archiveProject(projectId: string): Promise<void> {
  const { tenantId } = await getCurrentTablezContext();

  // Temporary fallback: hard delete.
  // Prefer soft-archive via is_archived once DB migration is applied.
  const { error } = await supabase
    .from('tablez_project')
    .delete()
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .eq('app_context', 'tablez');

  if (error) {
    console.error('[tablezProjectsApi] Error archiving project', error);
    throw error;
  }
}
