import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarDays, ChevronRight, CircleDollarSign, Plus, RefreshCw, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createOpportunity,
  fetchFunnelOrganisations,
  fetchFunnels,
  fetchOpportunities,
  fetchOpportunityStages,
  updateOpportunity,
} from '../api/funnelApi';
import { calculatePipelineMetrics, effectiveProbability, groupOpportunitiesByStage, validateStageMove } from '../model/funnelPipeline';
import type { Funnel, FunnelOpportunity, FunnelOpportunityInput, FunnelOpportunityStage, PatronOrganisationSummary } from '../types';

function formatMoney(value: number, currencyCode: string) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

interface OpportunityFormState {
  name: string;
  organisationId: string;
  value: string;
  currency: string;
  probability: string;
  expectedCloseDate: string;
  nextAction: string;
  nextActionDueAt: string;
  stageId: string;
  outcomeReason: string;
}

function emptyOpportunity(stageId = ''): OpportunityFormState {
  return {
    name: '',
    organisationId: '',
    value: '0',
    currency: 'AUD',
    probability: '',
    expectedCloseDate: '',
    nextAction: '',
    nextActionDueAt: '',
    stageId,
    outcomeReason: '',
  };
}

function formFromOpportunity(opportunity: FunnelOpportunity): OpportunityFormState {
  return {
    name: opportunity.name,
    organisationId: opportunity.primary_organisation_id ?? '',
    value: String(opportunity.value_amount),
    currency: opportunity.currency,
    probability: opportunity.probability_override == null ? '' : String(opportunity.probability_override),
    expectedCloseDate: opportunity.expected_close_date ?? '',
    nextAction: opportunity.next_action ?? '',
    nextActionDueAt: opportunity.next_action_due_at?.slice(0, 16) ?? '',
    stageId: opportunity.stage_id,
    outcomeReason: opportunity.outcome_reason ?? '',
  };
}

const fieldClass = 'w-full rounded-lg border border-boh-border-light bg-white px-3 py-2 text-sm text-boh-text-light outline-none transition focus:border-boh-primary dark:border-boh-border dark:bg-boh-surface dark:text-boh-text';

