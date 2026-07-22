import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Activity, Boxes, Cloud, GitBranch, Link2, Plus, Search, Server, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { BOHShell, bohApps } from '../../boh/navigation';
import BohSelect from '../../components/boh/BohSelect';
import BohSlideOver from '../../components/boh/BohSlideOver';
import {
  createSwitchboardProject,
  getSwitchboardPermission,
  linkSwitchboardResource,
  listSwitchboardVaultItems,
  loadSwitchboardSnapshot,
  updateSwitchboardResource,
} from './switchboardApi';
import {
  formatSwitchboardStatus,
  normalizeSwitchboardKey,
  resolveSwitchboardProvider,
  switchboardProjectMatchesSearch,
} from './switchboardModel';
import type {
  SwitchboardConnection,
  SwitchboardEnvironmentScope,
  SwitchboardProject,
  SwitchboardProvider,
  SwitchboardResource,
  SwitchboardResourceKind,
  SwitchboardSnapshot,
} from './types';

const surface = 'rounded-xl border border-boh-border-light bg-boh-surface-light shadow-sm dark:border-boh-border dark:bg-boh-surface';
const input = 'h-10 w-full rounded-lg border border-boh-border-light bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-boh-border dark:bg-boh-bg';
const textarea = 'min-h-24 w-full rounded-lg border border-boh-border-light bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-boh-border dark:bg-boh-bg';
const primaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-boh-border-light bg-white px-4 text-sm font-medium transition hover:bg-boh-bg-light dark:border-boh-border dark:bg-boh-bg dark:hover:bg-boh-surface';

type SwitchboardVaultItem = { id: string; display_name: string; environment: string; item_type?: string; switchboard_project_id?: string | null };


function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">{eyebrow}</p><h1 className="mt-1 text-3xl font-semibold">{title}</h1><p className="mt-1 max-w-3xl text-sm text-boh-text-sub-light dark:text-boh-text-sub">{description}</p></div>{action}</div>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className={`${surface} p-8 text-center`}><h2 className="font-semibold">{title}</h2><p className="mx-auto mt-2 max-w-xl text-sm text-boh-text-sub-light dark:text-boh-text-sub">{description}</p></div>;
}

function NewProjectDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const id = await createSwitchboardProject({ name, projectKey: normalizeSwitchboardKey(name), description });
      toast.success('Project created');
      await onCreated(id);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create project.');
    } finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="new-switchboard-project-title"><div className={`${surface} w-full max-w-lg p-6`}><div className="flex items-start justify-between gap-4"><div><h2 id="new-switchboard-project-title" className="text-lg font-semibold">New project</h2><p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">Create the project once, then link each Development and Production service using its own project ID.</p></div><button className={secondaryButton} onClick={onClose} aria-label="Close"><X size={16}/></button></div><div className="mt-5 space-y-4"><label className="block text-sm font-medium">Project name<input autoFocus className={`${input} mt-1.5`} value={name} onChange={(event)=>setName(event.target.value)} placeholder="Enter project name" /></label><label className="block text-sm font-medium">Description <span className="font-normal text-boh-text-sub-light dark:text-boh-text-sub">Optional</span><textarea className={`${textarea} mt-1.5`} value={description} onChange={(event)=>setDescription(event.target.value)} /></label></div><div className="mt-6 flex justify-end gap-2"><button className={secondaryButton} onClick={onClose}>Cancel</button><button className={primaryButton} disabled={saving||!normalizeSwitchboardKey(name)} onClick={()=>void save()}>{saving?'Creating…':'Create project'}</button></div></div></div>;
}

const providerKinds: Record<SwitchboardProvider, SwitchboardResourceKind[]> = {
  github: ['repository','workflow'],
  cloudflare: ['pages_project','worker','domain'],
  supabase: ['supabase_project'],
  vercel: ['other','domain'],
  other: ['other','domain'],
};

