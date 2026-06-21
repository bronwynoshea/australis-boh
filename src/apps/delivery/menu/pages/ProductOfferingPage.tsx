import React, { useEffect, useMemo, useState } from 'react';
import BohSelect from '../../../../components/boh/BohSelect';
import BohSlideOver from '../../../../components/boh/BohSlideOver';
import {
  useAppModules,
  useCreateAppModule,
  useCreateProductApp,
  useProductApps,
  useUpdateAppModule,
  useUpdateProductApp,
} from '../../../../hooks/useProductData';
import type { ProductAppModule, ProductAppSummary } from '../../../../types/product';

type Surface = 'internal' | 'external' | 'hybrid';
type OfferingStatus = 'planned' | 'active' | 'paused' | 'retired';
type CreateTab = 'module' | 'app';
type StatusFilter = 'all' | OfferingStatus;
type VisibilityFilter = 'all' | 'visible' | 'hidden';

const surfaceOrder: Surface[] = ['external', 'hybrid', 'internal'];

const surfaceOptions = [
  { value: 'external', label: 'External' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'internal', label: 'Internal' },
];

const statusOptions = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'retired', label: 'Retired' },
];

const statusFilterOptions = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All statuses' },
  { value: 'planned', label: 'Planned' },
  { value: 'paused', label: 'Paused' },
  { value: 'retired', label: 'Retired' },
];

const visibilityFilterOptions = [
  { value: 'visible', label: 'Visible' },
  { value: 'all', label: 'All visibility' },
  { value: 'hidden', label: 'Hidden' },
];

const visibilityOptions = [
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
];

const textInputClass = 'h-10 rounded-md border border-boh-border-light bg-boh-surface-light px-3 text-sm text-boh-text-light outline-none focus:border-boh-primary focus:ring-2 focus:ring-boh-primary/20 dark:border-boh-border dark:bg-boh-surface dark:text-boh-text';
const textAreaClass = 'min-h-20 rounded-md border border-boh-border-light bg-boh-surface-light px-3 py-2 text-sm text-boh-text-light outline-none focus:border-boh-primary focus:ring-2 focus:ring-boh-primary/20 dark:border-boh-border dark:bg-boh-surface dark:text-boh-text';
const compactSelectClass = 'w-32 space-y-0 [&_button]:h-8 [&_button]:rounded-md [&_button]:px-2 [&_button]:text-xs';
const formSelectClass = 'space-y-0 [&_button]:h-10 [&_button]:rounded-md [&_button]:px-3 [&_button]:text-sm';

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const getEffectiveSurface = (app: ProductAppSummary): Surface => {
  if (app.surface === 'internal' || app.surface === 'external' || app.surface === 'hybrid') {
    return app.surface;
  }

  return 'internal';
};

const surfaceLabel = (surface?: string | null) =>
  surfaceOptions.find(option => option.value === surface)?.label || 'Unclassified';

const statusLabel = (status?: string | null) =>
  statusOptions.find(option => option.value === status)?.label || 'Active';

const inferAppType = (surface: Surface) =>
  surface === 'internal' ? 'internal_tool' : 'external_app';

