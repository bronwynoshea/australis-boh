import { getCurrentBohUserContext } from '../../boh/api/bohApi';
import { supabase } from '../../lib/supabase';
import type {
  SwitchboardAuditEvent,
  SwitchboardBuild,
  SwitchboardConnection,
  SwitchboardDeployment,
  SwitchboardEnvironmentScope,
  SwitchboardProject,
  SwitchboardProjectEnvironment,
  SwitchboardProvider,
  SwitchboardResource,
  SwitchboardResourceKind,
  SwitchboardSnapshot,
} from './types';

async function requireContext() {
  const context = await getCurrentBohUserContext();
  if (!context) throw new Error('No active BOH tenant context was found.');
  return context;
}

async function rows<T>(table: string, orderColumn = 'updated_at', ascending = false): Promise<T[]> {
  const context = await requireContext();
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('tenant_id', context.tenant_id)
    .order(orderColumn, { ascending });
  if (error) throw error;
  return (data ?? []) as T[];
}

export type SwitchboardPermission = 'view' | 'edit' | 'admin' | null;

export async function getSwitchboardPermission(): Promise<SwitchboardPermission> {
  const context = await requireContext();
  const { data, error } = await supabase.rpc('boh_switchboard_permission_level', {
    requested_tenant_id: context.tenant_id,
  });
  if (error) throw error;
  return data === 'view' || data === 'edit' || data === 'admin' ? data : null;
}

export async function loadSwitchboardSnapshot(): Promise<SwitchboardSnapshot> {
  const [projects, environments, connections, resources, builds, deployments, activity] = await Promise.all([
    rows<SwitchboardProject>('boh_switchboard_projects'),
    rows<SwitchboardProjectEnvironment>('boh_switchboard_project_environments'),
    rows<SwitchboardConnection>('boh_switchboard_connections'),
    rows<SwitchboardResource>('boh_switchboard_resources'),
    rows<SwitchboardBuild>('boh_switchboard_builds', 'recorded_at'),
    rows<SwitchboardDeployment>('boh_switchboard_deployments', 'recorded_at'),
    rows<SwitchboardAuditEvent>('boh_switchboard_audit_events', 'created_at'),
  ]);
  return { projects, environments, connections, resources, builds, deployments, activity };
}

export async function createSwitchboardProject(input: {
  projectKey: string;
  name: string;
  description: string;
}): Promise<string> {
  const context = await requireContext();
  const { data, error } = await supabase.rpc('boh_switchboard_create_project', {
    requested_tenant_id: context.tenant_id,
    requested_project_key: input.projectKey,
    requested_name: input.name,
    requested_description: input.description.trim() || null,
    requested_request_id: crypto.randomUUID(),
  });
  if (error) throw error;
  return String(data);
}

export async function linkSwitchboardResource(input: {
  projectId: string;
  connectionKey: string;
  provider: SwitchboardProvider;
  connectionName: string;
  externalAccountId: string;
  externalAccountName: string;
  credentialVaultItemId: string | null;
  environmentScope: SwitchboardEnvironmentScope;
  resourceKind: SwitchboardResourceKind;
  resourceName: string;
  externalResourceId: string;
  serviceUrl: string;
}): Promise<string> {
  const context = await requireContext();
  const { data, error } = await supabase.rpc('boh_switchboard_link_resource', {
    requested_tenant_id: context.tenant_id,
    requested_project_id: input.projectId,
    requested_connection_key: input.connectionKey,
    requested_provider: input.provider,
    requested_connection_name: input.connectionName,
    requested_external_account_id: input.externalAccountId.trim() || null,
    requested_external_account_name: input.externalAccountName.trim() || null,
    requested_credential_vault_item_id: input.credentialVaultItemId,
    requested_environment_scope: input.environmentScope,
    requested_resource_kind: input.resourceKind,
    requested_resource_name: input.resourceName,
    requested_external_resource_id: input.externalResourceId,
    requested_service_url: input.serviceUrl.trim() || null,
    requested_request_id: crypto.randomUUID(),
  });
  if (error) throw error;
  return String(data);
}

export async function listSwitchboardVaultItems(): Promise<Array<{ id: string; display_name: string; environment: string; item_type: string }>> {
  const context = await requireContext();
  const { data, error } = await supabase
    .from('boh_vault_items_safe')
    .select('id,display_name,environment,item_type')
    .eq('tenant_id', context.tenant_id)
    .neq('item_type', 'login')
    .order('display_name');
  if (error) return [];
  return (data ?? []) as Array<{ id: string; display_name: string; environment: string; item_type: string }>;
}