function LinkResourceDialog({ project, vaultItems, onClose, onLinked }: { project: SwitchboardProject; vaultItems: Array<{ id: string; display_name: string; environment: string }>; onClose: () => void; onLinked: () => Promise<void> }) {
  const [provider, setProvider] = useState<SwitchboardProvider>('github');
  const [connectionName, setConnectionName] = useState('GitHub');
  const [connectionKey, setConnectionKey] = useState('github');
  const [accountId, setAccountId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const [scope, setScope] = useState<SwitchboardEnvironmentScope>('shared');
  const [resourceKind, setResourceKind] = useState<SwitchboardResourceKind>('repository');
  const [resourceName, setResourceName] = useState('');
  const [externalId, setExternalId] = useState('');
  const [serviceUrl, setServiceUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const chooseProvider = (next: SwitchboardProvider) => {
    setProvider(next);
    setConnectionName(formatSwitchboardStatus(next));
    setConnectionKey(next);
    setResourceKind(providerKinds[next][0]);
  };
  const chooseScope = (next: SwitchboardEnvironmentScope) => {
    setScope(next);
    if (next === 'shared') setCredentialId('');
  };
  const save = async () => {
    setSaving(true);
    try {
      await linkSwitchboardResource({ projectId: project.id, connectionKey, provider, connectionName, externalAccountId: accountId, externalAccountName: accountName, credentialVaultItemId: credentialId || null, environmentScope: scope, resourceKind, resourceName, externalResourceId: externalId, serviceUrl });
      toast.success('Service linked');
      await onLinked();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to link service.');
    } finally { setSaving(false); }
  };
  const providerOptions = (Object.keys(providerKinds) as SwitchboardProvider[]).map((value)=>({ value, label: formatSwitchboardStatus(value) }));
  const scopeOptions = ([
    { value: 'shared', label: 'Shared' },
    { value: 'development', label: 'Development' },
    { value: 'production', label: 'Production' },
  ] satisfies Array<{ value: SwitchboardEnvironmentScope; label: string }>);
  const serviceTypeOptions = providerKinds[provider].map((value)=>({ value, label: formatSwitchboardStatus(value) }));
  const credentialOptions = scope === 'shared'
    ? [{ value: '', label: 'Not available for shared services', disabled: true }]
    : [{ value: '', label: 'No Vault credential' }, ...vaultItems.filter((item)=>item.environment===scope).map((item)=>({ value: item.id, label: `${item.display_name} · ${formatSwitchboardStatus(item.environment)}` }))];
  const footer = <div className="flex w-full justify-end gap-2"><button type="button" className={secondaryButton} onClick={onClose}>Cancel</button><button type="button" className={primaryButton} disabled={saving||!connectionName.trim()||!connectionKey||!resourceName.trim()||!externalId.trim()} onClick={()=>void save()}>{saving?'Linking…':'Link service'}</button></div>;
  return <BohSlideOver isOpen title="Link service" description={`Attach a provider-managed service to ${project.name}.`} onClose={onClose} closeDisabled={saving} footer={footer} widthClassName="md:max-w-xl"><div className="grid gap-4 sm:grid-cols-2"><BohSelect label="Provider" value={provider} onChange={(value)=>chooseProvider(value as SwitchboardProvider)} options={providerOptions}/><BohSelect label="Environment scope" value={scope} onChange={(value)=>chooseScope(value as SwitchboardEnvironmentScope)} options={scopeOptions}/><label className="block text-sm font-medium">Connection name<input className={`${input} mt-1.5`} value={connectionName} onChange={(event)=>setConnectionName(event.target.value)} /></label><label className="block text-sm font-medium">Connection key<input className={`${input} mt-1.5 font-mono`} value={connectionKey} onChange={(event)=>setConnectionKey(normalizeSwitchboardKey(event.target.value))} /></label><label className="block text-sm font-medium">Account or organization <span className="font-normal text-boh-text-sub-light dark:text-boh-text-sub">Optional</span><input className={`${input} mt-1.5`} value={accountName} onChange={(event)=>setAccountName(event.target.value)} placeholder="Provider account name" /></label><label className="block text-sm font-medium">Account ID <span className="font-normal text-boh-text-sub-light dark:text-boh-text-sub">Optional</span><input className={`${input} mt-1.5 font-mono`} value={accountId} onChange={(event)=>setAccountId(event.target.value)} /></label><div className="sm:col-span-2"><BohSelect label="Vault credential" value={credentialId} onChange={setCredentialId} options={credentialOptions} disabled={scope==='shared'}/></div><BohSelect label="Service type" value={resourceKind} onChange={(value)=>setResourceKind(value as SwitchboardResourceKind)} options={serviceTypeOptions}/><label className="block text-sm font-medium">Service name<input className={`${input} mt-1.5`} value={resourceName} onChange={(event)=>setResourceName(event.target.value)} placeholder="Development app service" /></label><label className="block text-sm font-medium sm:col-span-2">Provider service ID<input className={`${input} mt-1.5 font-mono`} value={externalId} onChange={(event)=>setExternalId(event.target.value)} placeholder="Repository, project, worker, or domain identifier" /></label><label className="block text-sm font-medium sm:col-span-2">Service URL <span className="font-normal text-boh-text-sub-light dark:text-boh-text-sub">Optional</span><input type="url" className={`${input} mt-1.5`} value={serviceUrl} onChange={(event)=>setServiceUrl(event.target.value)} placeholder="https://…" /></label></div></BohSlideOver>;
}

function EditResourceDialog({ resource, onClose, onSaved }: { resource: SwitchboardResource; onClose: () => void; onSaved: () => Promise<void> }) {
  const [displayName, setDisplayName] = useState(resource.display_name);
  const [externalResourceName, setExternalResourceName] = useState(resource.external_resource_name || resource.display_name);
  const [externalResourceId, setExternalResourceId] = useState(resource.external_resource_id);
  const [serviceUrl, setServiceUrl] = useState(resource.service_url ?? '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await updateSwitchboardResource({ resourceId: resource.id, displayName, externalResourceName, externalResourceId, serviceUrl });
      toast.success('Service updated');
      await onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update service.');
    } finally { setSaving(false); }
  };
  const footer = <div className="flex w-full justify-end gap-2"><button type="button" className={secondaryButton} onClick={onClose}>Cancel</button><button type="button" className={primaryButton} disabled={saving||!displayName.trim()||!externalResourceName.trim()||!externalResourceId.trim()} onClick={()=>void save()}>{saving?'Saving…':'Save changes'}</button></div>;
  return <BohSlideOver isOpen title="Edit service" description="Update the visible name, provider service, and app or service URL." onClose={onClose} closeDisabled={saving} footer={footer} widthClassName="md:max-w-lg"><div className="space-y-4"><label className="block text-sm font-medium">Service name<input autoFocus className={`${input} mt-1.5`} value={displayName} onChange={(event)=>setDisplayName(event.target.value)} /></label><label className="block text-sm font-medium">Provider service name<input className={`${input} mt-1.5`} value={externalResourceName} onChange={(event)=>setExternalResourceName(event.target.value)} /></label><label className="block text-sm font-medium">Provider service ID<input className={`${input} mt-1.5 font-mono`} value={externalResourceId} onChange={(event)=>setExternalResourceId(event.target.value)} /></label><label className="block text-sm font-medium">App or service URL <span className="font-normal text-boh-text-sub-light dark:text-boh-text-sub">Optional</span><input type="url" className={`${input} mt-1.5`} value={serviceUrl} onChange={(event)=>setServiceUrl(event.target.value)} placeholder="https://…" /></label></div></BohSlideOver>;
}

function OverviewPage({ snapshot }: { snapshot: SwitchboardSnapshot }) {
  const needsAttention = snapshot.connections.filter((connection)=>connection.status==='attention'||connection.status==='needs_setup').length;
  const currentDeployments = snapshot.deployments.filter((deployment)=>deployment.is_current).length;
  const cards = [
    { label: 'Projects', value: snapshot.projects.filter((project)=>project.status==='active').length, icon: Boxes },
    { label: 'Services', value: snapshot.resources.filter((resource)=>resource.status==='active').length, icon: Link2 },
    { label: 'Needs attention', value: needsAttention, icon: Cloud },
    { label: 'Current deployments', value: currentDeployments, icon: Server },
  ];
  return <><PageHeader eyebrow="Operations" title="Switchboard" description="Projects, connected services, builds, deployments, and operational history."/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({label,value,icon:Icon})=><section key={label} className={`${surface} p-5`}><Icon size={20} className="text-emerald-700 dark:text-emerald-300"/><p className="mt-4 text-3xl font-semibold">{value}</p><p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">{label}</p></section>)}</div><section className={`${surface} mt-6 p-5`}><h2 className="font-semibold">Recent activity</h2>{snapshot.activity.length===0?<p className="mt-3 text-sm text-boh-text-sub-light dark:text-boh-text-sub">No operational activity has been recorded.</p>:<div className="mt-3 divide-y divide-boh-border-light dark:divide-boh-border">{snapshot.activity.slice(0,8).map((event)=><div key={event.id} className="flex items-start justify-between gap-4 py-3 text-sm"><span>{event.summary}</span><time className="whitespace-nowrap text-xs text-boh-text-sub-light dark:text-boh-text-sub">{new Date(event.created_at).toLocaleDateString()}</time></div>)}</div>}</section></>;
}

function ProjectsPage({ snapshot, vaultItems, refresh, canEdit }: { snapshot: SwitchboardSnapshot; vaultItems: SwitchboardVaultItem[]; refresh: () => Promise<void>; canEdit: boolean }) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string|null>(snapshot.projects[0]?.id??null);
  const [activeTab, setActiveTab] = useState<'resources'|'vault'>('resources');
  const [showNew, setShowNew] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [editingResource, setEditingResource] = useState<SwitchboardResource|null>(null);
  useEffect(()=>{ if (!snapshot.projects.some((project)=>project.id===selectedId)) setSelectedId(snapshot.projects[0]?.id??null); },[snapshot.projects,selectedId]);
  const visible = snapshot.projects.filter((project)=>project.status!=='archived'&&switchboardProjectMatchesSearch(project,snapshot.resources,search));
  const selected = snapshot.projects.find((project)=>project.id===selectedId)??visible[0]??null;
  const resources = selected?snapshot.resources.filter((resource)=>resource.project_id===selected.id&&resource.status!=='archived'):[];
  const projectVaultItems = selected?vaultItems.filter((item)=>item.switchboard_project_id===selected.id):[];
  const tabs = [
    { key: 'resources' as const, label: 'Services', count: resources.length },
    { key: 'vault' as const, label: 'Vault', count: projectVaultItems.length },
  ];
  return <><PageHeader eyebrow="Project catalog" title="Projects" description="Manage only the service links and Vault items BOH needs for each product." action={canEdit?<button className={primaryButton} onClick={()=>setShowNew(true)}><Plus size={16}/>New project</button>:undefined}/>{snapshot.projects.length===0?<EmptyState title="No projects yet" description="Create the first canonical project before linking GitHub, Cloudflare, Supabase, or Vault items."/>:<div className="grid min-h-[520px] gap-5 lg:grid-cols-[320px_minmax(0,1fr)]"><section className={`${surface} overflow-hidden`}><div className="border-b border-boh-border-light p-4 dark:border-boh-border"><label className="relative block"><Search size={16} className="absolute left-3 top-3 text-boh-text-sub-light dark:text-boh-text-sub"/><input className={`${input} pl-9`} value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search projects"/></label></div><div className="divide-y divide-boh-border-light dark:divide-boh-border">{visible.map((project)=><button key={project.id} className={`w-full px-4 py-4 text-left transition ${selected?.id===project.id?'bg-emerald-500/10':'hover:bg-boh-bg-light dark:hover:bg-boh-bg'}`} onClick={()=>setSelectedId(project.id)}><span className="font-medium">{project.name}</span><span className="mt-1 block text-xs text-boh-text-sub-light dark:text-boh-text-sub">{project.project_key}</span><span className="mt-2 block text-xs text-boh-text-sub-light dark:text-boh-text-sub">{snapshot.resources.filter((resource)=>resource.project_id===project.id&&resource.status!=='archived').length} linked services</span></button>)}</div></section>{selected&&<section className={`${surface} min-w-0 p-5`}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">Project</p><h2 className="mt-1 text-2xl font-semibold">{selected.name}</h2>{selected.description&&<p className="mt-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">{selected.description}</p>}</div>{canEdit&&activeTab==='resources'&&<button className={secondaryButton} onClick={()=>setShowLink(true)}><Link2 size={16}/>Link service</button>}</div><div className="mt-6 flex gap-2 border-b border-boh-border-light dark:border-boh-border">{tabs.map((tab)=><button key={tab.key} className={`border-b-2 px-3 py-2 text-sm font-medium transition ${activeTab===tab.key?'border-emerald-600 text-emerald-700 dark:border-emerald-300 dark:text-emerald-300':'border-transparent text-boh-text-sub-light hover:text-boh-text-light dark:text-boh-text-sub dark:hover:text-boh-text'}`} onClick={()=>setActiveTab(tab.key)}>{tab.label} <span className="ml-1 text-xs">{tab.count}</span></button>)}</div>{activeTab==='resources'?<div className="mt-6"><h3 className="font-semibold">Linked services</h3>{resources.length===0?<p className="mt-3 text-sm text-boh-text-sub-light dark:text-boh-text-sub">No services are linked to this project.</p>:<div className="mt-3 divide-y divide-boh-border-light rounded-xl border border-boh-border-light dark:divide-boh-border dark:border-boh-border">{resources.map((resource)=><React.Fragment key={resource.id}><ResourceRow resource={resource} connections={snapshot.connections} canEdit={canEdit} onEdit={()=>setEditingResource(resource)}/></React.Fragment>)}</div>}</div>:<div className="mt-6"><h3 className="font-semibold">Vault items</h3>{projectVaultItems.length===0?<p className="mt-3 text-sm text-boh-text-sub-light dark:text-boh-text-sub">No Vault items are linked to this project yet.</p>:<div className="mt-3 divide-y divide-boh-border-light rounded-xl border border-boh-border-light dark:divide-boh-border dark:border-boh-border">{projectVaultItems.map((item)=><div key={item.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{item.display_name}</p><p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">{formatSwitchboardStatus(item.environment)} · {formatSwitchboardStatus(item.item_type||'credential')}</p></div><span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">BOH Vault</span></div>)}</div>}</div>}</section>}</div>}{canEdit&&showNew&&<NewProjectDialog onClose={()=>setShowNew(false)} onCreated={async(id)=>{await refresh();setSelectedId(id);}}/>}{canEdit&&showLink&&selected&&<LinkResourceDialog project={selected} vaultItems={vaultItems} onClose={()=>setShowLink(false)} onLinked={refresh}/>}{canEdit&&editingResource&&<EditResourceDialog resource={editingResource} onClose={()=>setEditingResource(null)} onSaved={refresh}/>}</>;
}

