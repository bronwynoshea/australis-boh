import React, { useEffect, useState } from 'react';
import { CheckCircle2, LockKeyhole, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchFunnels, fetchOpportunityStages, updateOpportunityStage } from '../api/funnelApi';
import type { Funnel, FunnelOpportunityStage } from '../types';

const fieldClass = 'w-full rounded-lg border border-boh-border-light bg-white px-3 py-2 text-sm text-boh-text-light outline-none transition focus:border-boh-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text';

const FunnelStagesPage: React.FC = () => {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState('');
  const [stages, setStages] = useState<FunnelOpportunityStage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState('');
  const [draft, setDraft] = useState<FunnelOpportunityStage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadStages = async (funnelId: string) => {
    const loaded = await fetchOpportunityStages(funnelId);
    setStages(loaded);
    setSelectedStageId((current) => loaded.some((stage) => stage.id === current) ? current : loaded[0]?.id ?? '');
  };

  useEffect(() => {
    fetchFunnels()
      .then((loaded) => {
        setFunnels(loaded);
        setSelectedFunnelId(loaded[0]?.id ?? '');
      })
      .catch((error) => {
        console.error('[Funnel] Unable to load stage manager', error);
        toast.error('Unable to load Funnel stages.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedFunnelId) return;
    setLoading(true);
    loadStages(selectedFunnelId)
      .catch((error) => {
        console.error('[Funnel] Unable to load stages', error);
        toast.error('Unable to load stages.');
      })
      .finally(() => setLoading(false));
  }, [selectedFunnelId]);

  useEffect(() => {
    setDraft(stages.find((stage) => stage.id === selectedStageId) ?? null);
  }, [selectedStageId, stages]);

  const save = async () => {
    if (!draft) return;
    if (!draft.label.trim() || !draft.reportable_milestone.trim() || !draft.exit_criteria.trim()) {
      toast.error('Stage name, milestone, and exit criteria are required.');
      return;
    }
    try {
      setSaving(true);
      await updateOpportunityStage(draft.id, {
        label: draft.label.trim(),
        reportable_milestone: draft.reportable_milestone.trim(),
        exit_criteria: draft.exit_criteria.trim(),
        default_probability: Number(draft.default_probability),
        is_optional: draft.is_optional,
      });
      await loadStages(selectedFunnelId);
      toast.success('Stage updated.');
    } catch (error) {
      console.error('[Funnel] Unable to save stage', error);
      toast.error(error instanceof Error ? error.message : 'Unable to save the stage.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && stages.length === 0) {
    return <div className="rounded-xl border border-boh-border-light bg-boh-surface-light p-8 text-sm text-boh-text-sub-light dark:border-boh-border dark:bg-boh-surface dark:text-boh-text-sub">Loading stage definitions...</div>;
  }

  return (
    <div className="space-y-5 pb-24 lg:pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-boh-text-sub-light dark:text-boh-text-sub">Pipeline governance</p>
          <h2 className="mt-1 text-2xl font-semibold text-boh-text-light dark:text-boh-text">Opportunity stages</h2>
          <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">Manage reportable milestones, exit criteria, and forecast defaults.</p>
        </div>
        <div className="flex items-center gap-2">
          {funnels.length > 1 && funnels.map((funnel) => (
            <button key={funnel.id} type="button" onClick={() => setSelectedFunnelId(funnel.id)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${selectedFunnelId === funnel.id ? 'border-boh-primary bg-boh-primary text-white' : 'border-boh-border-light dark:border-boh-border'}`}>{funnel.name}</button>
          ))}
          <button type="button" onClick={() => void loadStages(selectedFunnelId)} className="rounded-lg border border-boh-border-light p-2.5 text-boh-text-sub-light dark:border-boh-border dark:text-boh-text-sub" aria-label="Refresh stages"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="grid min-h-[650px] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-boh-border-light bg-boh-surface-light p-3 dark:border-boh-border dark:bg-boh-surface">
          <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">Stage cards</p>
          <div className="space-y-2">
            {stages.map((stage, index) => (
              <button key={stage.id} type="button" onClick={() => setSelectedStageId(stage.id)} className={`w-full rounded-lg border p-3 text-left transition ${selectedStageId === stage.id ? 'border-boh-primary bg-boh-primary/10' : 'border-boh-border-light bg-white hover:border-boh-primary/50 dark:border-boh-border dark:bg-boh-bg'}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-boh-bg-light text-xs font-semibold text-boh-text-sub-light dark:bg-boh-surface dark:text-boh-text-sub">{stage.stage_type === 'open' ? index + 1 : <LockKeyhole className="h-3.5 w-3.5" />}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-boh-text-light dark:text-boh-text">{stage.label}</p>
                      <span className="whitespace-nowrap text-xs font-semibold text-boh-primary">{stage.default_probability}%</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-boh-text-sub-light dark:text-boh-text-sub">{stage.reportable_milestone}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-xl border border-boh-border-light bg-boh-surface-light p-5 dark:border-boh-border dark:bg-boh-surface">
          {draft ? (
            <div className="mx-auto max-w-3xl space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-boh-text-light dark:text-boh-text">{draft.label}</h3>
                    <span className="whitespace-nowrap rounded-full bg-boh-primary/10 px-2.5 py-1 text-xs font-semibold text-boh-primary">{draft.stage_type === 'open' ? 'Open stage' : `Terminal ${draft.stage_type}`}</span>
                  </div>
                  <p className="mt-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">Changes affect the default Pipeline definition. Existing history remains unchanged.</p>
                </div>
                {draft.stage_type !== 'open' && <LockKeyhole className="h-5 w-5 text-boh-text-sub-light dark:text-boh-text-sub" />}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub">Stage name</span>
                  <input className={fieldClass} value={draft.label} onChange={(event) => setDraft((current) => current ? { ...current, label: event.target.value } : current)} />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub">Reportable milestone</span>
                  <textarea className={`${fieldClass} min-h-24`} value={draft.reportable_milestone} onChange={(event) => setDraft((current) => current ? { ...current, reportable_milestone: event.target.value } : current)} />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub">Exit criteria</span>
                  <textarea className={`${fieldClass} min-h-32`} value={draft.exit_criteria} onChange={(event) => setDraft((current) => current ? { ...current, exit_criteria: event.target.value } : current)} />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub">Default probability</span>
                  <div className="relative">
                    <input className={`${fieldClass} pr-9`} type="number" min="0" max="100" value={draft.default_probability} disabled={draft.stage_type !== 'open'} onChange={(event) => setDraft((current) => current ? { ...current, default_probability: Number(event.target.value) } : current)} />
                    <span className="pointer-events-none absolute right-3 top-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">%</span>
                  </div>
                </label>
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub">Stage behavior</span>
                  <button type="button" disabled={draft.stage_type !== 'open'} onClick={() => setDraft((current) => current ? { ...current, is_optional: !current.is_optional } : current)} className={`flex w-full items-center justify-between rounded-lg border p-3 text-left ${draft.is_optional ? 'border-boh-primary bg-boh-primary/10' : 'border-boh-border-light dark:border-boh-border'} disabled:opacity-60`}>
                    <span>
                      <span className="block text-sm font-semibold text-boh-text-light dark:text-boh-text">Optional milestone</span>
                      <span className="mt-1 block text-xs text-boh-text-sub-light dark:text-boh-text-sub">May be skipped for this Funnel</span>
                    </span>
                    {draft.is_optional && <CheckCircle2 className="h-5 w-5 text-boh-primary" />}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-boh-border-light bg-boh-bg-light p-4 dark:border-boh-border dark:bg-boh-bg">
                <p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">Forecast rule</p>
                <p className="mt-2 text-sm text-boh-text-light dark:text-boh-text">The stage probability is the default. A permitted Opportunity-specific override remains unchanged when the Opportunity moves.</p>
              </div>

              <div className="flex justify-end">
                <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-boh-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save stage'}</button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[520px] items-center justify-center text-sm text-boh-text-sub-light dark:text-boh-text-sub">Select a stage card to manage its details.</div>
          )}
        </section>
      </div>
    </div>
  );
};

export default FunnelStagesPage;
