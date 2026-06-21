import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../../lib/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

interface WalkthroughType {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  app_key?: string;
}

interface AppOption {
  id: string;
  slug: string;
  name: string;
  route?: string | null;
}

interface AppModuleOption {
  id: string;
  app_id: string;
  key: string;
  label: string;
  route?: string | null;
  sort_order?: number | null;
}

interface WalkthroughArtifact {
  id: string;
  artifact_type: string;
  signedUrl?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  created_at?: string | null;
}

interface WalkthroughRun {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  environment: string;
  capture_mode?: string | null;
  render_mode?: string | null;
  voiceover_mode?: string | null;
  step_plan?: StructuredStep[] | null;
  transcript_text?: string | null;
  error_message?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  assetTemplate?: {
    slug: string;
    name: string;
  };
  recipe?: {
    slug: string;
    name: string;
  };
  videoUrl?: string | null;
  artifacts?: WalkthroughArtifact[];
}

interface DropdownOption {
  value: string;
  label: string;
}

interface StructuredStep {
  id: string;
  label: string;
}

type VideoPurpose = 'quick-feature-clip' | 'release-note' | 'pitch-deck-demo' | 'training-support';
type WalkthroughTab = 'new-video' | 'recent-assets' | 'templates';
type CaptureMode = 'screenshot_scenes' | 'screen_recording';
type VoiceoverMode = 'none' | 'transcript' | 'voiceover_ready';

const demoTemplateSlug = 'talent-onboarding-desktop';
const visibleTemplateSlugs = new Set([demoTemplateSlug]);
const localDemoVideoAsset: WalkthroughRun = {
  id: 'local-talent-onboarding-desktop-remotion',
  status: 'completed',
  environment: 'dev',
  capture_mode: 'screenshot_scenes',
  render_mode: 'remotion',
  voiceover_mode: 'none',
  created_at: '2026-05-01T00:52:04.708Z',
  completed_at: '2026-05-01T00:53:58.000Z',
  assetTemplate: {
    slug: demoTemplateSlug,
    name: 'Talent Onboarding Desktop Demo',
  },
  videoUrl: '/walkthrough-demo/talent-onboarding-desktop-remotion.mp4',
  artifacts: [
    {
      id: 'local-talent-onboarding-desktop-remotion-video',
      artifact_type: 'video',
      signedUrl: '/walkthrough-demo/talent-onboarding-desktop-remotion.mp4',
      mime_type: 'video/mp4',
      file_size_bytes: 4072405,
      created_at: '2026-05-01T00:53:58.000Z',
    },
  ],
};

const videoPurposeSettings: Record<VideoPurpose, {
  label: string;
  targetDuration: string;
  maxDuration: string;
}> = {
  'quick-feature-clip': {
    label: 'Quick feature clip',
    targetDuration: '45 seconds',
    maxDuration: '90 seconds',
  },
  'release-note': {
    label: 'Release note',
    targetDuration: '90 seconds',
    maxDuration: '3 minutes',
  },
  'pitch-deck-demo': {
    label: 'Pitch deck demo',
    targetDuration: '2 minutes',
    maxDuration: '5 minutes',
  },
  'training-support': {
    label: 'Training/support',
    targetDuration: '3 minutes',
    maxDuration: '8 minutes',
  },
};

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function getWalkthroughTypeDisplayName(walkthroughType: Pick<WalkthroughType, 'slug' | 'name'>) {
  if (walkthroughType.slug === 'talent-onboarding-desktop') return 'Talent Onboarding Desktop Demo';
  if (walkthroughType.slug === 'talent-onboarding-mobile') return 'Talent Onboarding Demo';
  if (walkthroughType.slug === 'talent-walkthrough-mobile') return 'Talent Mobile Demo';
  return walkthroughType.name;
}

function getRunTitle(run: WalkthroughRun) {
  const template = run.assetTemplate || run.recipe;
  return template ? getWalkthroughTypeDisplayName(template) : 'Expo Asset';
}

function getVideoArtifact(run: WalkthroughRun) {
  return run.artifacts?.find((artifact) => (
    artifact.artifact_type === 'video' || artifact.mime_type?.startsWith('video/')
  ));
}

