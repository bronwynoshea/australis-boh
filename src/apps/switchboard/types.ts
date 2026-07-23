export type SwitchboardEnvironment = 'development' | 'production';
export type SwitchboardEnvironmentScope = SwitchboardEnvironment | 'shared';
export type SwitchboardProvider = 'github' | 'cloudflare' | 'supabase' | 'vercel' | 'other';
export type SwitchboardResourceKind = 'repository' | 'workflow' | 'pages_project' | 'supabase_project' | 'domain' | 'worker' | 'other';

export type SwitchboardProject = {
  id: string;
  tenant_id: string;
  project_key: string;
  name: string;
  description: string | null;
  status: 'active' | 'paused' | 'archived';
  created_at: string;
  updated_at: string;
};

export type SwitchboardProjectEnvironment = {
  id: string;
  tenant_id: string;
  project_id: string;
  environment: SwitchboardEnvironment;
  status: 'active' | 'paused' | 'archived';
  primary_url: string | null;
};

export type SwitchboardConnection = {
  id: string;
  tenant_id: string;
  connection_key: string;
  provider: SwitchboardProvider;
  environment_scope: SwitchboardEnvironmentScope;
  display_name: string;
  external_account_id: string | null;
  external_account_name: string | null;
  credential_vault_item_id: string | null;
  status: 'needs_setup' | 'connected' | 'attention' | 'disabled';
  last_checked_at: string | null;
  last_error_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type SwitchboardResource = {
  id: string;
  tenant_id: string;
  project_id: string;
  connection_id: string;
  environment_scope: SwitchboardEnvironmentScope;
  resource_kind: SwitchboardResourceKind;
  display_name: string;
  external_resource_name: string | null;
  external_resource_id: string;
  service_url: string | null;
  status: 'active' | 'attention' | 'disabled' | 'archived';
  created_at: string;
  updated_at: string;
};

export type SwitchboardBuild = {
  id: string;
  tenant_id: string;
  project_environment_id: string;
  source_resource_id: string;
  provider: 'github' | 'other';
  external_build_id: string;
  commit_sha: string | null;
  branch_name: string | null;
  tag_name: string | null;
  version_label: string | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  build_url: string | null;
  forge_release_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  recorded_at: string;
};

export type SwitchboardDeployment = {
  id: string;
  tenant_id: string;
  project_environment_id: string;
  target_resource_id: string;
  build_id: string | null;
  provider: 'cloudflare' | 'supabase' | 'vercel' | 'other';
  external_deployment_id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'deleted';
  deployment_url: string | null;
  is_current: boolean;
  deployed_at: string | null;
  recorded_at: string;
};

export type SwitchboardAuditEvent = {
  id: string;
  tenant_id: string;
  actor_boh_user_id: string | null;
  event_type: string;
  project_id: string | null;
  resource_id: string | null;
  request_id: string;
  summary: string;
  created_at: string;
};

export type SwitchboardSnapshot = {
  projects: SwitchboardProject[];
  environments: SwitchboardProjectEnvironment[];
  connections: SwitchboardConnection[];
  resources: SwitchboardResource[];
  builds: SwitchboardBuild[];
  deployments: SwitchboardDeployment[];
  activity: SwitchboardAuditEvent[];
};