function ResourceRow({ resource, connections, canEdit, onEdit }: { resource: SwitchboardResource; connections: SwitchboardConnection[]; canEdit?: boolean; onEdit?: () => void }) {
  const provider=resolveSwitchboardProvider(resource,connections);
  return <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><span className="font-medium">{resource.display_name}</span><span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{formatSwitchboardStatus(resource.environment_scope)}</span></div><p className="mt-1 break-all text-xs text-boh-text-sub-light dark:text-boh-text-sub">{resource.external_resource_id}</p>{resource.service_url&&<p className="mt-1 break-all text-xs text-boh-text-sub-light dark:text-boh-text-sub">{resource.service_url}</p>}</div><div className="flex items-center gap-3 text-sm"><span>{formatSwitchboardStatus(provider)}</span>{canEdit&&<button className={secondaryButton} onClick={onEdit}>Edit</button>}</div></div>;
}


function ChooseProjectForServiceDialog({ projects, selectedId, onChange, onClose, onContinue }: { projects: SwitchboardProject[]; selectedId: string; onChange: (id: string) => void; onClose: () => void; onContinue: () => void }) {
  const projectOptions = projects.filter((project)=>project.status!=='archived').map((project)=>({ value: project.id, label: project.name }));
  const footer = <div className="flex w-full justify-end gap-2"><button type="button" className={secondaryButton} onClick={onClose}>Cancel</button><button type="button" className={primaryButton} disabled={!selectedId} onClick={onContinue}>Continue</button></div>;
  return <BohSlideOver isOpen title="Choose project" description="Choose which project this service belongs to before linking provider details." onClose={onClose} footer={footer} widthClassName="md:max-w-md"><BohSelect label="Project" value={selectedId} onChange={onChange} options={projectOptions} placeholder="Choose a project" /></BohSlideOver>;
}