function formatFileSize(value?: number | null) {
  if (!value) return 'Size unavailable';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getCaptureModeLabel(value?: string | null) {
  if (value === 'screen_recording') return 'Live recording';
  return 'Screenshot scenes';
}

function getVoiceoverModeLabel(value?: string | null) {
  if (value === 'voiceover_ready') return 'Voiceover-ready transcript';
  if (value === 'transcript') return 'Transcript only';
  return 'No voiceover';
}

function slugifyStepId(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || fallback;
}

interface CustomDropdownProps {
  id: string;
  value: string;
  options: DropdownOption[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

function CustomDropdown({ id, value, options, placeholder, disabled = false, onChange }: CustomDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  return (
    <div ref={dropdownRef} className="relative mt-2">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-left text-boh-text-light dark:text-boh-text disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={selectedOption ? 'truncate' : 'truncate text-boh-text-sub-light dark:text-boh-text-sub'}>
          {selectedOption?.label || placeholder}
        </span>
        <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub" aria-hidden="true">
          v
        </span>
      </button>

      {open && !disabled && (
        <div className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface shadow-xl">
          <ul role="listbox" aria-labelledby={id} className="py-1">
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-boh-primary/10 ${
                      selected
                        ? 'bg-boh-primary/10 font-semibold text-boh-primary'
                        : 'text-boh-text-light dark:text-boh-text'
                    }`}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function WalkthroughRecorderPage() {
  const [walkthroughTypes, setWalkthroughTypes] = useState<WalkthroughType[]>([]);
  const [apps, setApps] = useState<AppOption[]>([]);
  const [modules, setModules] = useState<AppModuleOption[]>([]);
  const [runs, setRuns] = useState<WalkthroughRun[]>([localDemoVideoAsset]);
  const [selectedWalkthroughTypeSlug, setSelectedWalkthroughTypeSlug] = useState(demoTemplateSlug);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [narrative, setNarrative] = useState('Show Sally completing Talent onboarding on desktop: work email, profile details, company workspace setup, first role, and match preview.');
  const [device, setDevice] = useState<'mobile' | 'desktop'>('desktop');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('screenshot_scenes');
  const [voiceoverMode, setVoiceoverMode] = useState<VoiceoverMode>('none');
  const [videoPurpose, setVideoPurpose] = useState<VideoPurpose>('quick-feature-clip');
  const [notes, setNotes] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [structuredSteps, setStructuredSteps] = useState<StructuredStep[]>([
    { id: 'work-email', label: 'Capture the work email and company-domain check.' },
    { id: 'about-you', label: 'Capture recruiter profile details.' },
    { id: 'company-workspace', label: 'Capture company workspace setup.' },
    { id: 'first-role', label: 'Capture first-role setup.' },
    { id: 'match-preview', label: 'Capture the library match preview.' },
  ]);
  const [stepPlanApproved, setStepPlanApproved] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<WalkthroughTab>('new-video');
  const [trackedRun, setTrackedRun] = useState<WalkthroughRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingTemplateSlug, setCreatingTemplateSlug] = useState<string | null>(null);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [previewRun, setPreviewRun] = useState<WalkthroughRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const savedWalkthroughs = useMemo(() => {
    const dbTemplates = walkthroughTypes.filter((walkthroughType) => visibleTemplateSlugs.has(walkthroughType.slug));
    const templates = dbTemplates.some((walkthroughType) => walkthroughType.slug === demoTemplateSlug)
      ? dbTemplates
      : [{
        id: demoTemplateSlug,
        slug: demoTemplateSlug,
        name: 'Talent Onboarding Desktop Demo',
        description: 'Desktop Remotion asset for Sally completing Talent onboarding.',
        app_key: 'talent',
      }];

    return [...templates].sort((first, second) => (
      getWalkthroughTypeDisplayName(first).localeCompare(getWalkthroughTypeDisplayName(second))
    ));
  }, [walkthroughTypes]);

  const appOptions = useMemo<DropdownOption[]>(() => (
    apps
      .map((app) => ({
        value: app.id,
        label: app.name,
      }))
      .sort((first, second) => first.label.localeCompare(second.label))
  ), [apps]);

  const filteredModules = useMemo(() => (
    modules.filter((module) => module.app_id === selectedAppId)
  ), [modules, selectedAppId]);

  const moduleOptions = useMemo<DropdownOption[]>(() => (
    filteredModules
      .map((module) => ({
        value: module.id,
        label: module.label,
      }))
      .sort((first, second) => {
        const firstOrder = filteredModules.find((module) => module.id === first.value)?.sort_order ?? 999;
        const secondOrder = filteredModules.find((module) => module.id === second.value)?.sort_order ?? 999;
        return firstOrder - secondOrder || first.label.localeCompare(second.label);
      })
  ), [filteredModules]);

  const templateOptions = useMemo<DropdownOption[]>(() => (
    savedWalkthroughs.map((walkthroughType) => ({
      value: walkthroughType.slug,
      label: getWalkthroughTypeDisplayName(walkthroughType),
    }))
  ), [savedWalkthroughs]);

  const deviceOptions: DropdownOption[] = [
    { value: 'desktop', label: 'Desktop' },
    { value: 'mobile', label: 'Mobile' },
  ];

  const captureModeOptions: DropdownOption[] = [
    { value: 'screenshot_scenes', label: 'Screenshot scenes' },
    { value: 'screen_recording', label: 'Live recording' },
  ];

  const voiceoverModeOptions: DropdownOption[] = [
    { value: 'none', label: 'No voiceover' },
    { value: 'transcript', label: 'Transcript only' },
    { value: 'voiceover_ready', label: 'Voiceover-ready transcript' },
  ];

  const videoPurposeOptions: DropdownOption[] = Object.entries(videoPurposeSettings).map(([value, settings]) => ({
    value,
    label: settings.label,
  }));

  const selectedPurposeSettings = videoPurposeSettings[videoPurpose];

  const fetchVideoAssetOptions = async () => {
    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${supabaseUrl}/functions/v1/forge-walkthrough-run`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || 'Failed to load Expo templates');
    }

    const nextWalkthroughTypes = (data.assetTemplates || data.walkthroughTypes || []).filter((walkthroughType: WalkthroughType) => (
      visibleTemplateSlugs.has(walkthroughType.slug)
    ));
    const nextApps = data.apps || [];
    const nextModules = data.modules || [];

    setWalkthroughTypes(nextWalkthroughTypes);
    setApps(nextApps);
    setModules(nextModules);

    if (nextApps.length && !nextApps.some((app: AppOption) => app.id === selectedAppId)) {
      const talentApp = nextApps.find((app: AppOption) => app.slug === 'talent') || nextApps[0];
      setSelectedAppId(talentApp.id);

      const firstModule = nextModules.find((module: AppModuleOption) => module.app_id === talentApp.id);
      setSelectedModuleId(firstModule?.id || '');
    }

    if (!nextWalkthroughTypes.some((walkthroughType: WalkthroughType) => walkthroughType.slug === selectedWalkthroughTypeSlug)) {
      const talentType = nextWalkthroughTypes.find((walkthroughType: WalkthroughType) => walkthroughType.slug === demoTemplateSlug)
        || nextWalkthroughTypes[0];
      setSelectedWalkthroughTypeSlug(talentType?.slug || demoTemplateSlug);
    }
  };

  const fetchRuns = async () => {
    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${supabaseUrl}/functions/v1/forge-walkthrough-status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || 'Failed to load Expo assets');
    }

    const nextRuns = [localDemoVideoAsset, ...(data.runs || []).filter((run: WalkthroughRun) => {
      const templateSlug = run.assetTemplate?.slug || run.recipe?.slug;
      return templateSlug === demoTemplateSlug;
    })];
    setRuns(nextRuns);
    setTrackedRun((currentRun) => {
      if (!currentRun?.id) return currentRun;
      return nextRuns.find((run: WalkthroughRun) => run.id === currentRun.id) || currentRun;
    });
    return nextRuns;
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchVideoAssetOptions(), fetchRuns()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Expo assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const createRun = async (walkthroughSlug = selectedWalkthroughTypeSlug, requireApprovedSteps = true) => {
    setCreating(true);
    setCreatingTemplateSlug(requireApprovedSteps ? null : walkthroughSlug);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      if (!walkthroughSlug) throw new Error('No active Expo template is available.');
      if (requireApprovedSteps && !stepPlanApproved) {
        throw new Error('Approve the screenshot scene plan before generating an Expo asset.');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/forge-walkthrough-run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetTemplateSlug: walkthroughSlug,
          recipeSlug: walkthroughSlug,
          approvedStepPlan: true,
          captureMode,
          renderMode: captureMode === 'screenshot_scenes' ? 'remotion' : 'raw_recording',
          voiceoverMode,
          stepPlan: structuredSteps,
          transcriptText: voiceoverMode === 'none' ? null : transcriptText,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
      throw new Error(data?.error || 'Failed to create Expo asset run');
      }

      if (data.run) {
        setTrackedRun(data.run);
      }
      await fetchRuns();
      setActiveTab('recent-assets');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Expo asset run');
    } finally {
      setCreating(false);
      setCreatingTemplateSlug(null);
    }
  };

  const handleAppChange = (appId: string) => {
    setSelectedAppId(appId);
    const firstModule = modules.find((module) => module.app_id === appId);
    setSelectedModuleId(firstModule?.id || '');
  };

  const generateScenePlan = () => {
    const selectedModule = modules.find((module) => module.id === selectedModuleId);
    const selectedApp = apps.find((app) => app.id === selectedAppId);
    const onboardingLabels = ['Work email', 'About you', 'Company workspace', 'First role', 'Library match preview', 'Review setup'];
    const defaultTalentLabels = selectedWalkthroughTypeSlug === 'talent-onboarding-mobile'
      ? onboardingLabels
      : ['Dashboard', 'Roles', 'Role overview', 'Contribution Matrix', 'Beacon', 'Shortlist', 'Applications'];
    const moduleLabels = selectedModule
      ? [selectedModule.label]
      : filteredModules
        .map((module) => module.label);
    const fallbackLabels = selectedApp?.slug === 'talent'
      ? defaultTalentLabels
      : ['Overview'];

    const sceneSourceLabels = selectedWalkthroughTypeSlug === 'talent-onboarding-mobile'
      ? onboardingLabels
      : (moduleLabels.length ? moduleLabels : fallbackLabels);

    const nextLabels = sceneSourceLabels
      .slice(0, 8)
      .map((label, index) => {
        const prefix = captureMode === 'screenshot_scenes' ? 'Capture' : 'Show';
        return {
          id: slugifyStepId(label, `scene-${index + 1}`),
          label: `${prefix} ${label} for ${device} and connect it to the Expo narrative.`,
        };
      });

    if (narrative.trim()) {
      nextLabels.unshift({
        id: 'opening-context',
        label: `Open with the user outcome: ${narrative.trim().slice(0, 180)}`,
      });
    }

    setStructuredSteps(nextLabels);
    if (voiceoverMode !== 'none') {
      setTranscriptText(nextLabels.map((step, index) => (
        `Scene ${index + 1}: ${step.label.replace(/^Capture /, '').replace(/^Show /, '')}`
      )).join('\n'));
    }
    setStepPlanApproved(false);
  };

  const updateStructuredStep = (stepId: string, label: string) => {
    setStructuredSteps((currentSteps) => (
      currentSteps.map((step) => (step.id === stepId ? { ...step, label } : step))
    ));
    setStepPlanApproved(false);
  };

  const refreshStatus = async () => {
    setRefreshingStatus(true);
    setError(null);
    try {
      await fetchRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh Expo asset status');
    } finally {
      setRefreshingStatus(false);
    }
  };

  const copyVideoLink = async (run: WalkthroughRun) => {
    if (!run.videoUrl) return;

    try {
      await navigator.clipboard.writeText(run.videoUrl);
    } catch (err) {
      setError('Unable to copy the video link from this browser.');
    }
  };

  const tabs: Array<{ key: WalkthroughTab; label: string }> = [
    { key: 'new-video', label: 'New Asset' },
    { key: 'recent-assets', label: 'Recent Expo Assets' },
    { key: 'templates', label: 'Templates' },
  ];

  return (
    <div className="space-y-5">
      <div className="border-b border-boh-border-light dark:border-boh-border pb-4">
        <div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">
              Forge
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-boh-text-light dark:text-boh-text">
              Expo
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              Prepare dev/staging demo assets, screenshots, and videos.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-1 sm:inline-flex sm:flex-row">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === tab.key
                    ? 'bg-boh-primary text-white'
                    : 'text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'new-video' && (
      <section className="space-y-4">
        <div className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-boh-primary/10 text-sm font-semibold text-boh-primary">
              1
            </span>
            <h3 className="font-semibold text-boh-text-light dark:text-boh-text">
              Choose target
            </h3>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-5">
            <label className="block">
              <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                App
              </span>
              <CustomDropdown
                id="walkthrough-app"
                value={selectedAppId}
                options={appOptions}
                placeholder="No active apps available"
                disabled={appOptions.length === 0}
                onChange={handleAppChange}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                Template
              </span>
              <CustomDropdown
                id="walkthrough-template"
                value={selectedWalkthroughTypeSlug}
                options={templateOptions}
                placeholder="No active templates available"
                disabled={templateOptions.length === 0}
                onChange={(nextTemplate) => {
                  setSelectedWalkthroughTypeSlug(nextTemplate);
                  setStepPlanApproved(false);
                }}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                Module / area
              </span>
              <CustomDropdown
                id="walkthrough-module"
                value={selectedModuleId}
                options={moduleOptions}
                placeholder={selectedAppId ? 'No modules configured for this app' : 'Select an app first'}
                disabled={!selectedAppId || moduleOptions.length === 0}
                onChange={setSelectedModuleId}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                Device
              </span>
              <CustomDropdown
                id="walkthrough-device"
                value={device}
                options={deviceOptions}
                placeholder="Select device"
                onChange={(nextDevice) => setDevice(nextDevice as 'mobile' | 'desktop')}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                Capture method
              </span>
              <CustomDropdown
                id="walkthrough-capture-method"
                value={captureMode}
                options={captureModeOptions}
                placeholder="Select capture method"
                onChange={(nextMode) => {
                  setCaptureMode(nextMode as CaptureMode);
                  setStepPlanApproved(false);
                }}
              />
            </label>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-boh-primary/10 text-sm font-semibold text-boh-primary">
                2
              </span>
                <h3 className="font-semibold text-boh-text-light dark:text-boh-text">
                  Describe asset
              </h3>
            </div>

            <label className="mt-3 block">
              <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                Video purpose
              </span>
              <CustomDropdown
                id="walkthrough-purpose"
                value={videoPurpose}
                options={videoPurposeOptions}
                placeholder="Select purpose"
                onChange={(nextPurpose) => setVideoPurpose(nextPurpose as VideoPurpose)}
              />
            </label>

            <div className="mt-3 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg p-3">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">
                    Target duration
                  </span>
                  <span className="font-semibold text-boh-text-light dark:text-boh-text">
                    {selectedPurposeSettings.targetDuration}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">
                    Max guidance
                  </span>
                  <span className="font-semibold text-boh-text-light dark:text-boh-text">
                    {selectedPurposeSettings.maxDuration}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                Guidance only for now. Longer videos are not blocked.
              </p>
            </div>

            <label className="mt-3 block">
              <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                Narrative
              </span>
              <textarea
                value={narrative}
                onChange={(event) => {
                  setNarrative(event.target.value);
                  setStepPlanApproved(false);
                }}
                rows={4}
                className="mt-2 w-full rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg px-3 py-2 text-sm text-boh-text-light dark:text-boh-text"
              />
            </label>

            <label className="mt-3 block">
              <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                Audio option
              </span>
              <CustomDropdown
                id="walkthrough-audio-option"
                value={voiceoverMode}
                options={voiceoverModeOptions}
                placeholder="Select audio option"
                onChange={(nextMode) => setVoiceoverMode(nextMode as VoiceoverMode)}
              />
            </label>

            {voiceoverMode !== 'none' && (
              <label className="mt-3 block">
                <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                  Transcript
                </span>
                <textarea
                  value={transcriptText}
                  onChange={(event) => setTranscriptText(event.target.value)}
                  rows={4}
                  placeholder="Generate scenes first, then edit the transcript for captions or voiceover."
                  className="mt-2 w-full rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg px-3 py-2 text-sm text-boh-text-light dark:text-boh-text"
                />
              </label>
            )}

            <button
              type="button"
              onClick={() => setNotesExpanded((current) => !current)}
              className="mt-3 rounded-lg border border-boh-border-light dark:border-boh-border px-3 py-2 text-sm font-semibold text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg"
            >
              {notesExpanded ? 'Hide notes' : 'Add notes'}
            </button>

            {notesExpanded && (
              <label className="mt-3 block">
                <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                  Notes / intended use
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  className="mt-2 w-full rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg px-3 py-2 text-sm text-boh-text-light dark:text-boh-text"
                />
              </label>
            )}
          </div>

          <div className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-boh-primary/10 text-sm font-semibold text-boh-primary">
                    3
                  </span>
                  <h3 className="font-semibold text-boh-text-light dark:text-boh-text">
                    Review screenshot scenes
                  </h3>
                </div>
                <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                  Turn the narrative into the scene plan, then approve it.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  stepPlanApproved ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-boh-primary/10 text-boh-primary'
                }`}>
                  {stepPlanApproved ? 'Approved scenes' : 'Needs approval'}
                </span>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {structuredSteps.map((step, index) => (
                <label key={step.id} className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
                  <span className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub">
                    {index + 1}
                  </span>
                  <input
                    value={step.label}
                    onChange={(event) => updateStructuredStep(step.id, event.target.value)}
                    className="w-full rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg px-3 py-2 text-sm text-boh-text-light dark:text-boh-text"
                  />
                </label>
              ))}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  generateScenePlan();
                }}
                className="rounded-lg border border-boh-border-light dark:border-boh-border px-4 py-2 text-sm font-semibold text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg"
              >
                Generate scenes
              </button>
              <button
                type="button"
                onClick={() => setStepPlanApproved(true)}
                className="rounded-lg border border-boh-border-light dark:border-boh-border px-4 py-2 text-sm font-semibold text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg"
              >
                Approve scenes
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-boh-primary/10 text-sm font-semibold text-boh-primary">
                4
              </span>
              <div>
                <h3 className="font-semibold text-boh-text-light dark:text-boh-text">
                  Generate Expo asset
                </h3>
                <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                  {captureMode === 'screenshot_scenes'
                    ? 'Captures stable screenshots first, then prepares the asset for Remotion rendering.'
                    : 'Uses the legacy live recording path.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => createRun()}
              disabled={creating || !selectedWalkthroughTypeSlug || !stepPlanApproved}
              className="w-full rounded-lg bg-boh-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-boh-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {creating && !creatingTemplateSlug ? 'Creating Expo asset...' : 'Generate Expo Asset'}
            </button>
          </div>
        </div>
      </section>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {activeTab === 'recent-assets' && (
      <section className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
        <div className="flex flex-col gap-3 border-b border-boh-border-light dark:border-boh-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-boh-text-light dark:text-boh-text">
              Recent Expo Assets
            </h3>
            <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              Check queued, running, completed, and failed Expo assets.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshStatus}
            disabled={refreshingStatus}
            className="w-full rounded-lg border border-boh-border-light dark:border-boh-border px-4 py-2 text-sm font-semibold text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {refreshingStatus ? 'Refreshing...' : 'Refresh Status'}
          </button>
        </div>

        <div className="space-y-4 p-5">
          {trackedRun && (
            <div className="rounded-lg border border-boh-primary/30 bg-boh-primary/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="font-semibold text-boh-text-light dark:text-boh-text">
                    Expo asset queued
                  </h4>
                  <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                    Run status: <span className="font-semibold text-boh-primary">{trackedRun.status}</span>
                  </p>
                  <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                    {getCaptureModeLabel(trackedRun.capture_mode)} - {getVoiceoverModeLabel(trackedRun.voiceover_mode)}
                  </p>
                  {trackedRun.status === 'queued' && (
                    <p className="mt-2 text-sm text-boh-text-light dark:text-boh-text">
                      Queued. Start the Expo worker to process this asset.
                    </p>
                  )}
                  {trackedRun.error_message && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                      {trackedRun.error_message}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={refreshStatus}
                  disabled={refreshingStatus}
                  className="w-full rounded-lg bg-boh-primary px-4 py-2 text-sm font-semibold text-white hover:bg-boh-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {refreshingStatus ? 'Refreshing...' : 'Refresh Status'}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="rounded-lg border border-boh-border-light dark:border-boh-border p-5 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              Loading Expo assets...
            </div>
          ) : runs.length === 0 ? (
            <div className="rounded-lg border border-boh-border-light dark:border-boh-border p-5 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              No Expo assets yet.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {runs.map((run) => {
                const videoArtifact = getVideoArtifact(run);
                const canPreview = Boolean(run.videoUrl);

                return (
                  <article
                    key={run.id}
                    className="overflow-hidden rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg"
                  >
                    <button
                      type="button"
                      onClick={() => canPreview && setPreviewRun(run)}
                      disabled={!canPreview}
                      className="flex h-36 w-full items-center justify-center overflow-hidden bg-boh-primary/10 text-sm font-semibold text-boh-primary disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {canPreview ? (
                        <video
                          muted
                          preload="metadata"
                          src={run.videoUrl || undefined}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{run.status === 'completed' ? 'Video unavailable' : 'Video pending'}</span>
                      )}
                    </button>

                    <div className="space-y-3 p-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-boh-text-light dark:text-boh-text">
                            {getRunTitle(run)}
                          </h4>
                          <span className="rounded-full bg-boh-primary/10 px-2 py-0.5 text-xs font-medium text-boh-primary">
                            {run.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                          Created {formatDate(run.created_at)}
                        </p>
                        <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                          Duration unavailable - {formatFileSize(videoArtifact?.file_size_bytes)}
                        </p>
                        <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                          {getCaptureModeLabel(run.capture_mode)} - {getVoiceoverModeLabel(run.voiceover_mode)}
                        </p>
                        {run.error_message && (
                          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                            {run.error_message}
                          </p>
                        )}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => setPreviewRun(run)}
                          disabled={!canPreview}
                          className="rounded-lg bg-boh-primary px-3 py-2 text-sm font-semibold text-white hover:bg-boh-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Preview
                        </button>
                        <a
                          href={run.videoUrl || undefined}
                          target="_blank"
                          rel="noreferrer"
                          aria-disabled={!run.videoUrl}
                          className={`rounded-lg border border-boh-border-light dark:border-boh-border px-3 py-2 text-center text-sm font-semibold ${
                            run.videoUrl
                              ? 'text-boh-text-light dark:text-boh-text hover:bg-boh-surface-light dark:hover:bg-boh-surface'
                              : 'pointer-events-none text-boh-text-sub-light opacity-50 dark:text-boh-text-sub'
                          }`}
                        >
                          Open
                        </a>
                        <button
                          type="button"
                          onClick={() => copyVideoLink(run)}
                          disabled={!run.videoUrl}
                          className="rounded-lg border border-boh-border-light dark:border-boh-border px-3 py-2 text-sm font-semibold text-boh-text-light dark:text-boh-text hover:bg-boh-surface-light dark:hover:bg-boh-surface disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Copy link
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
      )}

      {previewRun?.videoUrl && (
        <div className="boh-modal-layer fixed inset-0 flex items-center justify-center bg-black/70 p-2 sm:p-4">
          <div className="flex max-h-[90vh] w-full max-w-[90vw] flex-col overflow-hidden rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-boh-border-light dark:border-boh-border px-4 py-3">
              <div>
                <h3 className="font-semibold text-boh-text-light dark:text-boh-text">
                  {getRunTitle(previewRun)}
                </h3>
                <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                  {previewRun.status} - Created {formatDate(previewRun.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewRun(null)}
                className="rounded-lg border border-boh-border-light dark:border-boh-border px-3 py-2 text-sm font-semibold text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg"
              >
                Close
              </button>
            </div>
            <div className="flex h-[calc(90vh-4.75rem)] max-h-[80vh] min-h-0 items-center justify-center bg-black">
              <video
                controls
                autoPlay={false}
                src={previewRun.videoUrl}
                className="h-full w-full max-h-[80vh] max-w-[90vw] object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <section className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
          <div className="border-b border-boh-border-light dark:border-boh-border px-5 py-4">
            <h3 className="font-semibold text-boh-text-light dark:text-boh-text">
              Templates
            </h3>
            <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              Use an approved saved Expo template.
            </p>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg p-4 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                Loading saved templates...
              </div>
            ) : savedWalkthroughs.length === 0 ? (
              <div className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg p-4 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                No active saved templates are available.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {savedWalkthroughs.map((walkthroughType) => (
                  <div
                    key={walkthroughType.id}
                    className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg p-4"
                  >
                    <h3 className="font-semibold text-boh-text-light dark:text-boh-text">
                      {getWalkthroughTypeDisplayName(walkthroughType)}
                    </h3>
                    {walkthroughType.description && (
                      <p className="mt-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                        {walkthroughType.description}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => createRun(walkthroughType.slug, false)}
                      disabled={creating}
                      className="mt-4 w-full rounded-lg bg-boh-primary px-4 py-2 text-sm font-semibold text-white hover:bg-boh-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creatingTemplateSlug === walkthroughType.slug ? 'Generating...' : 'Use Expo Template'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
