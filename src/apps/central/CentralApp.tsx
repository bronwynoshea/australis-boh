import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Routes, Route, Navigate } from 'react-router-dom';
import { BOHShell } from '../../boh/navigation';
import { bohApps } from '../../boh/navigation/appConfigs';
import BohSelect from '../../components/boh/BohSelect';
import Toast from '../../components/Toast';
import { useBohUsers } from '../../hooks/useBohUsers';
import {
  CentralCommandLookups,
  CentralCommandTask,
  fetchCentralCommandLookups,
  fetchCentralCommandTasks,
  updateCentralCommandTask,
} from '../../lib/api/centralCommand';

interface CentralAppProps {
  isAdmin?: boolean;
}

const emptyLookups: CentralCommandLookups = {
  taskStatuses: [],
  engagementTypes: [],
  engagementStatuses: [],
  capabilities: [],
};

const toOptions = (items: Array<{ id: string; label: string }>, includeEmpty = true) => [
  ...(includeEmpty ? [{ value: '', label: 'Unassigned' }] : []),
  ...items.map((item) => ({ value: item.id, label: item.label })),
];

const CentralOverview: React.FC = () => {
  const { users } = useBohUsers();
  const [tasks, setTasks] = useState<CentralCommandTask[]>([]);
  const [lookups, setLookups] = useState<CentralCommandLookups>(emptyLookups);
  const [selectedEngagementStatusId, setSelectedEngagementStatusId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [isToastVisible, setIsToastVisible] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [lookupData, taskData] = await Promise.all([
          fetchCentralCommandLookups(),
          fetchCentralCommandTasks(),
        ]);

        setLookups(lookupData);
        setTasks(taskData);
      } catch (error) {
        console.error('[CentralCommand] Failed to load overview', error);
        setToastMessage('Failed to load Central Command');
        setIsToastVisible(true);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const filteredTasks = useMemo(() => {
    if (!selectedEngagementStatusId) return tasks;
    return tasks.filter((task) => task.agent_engagement_status_id === selectedEngagementStatusId);
  }, [selectedEngagementStatusId, tasks]);

  const metrics = useMemo(() => {
    const readyForAgent = tasks.filter((task) => task.agent_engagement_status?.key === 'ready_for_agent').length;
    const needsContext = tasks.filter((task) => task.agent_engagement_status?.key === 'needs_context' || !task.agent_engagement_status_id).length;
    const humanReview = tasks.filter((task) => task.agent_engagement_status?.key === 'needs_human_review').length;
    const releaseGate = tasks.filter((task) => task.agent_engagement_status?.key === 'ready_for_release_gate').length;

    return { readyForAgent, needsContext, humanReview, releaseGate };
  }, [tasks]);

  const handleTaskPatch = async (
    task: CentralCommandTask,
    patch: Partial<CentralCommandTask>
  ) => {
    setSavingTaskId(task.id);
    try {
      const updatedTask = await updateCentralCommandTask(task.id, {
        agent_engagement_type_id: patch.agent_engagement_type_id ?? task.agent_engagement_type_id ?? null,
        agent_engagement_status_id: patch.agent_engagement_status_id ?? task.agent_engagement_status_id ?? null,
        agent_capability_id: patch.agent_capability_id ?? task.agent_capability_id ?? null,
        agent_readiness_notes: patch.agent_readiness_notes ?? task.agent_readiness_notes ?? null,
        assigned_to: patch.assigned_to ?? task.assigned_to ?? '',
        status: patch.status ?? task.status,
      });

      setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, ...updatedTask } : item)));
      setToastMessage('Task updated');
      setIsToastVisible(true);
    } catch (error) {
      console.error('[CentralCommand] Failed to update task', error);
      setToastMessage('Failed to update task');
      setIsToastVisible(true);
    } finally {
      setSavingTaskId(null);
    }
  };

  const userOptions = [
    { value: '', label: 'Unassigned' },
    ...users.map((user) => ({ value: user.id, label: user.full_name || user.email || 'Unnamed user' })),
  ];

  const taskStatusOptions = lookups.taskStatuses.map((status) => ({
    value: status.key,
    label: status.label,
  }));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-boh-bg-light dark:bg-boh-bg p-6">
        <div className="h-8 w-72 rounded bg-boh-skeleton mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 rounded-lg bg-boh-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text">
      <header className="border-b border-boh-border-light dark:border-boh-border px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Central Command</h1>
            <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              Agent engagement and human release readiness for initiative tasks.
            </p>
          </div>
          <div className="w-full lg:w-72">
            <BohSelect
              label="Engagement status"
              value={selectedEngagementStatusId}
              onChange={setSelectedEngagementStatusId}
              options={toOptions(lookups.engagementStatuses)}
              placeholder="All statuses"
            />
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-8 space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <MetricCard label="Needs context" value={metrics.needsContext} />
          <MetricCard label="Ready for agent" value={metrics.readyForAgent} />
          <MetricCard label="Human review" value={metrics.humanReview} />
          <MetricCard label="Release gate" value={metrics.releaseGate} />
        </section>

        <section className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface overflow-hidden">
          <div className="border-b border-boh-border-light dark:border-boh-border px-4 py-3">
            <h2 className="text-sm font-semibold">Initiative Task Engagement</h2>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              No initiative tasks match this view.
            </div>
          ) : (
            <div className="divide-y divide-boh-border-light dark:divide-boh-border">
              {filteredTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isSaving={savingTaskId === task.id}
                  taskStatusOptions={taskStatusOptions}
                  engagementTypeOptions={toOptions(lookups.engagementTypes)}
                  engagementStatusOptions={toOptions(lookups.engagementStatuses)}
                  capabilityOptions={toOptions(lookups.capabilities)}
                  userOptions={userOptions}
                  onPatch={(patch) => handleTaskPatch(task, patch)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <Toast
        message={toastMessage}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
        type="info"
      />
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-4">
    <div className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">{label}</div>
    <div className="mt-2 text-3xl font-semibold">{value}</div>
  </div>
);

const TaskRow: React.FC<{
  task: CentralCommandTask;
  isSaving: boolean;
  taskStatusOptions: Array<{ value: string; label: string }>;
  engagementTypeOptions: Array<{ value: string; label: string }>;
  engagementStatusOptions: Array<{ value: string; label: string }>;
  capabilityOptions: Array<{ value: string; label: string }>;
  userOptions: Array<{ value: string; label: string }>;
  onPatch: (patch: Partial<CentralCommandTask>) => void;
}> = ({
  task,
  isSaving,
  taskStatusOptions,
  engagementTypeOptions,
  engagementStatusOptions,
  capabilityOptions,
  userOptions,
  onPatch,
}) => {
  const initiative = task.user_story?.initiative;
  const appLabel = [initiative?.app?.name, initiative?.module?.label].filter(Boolean).join(' / ') || 'Unmapped app';
  const releaseLabel = initiative?.major_release?.version_label || 'No major release';
  const [readinessNotes, setReadinessNotes] = useState(task.agent_readiness_notes || '');

  useEffect(() => {
    setReadinessNotes(task.agent_readiness_notes || '');
  }, [task.agent_readiness_notes]);

  return (
    <article className="p-4">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(260px,1.2fr)_repeat(5,minmax(150px,180px))] gap-3">
        <div className="min-w-0">
          <Link
            to={`/forge/stories/${task.user_story_id}`}
            className="font-medium text-boh-text-light dark:text-boh-text hover:text-boh-primary dark:hover:text-boh-primary"
          >
            {task.title}
          </Link>
          <div className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
            {task.user_story?.title || 'No story'} · {initiative?.title || 'No initiative'}
          </div>
          <div className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
            {appLabel} · {initiative?.target_quarter || 'No quarter'} {initiative?.target_year || ''} · {releaseLabel}
          </div>
        </div>

        <BohSelect
          label="Task status"
          value={task.status}
          onChange={(status) => onPatch({ status: status as CentralCommandTask['status'] })}
          options={taskStatusOptions}
          disabled={isSaving}
        />
        <BohSelect
          label="Owner"
          value={task.assigned_to || ''}
          onChange={(assigned_to) => onPatch({ assigned_to })}
          options={userOptions}
          disabled={isSaving}
        />
        <BohSelect
          label="Engagement"
          value={task.agent_engagement_type_id || ''}
          onChange={(agent_engagement_type_id) => onPatch({ agent_engagement_type_id })}
          options={engagementTypeOptions}
          disabled={isSaving}
        />
        <BohSelect
          label="Central status"
          value={task.agent_engagement_status_id || ''}
          onChange={(agent_engagement_status_id) => onPatch({ agent_engagement_status_id })}
          options={engagementStatusOptions}
          disabled={isSaving}
        />
        <BohSelect
          label="Capability"
          value={task.agent_capability_id || ''}
          onChange={(agent_capability_id) => onPatch({ agent_capability_id })}
          options={capabilityOptions}
          disabled={isSaving}
        />
      </div>

      <div className="mt-3">
        <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
          Readiness notes
        </label>
        <textarea
          value={readinessNotes}
          onChange={(event) => setReadinessNotes(event.target.value)}
          onBlur={() => {
            if (readinessNotes !== (task.agent_readiness_notes || '')) {
              onPatch({ agent_readiness_notes: readinessNotes });
            }
          }}
          rows={2}
          disabled={isSaving}
          className="w-full rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg px-3 py-2 text-sm text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary/30"
        />
      </div>
    </article>
  );
};

const CentralApp: React.FC<CentralAppProps> = ({ isAdmin = false }) => {
  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin}>
      <Routes>
        <Route path="/" element={<CentralOverview />} />
        <Route path="*" element={<Navigate to="/central" replace />} />
      </Routes>
    </BOHShell>
  );
};

export default CentralApp;