function ServicesPage({ snapshot, vaultItems, refresh, canEdit }: { snapshot: SwitchboardSnapshot; vaultItems: SwitchboardVaultItem[]; refresh: () => Promise<void>; canEdit: boolean }) {
  const providers = (Object.keys(providerKinds) as SwitchboardProvider[])
    .map((provider) => {
      const connections = snapshot.connections.filter((connection)=>connection.provider===provider);
      const resources = snapshot.resources.filter((resource)=>connections.some((connection)=>connection.id===resource.connection_id));
      return { provider, connections, resources };
    })
    .filter((group)=>group.connections.length>0||group.resources.length>0);
  const [activeProvider, setActiveProvider] = useState<SwitchboardProvider | null>(providers[0]?.provider ?? null);
  const [choosingProject, setChoosingProject] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(snapshot.projects.find((project)=>project.status!=='archived')?.id ?? '');
  const [linkProject, setLinkProject] = useState<SwitchboardProject | null>(null);
  const [editingResource, setEditingResource] = useState<SwitchboardResource | null>(null);
  useEffect(()=>{ if (providers.length > 0 && !providers.some((group)=>group.provider===activeProvider)) setActiveProvider(providers[0].provider); }, [providers, activeProvider]);
  useEffect(()=>{ if (selectedProjectId && !snapshot.projects.some((project)=>project.id===selectedProjectId)) setSelectedProjectId(snapshot.projects.find((project)=>project.status!=='archived')?.id ?? ''); }, [snapshot.projects, selectedProjectId]);
  const activeGroup = providers.find((group)=>group.provider===activeProvider) ?? providers[0];
  const projectNameById = new Map(snapshot.projects.map((project)=>[project.id, project.name]));
  const connectionById = new Map(snapshot.connections.map((connection)=>[connection.id, connection]));
  const startLink = () => { setSelectedProjectId((current)=>current || snapshot.projects.find((project)=>project.status!=='archived')?.id || ''); setChoosingProject(true); };
  const continueLink = () => { const project = snapshot.projects.find((candidate)=>candidate.id===selectedProjectId) ?? null; setChoosingProject(false); setLinkProject(project); };
  const headerAction = canEdit ? <button className={primaryButton} onClick={startLink}><Plus size={16}/>Link service</button> : undefined;
  return <><PageHeader eyebrow="Provider inventory" title="Services" description="Scan and manage services by provider. Use Projects when you want to see one product's services and Vault items together." action={headerAction}/>{providers.length===0?<EmptyState title="No services linked" description="Link a service to create its provider inventory."/>:<div className="space-y-4"><div role="tablist" aria-label="Service providers" className="flex overflow-x-auto border-b border-boh-border-light dark:border-boh-border">{providers.map(({ provider, resources })=><button key={provider} type="button" role="tab" aria-selected={activeGroup.provider===provider} onClick={()=>setActiveProvider(provider)} className={`flex-none border-b-2 px-4 py-2.5 text-sm font-medium ${activeGroup.provider===provider?'border-emerald-600 text-emerald-700 dark:text-emerald-300':'border-transparent text-boh-text-sub-light hover:text-boh-text-light dark:text-boh-text-sub dark:hover:text-boh-text'}`}>{formatSwitchboardStatus(provider)} <span className="ml-1 text-xs opacity-70">{resources.length}</span></button>)}</div>{(()=>{const { provider, connections, resources }=activeGroup;const linkedCredentials=connections.filter((connection)=>connection.credential_vault_item_id).length;return <section className={`${surface} overflow-hidden`}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-boh-border-light px-4 py-3 dark:border-boh-border"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{formatSwitchboardStatus(provider)}</p><h2 className="text-base font-semibold">{resources.length} services · {connections.length} connections</h2></div><p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{linkedCredentials}/{connections.length} provider credentials linked</p></div>{resources.length===0?<p className="px-4 py-3 text-sm text-boh-text-sub-light dark:text-boh-text-sub">No project services linked for this provider.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-boh-bg-light text-xs uppercase tracking-wide text-boh-text-sub-light dark:bg-boh-bg dark:text-boh-text-sub"><tr><th className="px-4 py-2 font-medium">Project</th><th className="px-4 py-2 font-medium">Service</th><th className="px-4 py-2 font-medium">Environment</th><th className="px-4 py-2 font-medium">Provider ID</th><th className="px-4 py-2 font-medium">Credential</th><th className="px-4 py-2 font-medium">URL</th>{canEdit&&<th className="px-4 py-2 font-medium">Actions</th>}</tr></thead><tbody className="divide-y divide-boh-border-light dark:divide-boh-border">{resources.map((resource)=>{const connection=connectionById.get(resource.connection_id);return <tr key={resource.id} className="align-top"><td className="px-4 py-2 font-medium">{projectNameById.get(resource.project_id)||'Unknown project'}</td><td className="px-4 py-2"><p className="font-medium">{resource.display_name}</p><p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{formatSwitchboardStatus(resource.resource_kind)}</p></td><td className="px-4 py-2">{formatSwitchboardStatus(resource.environment_scope)}</td><td className="max-w-[14rem] break-all px-4 py-2 text-xs text-boh-text-sub-light dark:text-boh-text-sub">{resource.external_resource_id}</td><td className="px-4 py-2 text-xs text-boh-text-sub-light dark:text-boh-text-sub">{connection?.credential_vault_item_id?'Provider credential linked':'Provider credential not linked'}</td><td className="max-w-[16rem] break-all px-4 py-2 text-xs text-boh-text-sub-light dark:text-boh-text-sub">{resource.service_url||'—'}</td>{canEdit&&<td className="px-4 py-2"><button className={secondaryButton} onClick={()=>setEditingResource(resource)}>Edit</button></td>}</tr>;})}</tbody></table></div>}</section>;})()}<p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">Provider credential status belongs to the provider connection. It does not mean every linked project service is broken.</p></div>}{choosingProject&&<ChooseProjectForServiceDialog projects={snapshot.projects} selectedId={selectedProjectId} onChange={setSelectedProjectId} onClose={()=>setChoosingProject(false)} onContinue={continueLink}/>} {linkProject&&<LinkResourceDialog project={linkProject} vaultItems={vaultItems} onClose={()=>setLinkProject(null)} onLinked={refresh}/>} {editingResource&&<EditResourceDialog resource={editingResource} onClose={()=>setEditingResource(null)} onSaved={refresh}/>}</>;
}