const ProductOfferingPage: React.FC = () => {
  const { data: apps = [], isLoading: appsLoading } = useProductApps();
  const [selectedAppId, setSelectedAppId] = useState('');
  const [activeSurface, setActiveSurface] = useState<Surface>('external');
  const [createTab, setCreateTab] = useState<CreateTab>('app');
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('visible');
  const selectedApp = apps.find(app => app.id === selectedAppId) || apps[0] || null;
  const activeAppId = selectedApp?.id || '';
  const selectedAppSurface = selectedApp ? getEffectiveSurface(selectedApp) : 'external';
  const isBohShellSelected = selectedApp?.slug === 'boh';
  const { data: modules = [], isLoading: modulesLoading } = useAppModules(activeAppId || undefined, true);
  const createApp = useCreateProductApp();
  const createModule = useCreateAppModule();
  const updateModule = useUpdateAppModule();
  const updateApp = useUpdateProductApp();

  const [appForm, setAppForm] = useState({
    name: '',
    slug: '',
    description: '',
    route: '',
    external_url: '',
    surface: 'external' as Surface,
    offering_status: 'planned' as OfferingStatus,
  });
  const [moduleForm, setModuleForm] = useState({
    label: '',
    key: '',
    description: '',
    route: '',
    group_label: '',
    surface: 'external' as Surface,
    offering_status: 'planned' as OfferingStatus,
  });
  const [message, setMessage] = useState<string | null>(null);

  const groupedApps = useMemo(() => {
    const grouped = apps.reduce<Record<Surface, ProductAppSummary[]>>((acc, app) => {
      acc[getEffectiveSurface(app)].push(app);
      return acc;
    }, { internal: [], external: [], hybrid: [] });

    surfaceOrder.forEach(surface => {
      grouped[surface].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    });

    return grouped;
  }, [apps]);

  const moduleRows = useMemo(() => {
    return [...modules]
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
      .map(module => ({
        ...module,
        effectiveSurface: module.surface || selectedAppSurface,
      }));
  }, [modules, selectedAppSurface]);

  const filteredModuleRows = useMemo(() => {
    if (isBohShellSelected) {
      return [];
    }

    return moduleRows.filter(module => {
      const statusMatches = statusFilter === 'all' || (module.offering_status || 'active') === statusFilter;
      const visibilityMatches =
        visibilityFilter === 'all' ||
        (visibilityFilter === 'visible' ? module.is_active : !module.is_active);

      return statusMatches && visibilityMatches;
    });
  }, [isBohShellSelected, moduleRows, statusFilter, visibilityFilter]);

  useEffect(() => {
    if (!selectedAppId && groupedApps.external[0]) {
      setSelectedAppId(groupedApps.external[0].id);
      setActiveSurface('external');
    }
  }, [groupedApps, selectedAppId]);

  const handleSelectSurface = (surface: Surface) => {
    setActiveSurface(surface);
    setMessage(null);
    const nextApp = groupedApps[surface][0];
    if (nextApp) {
      setSelectedAppId(nextApp.id);
      setModuleForm(prev => ({
        ...prev,
        surface,
      }));
    }
  };

  const handleSelectApp = (appId: string) => {
    setSelectedAppId(appId);
    setMessage(null);
    const app = apps.find(item => item.id === appId);
    if (app) {
      const nextSurface = getEffectiveSurface(app);
      setActiveSurface(nextSurface);
      setModuleForm(prev => ({
        ...prev,
        surface: nextSurface,
      }));
    }
  };

  const saveModuleField = async (module: ProductAppModule, field: 'surface' | 'offering_status' | 'is_active', value: string | boolean) => {
    setMessage(null);
    await updateModule.mutateAsync({
      id: module.id,
      input: { [field]: value },
    });
    setMessage(`${module.label} updated.`);
  };

  const saveModuleVisibility = (module: ProductAppModule, value: string) => {
    return saveModuleField(module, 'is_active', value === 'visible');
  };

  const saveSelectedAppField = async (field: 'offering_status' | 'is_active', value: string | boolean) => {
    if (!selectedApp) return;
    setMessage(null);
    await updateApp.mutateAsync({
      id: selectedApp.id,
      input: { [field]: value },
    });
    setMessage(`${selectedApp.name} updated.`);
  };

  const saveSelectedAppVisibility = (value: string) => {
    return saveSelectedAppField('is_active', value === 'visible');
  };

  const handleCreateApp = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = appForm.name.trim();
    const slug = normalizeKey(appForm.slug || appForm.name);
    if (!name || !slug) return;

    setMessage(null);
    const created = await createApp.mutateAsync({
      name,
      slug,
      description: appForm.description.trim() || null,
      route: appForm.route.trim() || null,
      external_url: appForm.external_url.trim() || null,
      surface: appForm.surface,
      location: appForm.surface === 'internal' ? 'Internal' : 'External',
      type: inferAppType(appForm.surface),
      offering_status: appForm.offering_status,
      is_active: true,
    });
    setSelectedAppId(created.id);
    setActiveSurface(appForm.surface);
    setIsCreatePanelOpen(false);
    setAppForm({
      name: '',
      slug: '',
      description: '',
      route: '',
      external_url: '',
      surface: 'external',
      offering_status: 'planned',
    });
    setMessage(`${created.name} added to the Menu product offering.`);
  };

  const handleCreateModule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeAppId) return;
    const label = moduleForm.label.trim();
    const key = normalizeKey(moduleForm.key || moduleForm.label);
    if (!label || !key) return;

    setMessage(null);
    const created = await createModule.mutateAsync({
      app_id: activeAppId,
      label,
      key,
      description: moduleForm.description.trim() || null,
      route: moduleForm.route.trim() || null,
      group_label: moduleForm.group_label.trim() || null,
      surface: moduleForm.surface,
      offering_status: moduleForm.offering_status,
      is_active: true,
      is_primary: modules.length === 0,
      sort_order: modules.length > 0 ? Math.max(...modules.map(module => module.sort_order || 0)) + 10 : 10,
    });
    setModuleForm({
      label: '',
      key: '',
      description: '',
      route: '',
      group_label: '',
      surface: selectedApp ? getEffectiveSurface(selectedApp) : 'external',
      offering_status: 'planned',
    });
    setIsCreatePanelOpen(false);
    setMessage(`${created.label} added under ${selectedApp?.name || 'the selected app'}.`);
  };

  return (
    <div className="min-h-0 space-y-3 xl:flex xl:max-h-[calc(100vh-185px)] xl:flex-col xl:overflow-hidden">
      {message && (
        <div className="rounded-md border border-boh-primary/30 bg-boh-primary/10 px-3 py-2 text-sm text-boh-primary">
          {message}
        </div>
      )}

      <div className="flex flex-shrink-0 justify-end">
        <button
          type="button"
          onClick={() => setIsCreatePanelOpen(true)}
          className="h-10 rounded-md bg-boh-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-boh-primary/90"
        >
          Create new App/Module
        </button>
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-3 xl:grid-cols-[240px_minmax(0,1fr)] xl:flex-1 xl:overflow-hidden">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-boh-border-light bg-boh-surface-light dark:border-boh-border dark:bg-boh-surface">
          <div className="border-b border-boh-border-light px-3 py-2 dark:border-boh-border">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Apps</h3>
              <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{apps.length} total</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {surfaceOrder.map(surface => (
                <button
                  key={surface}
                  type="button"
                  onClick={() => handleSelectSurface(surface)}
                  className={`min-w-0 border-b-2 px-0 pb-2 text-center text-xs font-semibold transition-colors ${
                    activeSurface === surface
                      ? 'border-boh-primary text-boh-primary'
                      : 'border-transparent text-boh-text-sub-light hover:border-boh-primary/40 hover:text-boh-primary dark:text-boh-text-sub'
                  }`}
                >
                  <span className="block truncate">{surfaceLabel(surface)}</span>
                  <span className="block text-[10px] text-boh-text-sub-light dark:text-boh-text-sub">
                    {groupedApps[surface].length}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto boh-hide-scrollbar p-2">
            {appsLoading ? (
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Loading apps...</p>
            ) : groupedApps[activeSurface].length === 0 ? (
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">No {surfaceLabel(activeSurface).toLowerCase()} apps yet.</p>
            ) : (
              <div className="space-y-1">
                {groupedApps[activeSurface].map(app => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => handleSelectApp(app.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      activeAppId === app.id
                        ? 'text-boh-primary'
                        : 'text-boh-text-light hover:text-boh-primary dark:text-boh-text'
                    }`}
                  >
                    <span className="truncate font-medium">{app.name}</span>
                    <span className="text-[11px] text-boh-text-sub-light dark:text-boh-text-sub">
                      {statusLabel(app.offering_status)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-boh-border-light bg-boh-surface-light dark:border-boh-border dark:bg-boh-surface">
          <div className="flex flex-col gap-2 border-b border-boh-border-light px-3 py-2 dark:border-boh-border xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">
                {selectedApp ? (isBohShellSelected ? 'BOH shell record' : `Modules in ${selectedApp.name}`) : 'Select an app'}
              </h3>
              <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                {selectedApp
                  ? isBohShellSelected
                    ? 'BOH is the internal shell record. It does not have product modules on this screen.'
                    : `${filteredModuleRows.length} of ${moduleRows.length} registered ${moduleRows.length === 1 ? 'module' : 'modules'} / ${selectedApp.slug}`
                  : 'No app selected'}
              </p>
            </div>
            {selectedApp && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">
                  Filters
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <BohSelect
                    value={statusFilter}
                    onChange={(value) => setStatusFilter(value as StatusFilter)}
                    options={statusFilterOptions}
                    className="w-36 space-y-0 [&_button]:h-9 [&_button]:rounded-md [&_button]:px-2 [&_button]:text-xs"
                  />
                  <BohSelect
                    value={visibilityFilter}
                    onChange={(value) => setVisibilityFilter(value as VisibilityFilter)}
                    options={visibilityFilterOptions}
                    className="w-36 space-y-0 [&_button]:h-9 [&_button]:rounded-md [&_button]:px-2 [&_button]:text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto boh-hide-scrollbar">
            {selectedApp && !isBohShellSelected && (
              <div className="flex flex-wrap items-center gap-2 border-b border-boh-border-light px-3 py-1.5 dark:border-boh-border">
                <span className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">
                  Whole app
                </span>
                <BohSelect
                  value={selectedApp.offering_status || 'active'}
                  onChange={(value) => saveSelectedAppField('offering_status', value)}
                  options={statusOptions}
                  className={compactSelectClass}
                />
                <BohSelect
                  value={selectedApp.is_active ? 'visible' : 'hidden'}
                  onChange={(value) => saveSelectedAppVisibility(value)}
                  options={visibilityOptions}
                  className={compactSelectClass}
                />
              </div>
            )}
            {modulesLoading ? (
              <p className="p-4 text-sm text-boh-text-sub-light dark:text-boh-text-sub">Loading modules...</p>
            ) : isBohShellSelected ? (
              <div className="p-4">
                <div className="rounded-md border border-boh-border-light bg-boh-bg-light p-4 text-sm text-boh-text-sub-light dark:border-boh-border dark:bg-boh-bg dark:text-boh-text-sub">
                  BOH is managed as the internal shell only. Use the External, Hybrid, and Internal tabs above the app list to switch offering groups, then select an app to manage that app's modules, status, and visibility.
                </div>
              </div>
            ) : moduleRows.length === 0 ? (
              <p className="p-4 text-sm text-boh-text-sub-light dark:text-boh-text-sub">No modules are registered for this app yet.</p>
            ) : filteredModuleRows.length === 0 ? (
              <p className="p-4 text-sm text-boh-text-sub-light dark:text-boh-text-sub">No rows match the current filters.</p>
            ) : (
              <div className="divide-y divide-boh-border-light dark:divide-boh-border">
                {filteredModuleRows.map(module => (
                  <div key={module.id} className="px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold leading-5 text-boh-text-light dark:text-boh-text">{module.label}</p>
                        <span className="rounded-full bg-boh-bg-light px-2 py-0.5 text-[11px] text-boh-text-sub-light dark:bg-boh-bg dark:text-boh-text-sub">
                          {module.key}
                        </span>
                        {isBohShellSelected ? (
                          <>
                            <span className="rounded-md border border-boh-border-light px-2 py-0.5 text-[11px] font-semibold text-boh-text-light dark:border-boh-border dark:text-boh-text">
                              {statusLabel(module.offering_status)}
                            </span>
                            <BohSelect
                              value={module.is_active ? 'visible' : 'hidden'}
                              onChange={(value) => saveModuleVisibility(module, value)}
                              options={visibilityOptions}
                              className={compactSelectClass}
                            />
                          </>
                        ) : (
                          <>
                            <BohSelect
                              value={module.offering_status || 'active'}
                              onChange={(value) => saveModuleField(module, 'offering_status', value)}
                              options={statusOptions}
                              className={compactSelectClass}
                            />
                            <BohSelect
                              value={module.is_active ? 'visible' : 'hidden'}
                              onChange={(value) => saveModuleVisibility(module, value)}
                              options={visibilityOptions}
                              className={compactSelectClass}
                            />
                          </>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs leading-5 text-boh-text-sub-light dark:text-boh-text-sub">{module.description || 'No description'}</p>
                      {module.route && (
                        <p className="mt-1 truncate text-[11px] text-boh-text-sub-light dark:text-boh-text-sub">{module.route}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

      </div>
      <BohSlideOver
        isOpen={isCreatePanelOpen}
        title="Create new App/Module"
        description="Register a new app or add a module to the selected app."
        onClose={() => setIsCreatePanelOpen(false)}
        closeLabel="Close create panel"
        headerAfter={(
          <div className="mt-4 flex gap-6">
            {([
              { key: 'app' as CreateTab, label: 'App' },
              { key: 'module' as CreateTab, label: 'Module' },
            ]).map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCreateTab(tab.key)}
                className={`border-b-2 pb-2 text-sm font-semibold transition-colors ${
                  createTab === tab.key
                    ? 'border-boh-primary text-boh-primary'
                    : 'border-transparent text-boh-text-sub-light hover:border-boh-primary/40 hover:text-boh-primary dark:text-boh-text-sub'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        footer={(
          createTab === 'app' ? (
            <button
              type="submit"
              form="create-product-app-form"
              disabled={!appForm.name.trim()}
              className="h-10 min-w-32 rounded-md bg-boh-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-boh-primary/90 disabled:opacity-50"
            >
              Create App
            </button>
          ) : (
            <button
              type="submit"
              form="create-product-module-form"
              disabled={!activeAppId || !moduleForm.label.trim()}
              className="h-10 min-w-36 rounded-md bg-boh-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-boh-primary/90 disabled:opacity-50"
            >
              Create Module
            </button>
          )
        )}
      >
              {createTab === 'app' ? (
                <form id="create-product-app-form" onSubmit={handleCreateApp} className="grid w-full gap-3">
                  <div className="grid gap-3">
                    <input className={textInputClass} value={appForm.name} onChange={(event) => setAppForm(prev => ({ ...prev, name: event.target.value, slug: prev.slug || normalizeKey(event.target.value) }))} placeholder="App name" />
                    <input className={textInputClass} value={appForm.slug} onChange={(event) => setAppForm(prev => ({ ...prev, slug: normalizeKey(event.target.value) }))} placeholder="app_slug" />
                    <input className={textInputClass} value={appForm.route} onChange={(event) => setAppForm(prev => ({ ...prev, route: event.target.value }))} placeholder="/app-route" />
                  </div>
                  <textarea className={`${textAreaClass} min-h-28`} value={appForm.description} onChange={(event) => setAppForm(prev => ({ ...prev, description: event.target.value }))} placeholder="Description" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2 rounded-md border border-boh-border-light p-3 dark:border-boh-border">
                      <p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">
                        Audience
                      </p>
                      <BohSelect value={appForm.surface} onChange={(value) => setAppForm(prev => ({ ...prev, surface: value as Surface }))} options={surfaceOptions} className={formSelectClass} />
                    </div>
                    <div className="grid gap-2 rounded-md border border-boh-border-light p-3 dark:border-boh-border">
                      <p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">
                        Status
                      </p>
                      <BohSelect value={appForm.offering_status} onChange={(value) => setAppForm(prev => ({ ...prev, offering_status: value as OfferingStatus }))} options={statusOptions} className={formSelectClass} />
                    </div>
                  </div>
                </form>
              ) : (
                <form id="create-product-module-form" onSubmit={handleCreateModule} className="grid w-full gap-3">
                  <div className="grid gap-3">
                    <input className={textInputClass} value={moduleForm.label} onChange={(event) => setModuleForm(prev => ({ ...prev, label: event.target.value, key: prev.key || normalizeKey(event.target.value) }))} placeholder="Module label" />
                    <input className={textInputClass} value={moduleForm.key} onChange={(event) => setModuleForm(prev => ({ ...prev, key: normalizeKey(event.target.value) }))} placeholder="module_key" />
                    <input className={textInputClass} value={moduleForm.route} onChange={(event) => setModuleForm(prev => ({ ...prev, route: event.target.value }))} placeholder="/app/module" />
                    <input className={textInputClass} value={moduleForm.group_label} onChange={(event) => setModuleForm(prev => ({ ...prev, group_label: event.target.value }))} placeholder="Group label" />
                  </div>
                  <textarea className={`${textAreaClass} min-h-28`} value={moduleForm.description} onChange={(event) => setModuleForm(prev => ({ ...prev, description: event.target.value }))} placeholder="Description" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2 rounded-md border border-boh-border-light p-3 dark:border-boh-border">
                      <p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">
                        Audience
                      </p>
                      <BohSelect value={moduleForm.surface} onChange={(value) => setModuleForm(prev => ({ ...prev, surface: value as Surface }))} options={surfaceOptions} className={formSelectClass} />
                    </div>
                    <div className="grid gap-2 rounded-md border border-boh-border-light p-3 dark:border-boh-border">
                      <p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">
                        Status
                      </p>
                      <BohSelect value={moduleForm.offering_status} onChange={(value) => setModuleForm(prev => ({ ...prev, offering_status: value as OfferingStatus }))} options={statusOptions} className={formSelectClass} />
                    </div>
                  </div>
                </form>
              )}
      </BohSlideOver>
    </div>
  );
};

export default ProductOfferingPage;
