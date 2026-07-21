import type { SwitchboardConnection, SwitchboardProject, SwitchboardResource } from './types';

export function normalizeSwitchboardKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function switchboardProjectMatchesSearch(
  project: SwitchboardProject,
  resources: SwitchboardResource[],
  search: string,
): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  const projectResources = resources.filter((resource) => resource.project_id === project.id);
  return [project.name, project.project_key, project.description ?? '', ...projectResources.flatMap((resource) => [
    resource.display_name,
    resource.external_resource_id,
    resource.service_url ?? '',
  ])].join(' ').toLowerCase().includes(query);
}

export function resolveSwitchboardProvider(
  resource: SwitchboardResource,
  connections: SwitchboardConnection[],
): string {
  return connections.find((connection) => connection.id === resource.connection_id)?.provider ?? 'other';
}

export function formatSwitchboardStatus(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}