function BuildlessDeployments({ snapshot }: { snapshot: SwitchboardSnapshot }) {
  const deployments = snapshot.deployments.filter((deployment)=>!deployment.build_id);
  if (deployments.length===0) return null;
  return <section className={`${surface} mb-4 p-5`}><h2 className="font-semibold">Deployments without a recorded build</h2><div className="mt-3 divide-y divide-boh-border-light dark:divide-boh-border">{deployments.map((deployment)=>{const environment=snapshot.environments.find((candidate)=>candidate.id===deployment.project_environment_id);const project=snapshot.projects.find((candidate)=>candidate.id===environment?.project_id);return <div key={deployment.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{project?.name||'Unknown project'} · {environment?formatSwitchboardStatus(environment.environment):'Unknown environment'}</p><p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">{deployment.external_deployment_id}</p></div><span className="font-medium">{formatSwitchboardStatus(deployment.status)}</span></div>;})}</div></section>;
}

function BuildsPage({ snapshot }: { snapshot: SwitchboardSnapshot }) {
  return <><PageHeader eyebrow="Technical history" title="Builds and deployments" description="GitHub remains the source of truth for version control. Switchboard records which build reached each environment."/><BuildlessDeployments snapshot={snapshot}/>{snapshot.builds.length===0&&snapshot.deployments.length===0?<EmptyState title="No build history recorded" description="Build and deployment records will appear after an approved provider connection begins reporting technical activity."/>:<div className="space-y-4">{snapshot.builds.map((build)=>{const projectEnvironment=snapshot.environments.find((environment)=>environment.id===build.project_environment_id);const project=snapshot.projects.find((candidate)=>candidate.id===projectEnvironment?.project_id);const deployments=snapshot.deployments.filter((deployment)=>deployment.build_id===build.id);return <section key={build.id} className={`${surface} p-5`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">{project?.name||'Unknown project'} · {projectEnvironment?formatSwitchboardStatus(projectEnvironment.environment):'Unknown environment'}</p><h2 className="mt-1 font-semibold">{build.version_label||build.tag_name||build.branch_name||build.external_build_id}</h2><p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">{build.commit_sha||'Commit not recorded'}</p></div><span className="text-sm font-medium">{formatSwitchboardStatus(build.status)}</span></div>{build.forge_release_id&&<p className="mt-3 text-sm">Forge release: <span className="text-xs">{build.forge_release_id}</span></p>}{deployments.length>0&&<div className="mt-4 divide-y divide-boh-border-light rounded-xl border border-boh-border-light dark:divide-boh-border dark:border-boh-border">{deployments.map((deployment)=><div key={deployment.id} className="flex items-center justify-between gap-3 p-3 text-sm"><span>{formatSwitchboardStatus(deployment.provider)} · {formatSwitchboardStatus(deployment.status)}</span>{deployment.deployment_url&&<a href={deployment.deployment_url} target="_blank" rel="noreferrer" className="font-medium text-emerald-700 hover:underline dark:text-emerald-300">Open deployment</a>}</div>)}</div>}</section>})}</div>}</>;
}

function ActivityPage({ snapshot }: { snapshot: SwitchboardSnapshot }) {
  return <><PageHeader eyebrow="Audit history" title="Activity" description="Review project, service, build, deployment, and future maintenance actions."/>{snapshot.activity.length===0?<EmptyState title="No activity recorded" description="Audited Switchboard actions will appear here."/>:<section className={`${surface} overflow-hidden`}><div className="divide-y divide-boh-border-light dark:divide-boh-border">{snapshot.activity.map((event)=><div key={event.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-medium">{event.summary}</p><p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">{formatSwitchboardStatus(event.event_type)}</p></div><time className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{new Date(event.created_at).toLocaleString()}</time></div>)}</div></section>}</>;
}

const emptySnapshot: SwitchboardSnapshot = { projects: [], environments: [], connections: [], resources: [], builds: [], deployments: [], activity: [] };

const SwitchboardApp: React.FC<{ isAdmin?: boolean }> = ({ isAdmin=false }) => {
  const [snapshot,setSnapshot]=useState<SwitchboardSnapshot>(emptySnapshot);
  const [vaultItems,setVaultItems]=useState<SwitchboardVaultItem[]>([]);
  const [permission,setPermission]=useState<'view'|'edit'|'admin'|null>(null);
  const [loading,setLoading]=useState(true);
  const refresh=async()=>{setLoading(true);try{const nextPermission=await getSwitchboardPermission();setPermission(nextPermission);if(!nextPermission){setSnapshot(emptySnapshot);setVaultItems([]);return;}const canEdit=nextPermission==='edit'||nextPermission==='admin';const [nextSnapshot,nextVaultItems]=await Promise.all([loadSwitchboardSnapshot(),canEdit?listSwitchboardVaultItems():Promise.resolve([])]);setSnapshot(nextSnapshot);setVaultItems(nextVaultItems);}catch(error){setPermission(null);toast.error(error instanceof Error?error.message:'Unable to load Switchboard.');}finally{setLoading(false);}};
  useEffect(()=>{void refresh();},[]);
  const canEdit=permission==='edit'||permission==='admin';
  return <BOHShell apps={bohApps} isAdmin={isAdmin}>{loading?<div className={`${surface} p-8 text-center text-sm text-boh-text-sub-light dark:text-boh-text-sub`}>Loading Switchboard…</div>:!permission?<EmptyState title="Switchboard access required" description="Ask a BOH administrator to enable Switchboard for this workspace and grant you access."/>:<Routes><Route index element={<OverviewPage snapshot={snapshot}/>}/><Route path="projects" element={<ProjectsPage snapshot={snapshot} vaultItems={vaultItems} refresh={refresh} canEdit={canEdit}/>}/><Route path="services" element={<ServicesPage snapshot={snapshot} vaultItems={vaultItems} refresh={refresh} canEdit={canEdit}/>}/><Route path="builds" element={<BuildsPage snapshot={snapshot}/>}/><Route path="activity" element={<ActivityPage snapshot={snapshot}/>}/><Route path="*" element={<Navigate to="/switchboard" replace/>}/></Routes>}</BOHShell>;
};

export default SwitchboardApp;