const FunnelPipelinePage: React.FC = () => {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState('');
  const [stages, setStages] = useState<FunnelOpportunityStage[]>([]);
  const [opportunities, setOpportunities] = useState<FunnelOpportunity[]>([]);
  const [organisations, setOrganisations] = useState<PatronOrganisationSummary[]>([]);
  const [selectedStageId, setSelectedStageId] = useState('');
  const [selectedOpportunityId, setSelectedOpportunityId] = useState('');
  const [form, setForm] = useState<OpportunityFormState>(emptyOpportunity());
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState('AUD');

  const loadPipeline = async (funnelId: string, preserveSelection = true) => {
    if (!funnelId) return;
    setError(null);
    const [loadedStages, loadedOpportunities] = await Promise.all([
      fetchOpportunityStages(funnelId),
      fetchOpportunities(funnelId),
    ]);
    setStages(loadedStages);
    setOpportunities(loadedOpportunities);
    setSelectedCurrency((current) => loadedOpportunities.some((opportunity) => opportunity.currency === current)
      ? current
      : loadedOpportunities[0]?.currency ?? 'AUD');
    setSelectedStageId((current) => preserveSelection && loadedStages.some((stage) => stage.id === current)
      ? current
      : loadedStages[0]?.id ?? '');
    setSelectedOpportunityId((current) => preserveSelection && loadedOpportunities.some((opportunity) => opportunity.id === current)
      ? current
      : '');
  };

  const loadFunnelContext = async () => {
    try {
      setLoading(true);
      setError(null);
      const [loadedFunnels, loadedOrganisations] = await Promise.all([
        fetchFunnels(),
        fetchFunnelOrganisations(),
      ]);
      setFunnels(loadedFunnels);
      setOrganisations(loadedOrganisations);
      setSelectedFunnelId(loadedFunnels[0]?.id ?? '');
    } catch (loadError) {
      console.error('[Funnel] Unable to load Pipeline', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the Pipeline.');
    } finally {
      setLoading(false);
    }
  };

  const refreshPipeline = async () => {
    try {
      setLoading(true);
      setError(null);
      await loadPipeline(selectedFunnelId);
    } catch (loadError) {
      console.error('[Funnel] Unable to refresh Opportunities', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Unable to refresh Opportunities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFunnelContext();
  }, []);

  useEffect(() => {
    if (!selectedFunnelId) return;
    setLoading(true);
    loadPipeline(selectedFunnelId, false)
      .catch((loadError) => {
        console.error('[Funnel] Unable to load Opportunities', loadError);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load Opportunities.');
      })
      .finally(() => setLoading(false));
  }, [selectedFunnelId]);

  const currencies = useMemo(
    () => [...new Set(opportunities.map((opportunity) => opportunity.currency))].sort(),
    [opportunities],
  );
  const currencyOpportunities = useMemo(
    () => opportunities.filter((opportunity) => opportunity.currency === selectedCurrency),
    [opportunities, selectedCurrency],
  );
  const stageGroups = useMemo(
    () => groupOpportunitiesByStage(stages, currencyOpportunities),
    [stages, currencyOpportunities],
  );
  const metrics = useMemo(
    () => calculatePipelineMetrics(stages, currencyOpportunities),
    [stages, currencyOpportunities],
  );
  const selectedStage = stages.find((stage) => stage.id === selectedStageId) ?? null;
  const selectedGroup = stageGroups.find((group) => group.stage.id === selectedStageId) ?? null;
  const selectedOpportunity = opportunities.find((opportunity) => opportunity.id === selectedOpportunityId) ?? null;

  useEffect(() => {
    if (selectedOpportunity) {
      setForm(formFromOpportunity(selectedOpportunity));
      setIsCreating(false);
    }
  }, [selectedOpportunity]);

  const selectStage = (stage: FunnelOpportunityStage) => {
    setSelectedStageId(stage.id);
    setSelectedOpportunityId('');
    setIsCreating(false);
  };

  const startCreate = () => {
    const initialStage = selectedStage?.stage_type === 'open'
      ? selectedStage.id
      : stages.find((stage) => stage.stage_type === 'open')?.id ?? selectedStageId;
    setForm({ ...emptyOpportunity(initialStage), currency: selectedCurrency });
    setSelectedOpportunityId('');
    setIsCreating(true);
  };

  const saveOpportunity = async () => {
    const targetStage = stages.find((stage) => stage.id === form.stageId);
    if (!targetStage) return;
    if (!form.name.trim()) {
      toast.error('Opportunity name is required.');
      return;
    }
    const validation = validateStageMove(targetStage, form.outcomeReason);
    if (!validation.valid) {
      toast.error(validation.message ?? 'Review the stage requirements.');
      return;
    }

    try {
      setSaving(true);
      const common = {
        stage_id: form.stageId,
        name: form.name.trim(),
        primary_organisation_id: form.organisationId || null,
        value_amount: Number(form.value || 0),
        currency: form.currency.toUpperCase(),
        probability_override: form.probability === '' ? null : Number(form.probability),
        expected_close_date: form.expectedCloseDate || null,
        next_action: form.nextAction.trim() || null,
        next_action_due_at: form.nextActionDueAt ? new Date(form.nextActionDueAt).toISOString() : null,
        outcome_reason: targetStage.stage_type === 'lost' ? form.outcomeReason.trim() || null : null,
      };

      if (isCreating) {
        const input: FunnelOpportunityInput = { ...common, funnel_id: selectedFunnelId };
        const created = await createOpportunity(input);
        setSelectedOpportunityId(created.id);
        toast.success('Opportunity created.');
      } else if (selectedOpportunity) {
        await updateOpportunity(selectedOpportunity.id, common);
        toast.success('Opportunity updated.');
      }

      await loadPipeline(selectedFunnelId);
      setIsCreating(false);
    } catch (saveError) {
      console.error('[Funnel] Unable to save Opportunity', saveError);
      toast.error(saveError instanceof Error ? saveError.message : 'Unable to save the Opportunity.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && funnels.length === 0) {
    return <div className="rounded-xl border border-boh-border-light bg-boh-surface-light p-8 text-sm text-boh-text-sub-light dark:border-boh-border dark:bg-boh-surface dark:text-boh-text-sub">Loading Funnel...</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/60 dark:bg-red-950/30">
        <h2 className="font-semibold text-red-900 dark:text-red-100">Funnel could not load</h2>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
        <button type="button" onClick={() => void (funnels.length ? refreshPipeline() : loadFunnelContext())} className="mt-4 rounded-lg bg-red-900 px-4 py-2 text-sm font-semibold text-white dark:bg-red-100 dark:text-red-950">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 lg:pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-boh-text-sub-light dark:text-boh-text-sub">Sales pipeline</p>
          <h2 className="mt-1 text-2xl font-semibold text-boh-text-light dark:text-boh-text">Opportunities</h2>
          <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">Milestones, forecast, and next actions linked to Patron.</p>
        </div>
        <div className="flex items-center gap-2">
          {funnels.length > 1 && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Funnels">
              {funnels.map((funnel) => (
                <button
                  key={funnel.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedFunnelId === funnel.id}
                  onClick={() => setSelectedFunnelId(funnel.id)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${selectedFunnelId === funnel.id
                    ? 'border-boh-primary bg-boh-primary text-white'
                    : 'border-boh-border-light bg-white text-boh-text-light dark:border-boh-border dark:bg-boh-surface dark:text-boh-text'}`}
                >
                  {funnel.name}
                </button>
              ))}
            </div>
          )}
          {currencies.length > 1 && (
            <div className="flex gap-1" role="tablist" aria-label="Pipeline currency">
              {currencies.map((currencyCode) => (
                <button key={currencyCode} type="button" role="tab" aria-selected={selectedCurrency === currencyCode} onClick={() => setSelectedCurrency(currencyCode)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${selectedCurrency === currencyCode ? 'border-boh-primary bg-boh-primary/10 text-boh-primary' : 'border-boh-border-light dark:border-boh-border'}`}>{currencyCode}</button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => void refreshPipeline()}
            className="rounded-lg border border-boh-border-light bg-white p-2.5 text-boh-text-sub-light hover:text-boh-text-light dark:border-boh-border dark:bg-boh-surface dark:text-boh-text-sub dark:hover:text-boh-text"
            aria-label="Refresh Pipeline"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-boh-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Opportunity
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Open pipeline', value: formatMoney(metrics.openValue, selectedCurrency), detail: `${metrics.openCount} open`, icon: CircleDollarSign },
          { label: 'Weighted forecast', value: formatMoney(metrics.weightedValue, selectedCurrency), detail: 'Stage probability', icon: Target },
          { label: 'Closed Won', value: formatMoney(metrics.wonValue, selectedCurrency), detail: 'Binding outcomes', icon: ChevronRight },
          { label: 'Closed Lost', value: formatMoney(metrics.lostValue, selectedCurrency), detail: 'Recorded losses', icon: ChevronRight },
        ].map((metric) => (
          <div key={metric.label} className="rounded-xl border border-boh-border-light bg-boh-surface-light p-4 dark:border-boh-border dark:bg-boh-surface">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">{metric.label}</p>
              <metric.icon className="h-4 w-4 text-boh-primary" />
            </div>
            <p className="mt-2 text-xl font-semibold text-boh-text-light dark:text-boh-text">{metric.value}</p>
            <p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">{metric.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid min-h-[640px] gap-4 lg:h-[680px] lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-xl border border-boh-border-light bg-boh-surface-light p-3 dark:border-boh-border dark:bg-boh-surface">
          <div className="mb-3 px-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">Stages</p>
          </div>
          <div className="max-h-[610px] space-y-2 overflow-y-auto pr-1">
            {stageGroups.map((group) => {
              const active = group.stage.id === selectedStageId;
              return (
                <button
                  type="button"
                  key={group.stage.id}
                  onClick={() => selectStage(group.stage)}
                  className={`w-full rounded-lg border p-3 text-left transition ${active
                    ? 'border-boh-primary bg-boh-primary/10 shadow-sm'
                    : 'border-boh-border-light bg-white hover:border-boh-primary/50 dark:border-boh-border dark:bg-boh-bg'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-boh-text-light dark:text-boh-text">{group.stage.label}</p>
                      <p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">{group.stage.default_probability}% probability</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-boh-bg-light px-2 py-0.5 text-xs font-semibold text-boh-text-sub-light dark:bg-boh-surface dark:text-boh-text-sub">{group.opportunities.length}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-boh-text-sub-light dark:text-boh-text-sub">Value</span>
                    <span className="font-semibold text-boh-text-light dark:text-boh-text">{formatMoney(group.totalValue, selectedCurrency)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0 rounded-xl border border-boh-border-light bg-boh-surface-light dark:border-boh-border dark:bg-boh-surface lg:overflow-hidden">
          {selectedStage && (
            <div className="border-b border-boh-border-light p-5 dark:border-boh-border">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-boh-text-light dark:text-boh-text">{selectedStage.label}</h3>
                    <span className="whitespace-nowrap rounded-full bg-boh-primary/10 px-2.5 py-1 text-xs font-semibold text-boh-primary">{selectedStage.default_probability}%</span>
                  </div>
                  <p className="mt-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">{selectedStage.reportable_milestone}</p>
                  <p className="mt-2 rounded-lg bg-boh-bg-light p-3 text-sm text-boh-text-light dark:bg-boh-bg dark:text-boh-text">{selectedStage.exit_criteria}</p>
                </div>
                <button type="button" onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg border border-boh-border-light px-3 py-2 text-sm font-semibold text-boh-text-light hover:border-boh-primary dark:border-boh-border dark:text-boh-text">
                  <Plus className="h-4 w-4" /> Add here
                </button>
              </div>
            </div>
          )}

          <div className="grid min-h-[490px] xl:h-[510px] xl:grid-cols-[minmax(280px,0.9fr)_minmax(360px,1.35fr)] xl:overflow-hidden">
            <div className="border-b border-boh-border-light p-4 dark:border-boh-border xl:overflow-y-auto xl:border-b-0 xl:border-r">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">Opportunities</p>
              <div className="space-y-2">
                {selectedGroup?.opportunities.map((opportunity) => {
                  const active = opportunity.id === selectedOpportunityId;
                  const probability = effectiveProbability(opportunity, selectedStage ?? selectedGroup.stage);
                  return (
                    <button
                      type="button"
                      key={opportunity.id}
                      onClick={() => setSelectedOpportunityId(opportunity.id)}
                      className={`w-full rounded-lg border p-3 text-left ${active
                        ? 'border-boh-primary bg-boh-primary/10'
                        : 'border-boh-border-light bg-white hover:border-boh-primary/50 dark:border-boh-border dark:bg-boh-bg'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-boh-text-light dark:text-boh-text">{opportunity.name}</p>
                          <p className="mt-1 flex items-center gap-1 truncate text-xs text-boh-text-sub-light dark:text-boh-text-sub"><Building2 className="h-3.5 w-3.5" />{opportunity.organisation?.name ?? 'No organisation linked'}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-boh-text-sub-light dark:text-boh-text-sub" />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="font-semibold text-boh-text-light dark:text-boh-text">{formatMoney(opportunity.value_amount, opportunity.currency)}</span>
                        <span className="text-boh-text-sub-light dark:text-boh-text-sub">{probability}%</span>
                      </div>
                    </button>
                  );
                })}
                {selectedGroup?.opportunities.length === 0 && (
                  <div className="rounded-lg border border-dashed border-boh-border-light p-6 text-center dark:border-boh-border">
                    <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">No Opportunities at this milestone.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 xl:overflow-y-auto">
              {(selectedOpportunity || isCreating) ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">{isCreating ? 'New Opportunity' : 'Opportunity detail'}</p>
                      <h4 className="mt-1 text-lg font-semibold text-boh-text-light dark:text-boh-text">{isCreating ? 'Create Opportunity' : selectedOpportunity?.name}</h4>
                    </div>
                    {isCreating && <button type="button" onClick={() => setIsCreating(false)} className="text-sm font-medium text-boh-text-sub-light hover:text-boh-text-light dark:text-boh-text-sub dark:hover:text-boh-text">Cancel</button>}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="sm:col-span-2">
                      <span className="mb-1.5 block text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub">Opportunity name</span>
                      <input className={fieldClass} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="mb-1.5 block text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub">Patron organisation</span>
                      <div className="grid max-h-40 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                        <button type="button" onClick={() => setForm((current) => ({ ...current, organisationId: '' }))} className={`rounded-lg border p-2.5 text-left text-sm ${form.organisationId === '' ? 'border-boh-primary bg-boh-primary/10' : 'border-boh-border-light dark:border-boh-border'}`}>No organisation</button>
                        {organisations.map((organisation) => (
                          <button key={organisation.id} type="button" onClick={() => setForm((current) => ({ ...current, organisationId: organisation.id }))} className={`rounded-lg border p-2.5 text-left text-sm ${form.organisationId === organisation.id ? 'border-boh-primary bg-boh-primary/10' : 'border-boh-border-light dark:border-boh-border'}`}>{organisation.name}</button>
                        ))}
                      </div>
                    </label>
                    <label>
                      <span className="mb-1.5 block text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub">Value</span>
                      <input className={fieldClass} type="number" min="0" value={form.value} onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))} />
                    </label>
                    <label>
                      <span className="mb-1.5 block text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub">Currency</span>
                      <input className={fieldClass} maxLength={3} value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} />
                    </label>
                    <label>
                      <span className="mb-1.5 block text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub">Probability override</span>
                      <input className={fieldClass} type="number" min="0" max="100" placeholder="Use stage default" value={form.probability} onChange={(event) => setForm((current) => ({ ...current, probability: event.target.value }))} />
                    </label>
                    <label>
                      <span className="mb-1.5 block text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub">Expected close</span>
                      <input className={fieldClass} type="date" value={form.expectedCloseDate} onChange={(event) => setForm((current) => ({ ...current, expectedCloseDate: event.target.value }))} />
                    </label>
                    <label>
                      <span className="mb-1.5 block text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub">Next action due</span>
                      <input className={fieldClass} type="datetime-local" value={form.nextActionDueAt} onChange={(event) => setForm((current) => ({ ...current, nextActionDueAt: event.target.value }))} />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="mb-1.5 block text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub">Next action</span>
                      <input className={fieldClass} value={form.nextAction} onChange={(event) => setForm((current) => ({ ...current, nextAction: event.target.value }))} />
                    </label>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub">Sales milestone</p>
                    <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
                      {stages.map((stage) => (
                        <button key={stage.id} type="button" onClick={() => setForm((current) => ({ ...current, stageId: stage.id, outcomeReason: stage.stage_type === 'lost' ? current.outcomeReason : '' }))} className={`rounded-lg border p-3 text-left ${form.stageId === stage.id ? 'border-boh-primary bg-boh-primary/10' : 'border-boh-border-light dark:border-boh-border'}`}>
                          <span className="block text-sm font-semibold text-boh-text-light dark:text-boh-text">{stage.label}</span>
                          <span className="mt-1 block text-xs text-boh-text-sub-light dark:text-boh-text-sub">{stage.default_probability}% default</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {stages.find((stage) => stage.id === form.stageId)?.stage_type === 'lost' && (
                    <label>
                      <span className="mb-1.5 block text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub">Loss reason</span>
                      <textarea className={`${fieldClass} min-h-24`} value={form.outcomeReason} onChange={(event) => setForm((current) => ({ ...current, outcomeReason: event.target.value }))} />
                    </label>
                  )}

                  <div className="flex justify-end">
                    <button type="button" disabled={saving} onClick={() => void saveOpportunity()} className="rounded-lg bg-boh-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                      {saving ? 'Saving...' : isCreating ? 'Create Opportunity' : 'Save changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[430px] items-center justify-center">
                  <div className="max-w-sm text-center">
                    <CalendarDays className="mx-auto h-9 w-9 text-boh-primary" />
                    <h4 className="mt-3 text-lg font-semibold text-boh-text-light dark:text-boh-text">Select an Opportunity</h4>
                    <p className="mt-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">Choose a card to review the milestone, value, probability, and next action.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default FunnelPipelinePage;
