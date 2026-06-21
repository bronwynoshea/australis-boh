import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Ticket, Activity, Agent, CounterAppArea, CounterTicketStatus, CounterTicketPriority, CounterAppOption, ReleaseVersion } from '../types';

import { CAREER_MODULE_LABELS, SEVERITY_OPTIONS } from '../constants';
import { StatusBadge, AppBadge, PriorityBadge, SeverityBadge } from '../components/Badges';
import { ArrowLeftIcon } from '../components/Icons';
import { supabase } from '../../../../lib/supabase';
import BohSelect, { type BohSelectOption } from '../../../../components/boh/BohSelect';
import { 
  fetchTicketComments, 
  addTicketComment, 
  updateTicketComment, 
  fetchTicketLookups, 
  updateTicket,
  fetchReleaseVersions
} from '../api/counterTicketsApi';

interface TicketDetailPageProps {
  ticket: Ticket;
  agents: Agent[];
  onBack: () => void;
  onUpdateTicket: (updatedTicket: Ticket) => void;
  variant?: 'page' | 'drawer';
}

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
};

const SelectChevron: React.FC = () => null;

const hybridReleaseAppKeys = new Set(['chatz', 'counter', 'loft', 'slotz']);

const getCanonicalReleaseAppKey = (appKey?: string | null) => (
  appKey === 'career_studio' ? 'studio' : (appKey || '')
);

const TicketDetailPage: React.FC<TicketDetailPageProps> = ({ ticket, agents, onBack, onUpdateTicket, variant = 'page' }) => {
  const isDrawerVariant = variant === 'drawer';
  const detailSectionClass = isDrawerVariant
    ? 'rounded-md border border-boh-border-light p-3 dark:border-boh-border'
    : 'rounded-lg border border-boh-border-light bg-boh-surface-light p-4 shadow-sm dark:border-boh-border dark:bg-boh-bg';
  const detailSubsectionClass = isDrawerVariant
    ? 'rounded-md border border-boh-border-light p-3 dark:border-boh-border'
    : 'rounded-lg border border-boh-border-light bg-boh-bg-light/45 p-3 dark:border-boh-border dark:bg-boh-surface/45';
  const [activities, setActivities] = useState<Activity[]>([]);
  const [composerType, setComposerType] = useState<'reply' | 'internal'>('reply');
  const [composerText, setComposerText] = useState('');
  const [isComposerVisible, setIsComposerVisible] = useState(true);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closeComment, setCloseComment] = useState('');
  const [shouldNotifyOnClose, setShouldNotifyOnClose] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'requester' | 'activity' | 'history'>('details');

  const [appAreas, setAppAreas] = useState<CounterAppArea[]>([]);
  const [statusOptions, setStatusOptions] = useState<CounterTicketStatus[]>([]);
  const [priorityOptions, setPriorityOptions] = useState<CounterTicketPriority[]>([]);
  const [counterApps, setCounterApps] = useState<CounterAppOption[]>([]);
  const [releaseVersions, setReleaseVersions] = useState<ReleaseVersion[]>([]);

  const [selectedAppAreaId, setSelectedAppAreaId] = useState('');
  const [isLoadingAreas, setIsLoadingAreas] = useState(true);

  const [isEditingTicket, setIsEditingTicket] = useState(false);
  const [isSavingTicket, setIsSavingTicket] = useState(false);
  const [draftSubject, setDraftSubject] = useState(ticket.subject);
  const [draftDescription, setDraftDescription] = useState(ticket.description);
  
  // Separate state for edit mode selections
  const [selectedStatusId, setSelectedStatusId] = useState(ticket.statusId);
  const [selectedPriorityId, setSelectedPriorityId] = useState(ticket.priorityId);
  const [selectedReleaseVersionId, setSelectedReleaseVersionId] = useState(ticket.release_version_id || '');

  // Activity Editing State
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editActivityText, setEditActivityText] = useState('');

  const [currentBohUserId, setCurrentBohUserId] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const loadCurrentBohUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: bohUser, error } = await supabase
          .from('boh_user')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (!error && bohUser?.id) {
          setCurrentBohUserId(bohUser.id);
        }
      } catch (err) {
        console.error('Error loading current boh_user for TicketDetailPage:', err);
      }
    };

    loadCurrentBohUser();
  }, []);

  const canEdit = useMemo(() => {
    if (!currentBohUserId) return false;
    if (!ticket.created_by_user?.id) return true;
    const isCreator = ticket.created_by_user.id === currentBohUserId;
    const isAssignee = ticket.assigned_to_user?.id === currentBohUserId;
    return isCreator || isAssignee;
  }, [currentBohUserId, ticket.created_by_user, ticket.assigned_to_user]);

  const canUpdateStatus = useMemo(() => {
    if (!currentBohUserId) return false;
    const isCreator = ticket.created_by_user?.id === currentBohUserId || !ticket.created_by_user?.id;
    const isAssignee = ticket.assigned_to_user?.id === currentBohUserId;
    return isCreator || isAssignee;
  }, [currentBohUserId, ticket.created_by_user, ticket.assigned_to_user]);

  const isTicketClosed = useMemo(() => {
    const key = (ticket.statusKey || ticket.statusLabel || '').toLowerCase();
    return key.includes('closed') || key.includes('resolved') || key.includes('done');
  }, [ticket.statusKey, ticket.statusLabel]);

  const isInternalNoteDisabled = useMemo(() => {
    return isTicketClosed;
  }, [isTicketClosed]);

  useEffect(() => {
    if (isComposerVisible && composerRef.current) {
      composerRef.current.focus({ preventScroll: true });
    }
  }, [composerType, isComposerVisible]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingAreas(true);
      try {
        const [areasResponse, lookups, releases] = await Promise.all([
          supabase
            .from('counter_app_area')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
          fetchTicketLookups(),
          fetchReleaseVersions()
        ]);

        if (areasResponse.error) {
          console.error('Error fetching app areas:', areasResponse.error);
        } else {
          setAppAreas(areasResponse.data || []);
        }

        setStatusOptions(lookups.statuses);
        setPriorityOptions(lookups.priorities);
        setCounterApps(lookups.apps);
        setReleaseVersions(releases);

      } catch (err) {
        console.error('Error fetching reference data:', err);
      } finally {
        setIsLoadingAreas(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const loadComments = async () => {
      try {
        const loaded = await fetchTicketComments(ticket.id);
        setActivities(loaded);
      } catch (err) {
        console.error('Error loading ticket comments:', err);
      }
    };

    loadComments();
  }, [ticket.id]);

  useEffect(() => {
    if (isEditingTicket) return;
    setDraftSubject(ticket.subject);
    setDraftDescription(ticket.description);
    setSelectedStatusId(ticket.statusId);
    setSelectedPriorityId(ticket.priorityId);
    setSelectedReleaseVersionId(ticket.release_version_id || '');

    const byId = appAreas.find(area => area.id === ticket.app_area_id);
    const byCode = appAreas.find(area => area.code === ticket.app);
    const area = byId || byCode || null;
    setSelectedAppAreaId(area ? area.id : '');
  }, [ticket, appAreas, isEditingTicket]);

  const assignableAgents = useMemo(() => {
    return agents.filter(agent => agent.canReceiveTickets);
  }, [agents]);

  const statusSelectOptions = useMemo<BohSelectOption[]>(() => (
    statusOptions.map(status => ({ value: status.id, label: status.label }))
  ), [statusOptions]);

  const prioritySelectOptions = useMemo<BohSelectOption[]>(() => (
    priorityOptions.map(priority => ({ value: priority.id, label: priority.label }))
  ), [priorityOptions]);

  const assigneeSelectOptions = useMemo<BohSelectOption[]>(() => [
    { value: 'Unassigned', label: 'Unassigned' },
    ...assignableAgents.map(agent => ({ value: agent.name, label: agent.name })),
  ], [assignableAgents]);

  const appAreaSelectOptions = useMemo<BohSelectOption[]>(() => [
    { value: '', label: 'Select an app area' },
    ...appAreas.map(area => ({ value: area.id, label: area.label })),
  ], [appAreas]);

  const severityLabel = useMemo(() => {
    return SEVERITY_OPTIONS.find(opt => opt.key === ticket.severity)?.label || ticket.severity;
  }, [ticket.severity]);

  const appDisplayString = useMemo(() => {
    const selectedArea = appAreas.find(area => area.id === ticket.app_area_id || area.code === ticket.app);

    if (selectedArea) {
      const areaLabel = selectedArea.label;
      if (ticket.careerModule && ticket.careerModule !== 'none') {
        const moduleLabel = CAREER_MODULE_LABELS[ticket.careerModule];
        return `${areaLabel} – ${moduleLabel}`;
      }
      return areaLabel;
    }

    return ticket.app || 'Unknown';
  }, [ticket.app_area_id, ticket.app, appAreas]);

  const releaseVersionDisplay = useMemo(() => {
    if (!ticket.release_version_id) return 'None';
    const version = releaseVersions.find(v => v.id === ticket.release_version_id);
    if (!version) return 'Unknown Version';

    const year = typeof (version as any).release_year === 'number' ? String((version as any).release_year) : '';
    const cycle = typeof (version as any).release_cycle === 'string' ? (version as any).release_cycle : '';
    const vn = typeof version.version_number === 'string' && version.version_number.trim() ? `v${version.version_number.trim().replace(/^v\s*/i, '')}` : '';
    const parts = [year, cycle, vn].filter(Boolean);
    const prefix = parts.length ? `${parts.join(' · ')} · ` : '';
    return `${prefix}${version.version_label}`;
  }, [ticket.release_version_id, releaseVersions]);

  const minorReleaseVersions = useMemo(() => {
    const cycleWeights: Record<string, number> = {
      q1: 0.1,
      q2: 0.2,
      q3: 0.3,
      q4: 0.4,
    };
    const allowedStatuses = new Set(['planned', 'in progress', 'scheduled', 'pending', 'in_progress']);
    const normalizeStatus = (status?: string | null) => (status || '').trim().toLowerCase();
    const pinnedReleaseIds = new Set(
      [selectedReleaseVersionId, ticket.release_version_id].filter(Boolean) as string[],
    );
    const selectedArea = appAreas.find(area => area.id === selectedAppAreaId)
      || appAreas.find(area => area.id === ticket.app_area_id || area.code === ticket.app);
    const selectedApp = counterApps.find(app => app.id === ticket.app_id)
      || counterApps.find(app => app.slug === ticket.app || app.app_context === ticket.app);
    const ticketAppKey = getCanonicalReleaseAppKey(ticket.app);
    const selectedAppKey = getCanonicalReleaseAppKey(selectedApp?.slug || selectedApp?.app_context);
    const isHybridExternalRelease = hybridReleaseAppKeys.has(ticketAppKey)
      || hybridReleaseAppKeys.has(selectedAppKey)
      || selectedApp?.surface === 'hybrid';
    const targetEnvironment = isHybridExternalRelease || selectedArea?.audience === 'external' || selectedApp?.surface === 'external'
      ? 'external'
      : 'internal';

    const getSortValue = (version: ReleaseVersion) => {
      const explicitDate = version.sort_date || version.release_date;
      if (explicitDate) {
        const timestamp = Date.parse(explicitDate);
        if (!Number.isNaN(timestamp)) {
          return timestamp;
        }
      }

      const year = version.release_year ?? 0;
      const cycleKey = (version.release_cycle || '').toLowerCase();
      return year + (cycleWeights[cycleKey] ?? 0);
    };

    const isAllowedStatus = (status?: string | null) => {
      const normalized = normalizeStatus(status);
      if (!normalized) return true;
      return allowedStatuses.has(normalized);
    };

    return [...releaseVersions]
      .filter((version) => {
        const tier = (version.release_tier || 'minor').toLowerCase();
        const environment = (version.environment || '').toLowerCase();
        const isPinned = version.id ? pinnedReleaseIds.has(version.id) : false;
        const isMatchingEnvironment = environment === targetEnvironment;
        return tier !== 'major' && (isMatchingEnvironment || isPinned) && (isAllowedStatus(version.status) || isPinned);
      })
      .sort((a, b) => getSortValue(a) - getSortValue(b));
  }, [appAreas, counterApps, releaseVersions, selectedAppAreaId, selectedReleaseVersionId, ticket]);

  const minorReleaseSelectOptions = useMemo<BohSelectOption[]>(() => [
    { value: '', label: 'None' },
    ...minorReleaseVersions.map((version) => {
      const year = typeof version.release_year === 'number' ? String(version.release_year) : '';
      const cycle = typeof version.release_cycle === 'string' ? version.release_cycle : '';
      const vn = typeof version.version_number === 'string' && version.version_number.trim() ? `v${version.version_number.trim().replace(/^v\s*/i, '')}` : '';
      const prefixParts = [year, cycle, vn].filter(Boolean);
      const prefix = prefixParts.length ? `${prefixParts.join(' - ')} - ` : '';
      return {
        value: version.id,
        label: `${prefix}${version.version_label}`,
      };
    }),
  ], [minorReleaseVersions]);

  const resolveStatusByKeyFragment = async (
    fragment: string,
  ): Promise<{ id: string; key: string; label: string } | null> => {
    try {
      const { data, error } = await supabase
        .from('counter_ticket_status')
        .select('id, key, label')
        .ilike('key', `%${fragment}%`)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      return data as { id: string; key: string; label: string };
    } catch {
      return null;
    }
  };

  const handleAssigneeChange = async (newAssigneeName: string) => {
    if (!canEdit) return;

    const selectedAgent = assignableAgents.find(agent => agent.name === newAssigneeName);
    if (!selectedAgent || !selectedAgent.bohUserId) return;

    try {
      const { assignTicket } = await import('../api/counterTicketsApi');
      const updatedTicket = await assignTicket(ticket.id, selectedAgent.bohUserId);
      onUpdateTicket(updatedTicket);
    } catch (err) {
      console.error('Error assigning ticket:', err);
    }
  };

  const handleAppAreaChange = async (newAppAreaId: string) => {
    if (!canEdit) return;

    setSelectedAppAreaId(newAppAreaId);
    if (!isEditingTicket) {
      const selectedArea = appAreas.find(area => area.id === newAppAreaId);
      if (selectedArea) {
        onUpdateTicket({ ...ticket, app: selectedArea.code as any, lastUpdatedAt: new Date() });
      }
    }
  };

  const handleStartEditActivity = (activity: Activity) => {
    if (activity.id) {
        setEditingActivityId(activity.id);
        setEditActivityText(activity.note);
    }
  };

  const handleCancelEditActivity = () => {
    setEditingActivityId(null);
    setEditActivityText('');
  };

  const handleSaveActivityEdit = async (activityId: string) => {
    const trimmed = editActivityText.trim();
    if (!trimmed) return;

    try {
        await updateTicketComment(activityId, trimmed);
        const updated = await fetchTicketComments(ticket.id);
        setActivities(updated);
        setEditingActivityId(null);
        setEditActivityText('');
    } catch (err) {
        console.error('Error updating activity:', err);
    }
  };

  const handleAddActivity = async () => {
    const trimmed = composerText.trim();
    if (!trimmed) return;

    const isReply = composerType === 'reply';

    if (!isReply && isTicketClosed) return;

    try {
      await addTicketComment(ticket.id, trimmed, {
        isVisibleToRequester: isReply,
        shouldNotifyRequester: isReply,
        authorId: currentBohUserId,
      });

      const updated = await fetchTicketComments(ticket.id);
      setActivities(updated);
      setComposerText('');
      onUpdateTicket({ ...ticket, lastUpdatedAt: new Date() });
    } catch (err) {
      console.error('Error adding ticket comment:', err);
    }
  };

  const handleCloseTicketWithComment = async () => {
    const trimmed = closeComment.trim();
    if (!trimmed || !canUpdateStatus) return;

    try {
      await addTicketComment(ticket.id, `[[close_ticket_note]] ${trimmed}`, {
        isVisibleToRequester: shouldNotifyOnClose,
        shouldNotifyRequester: shouldNotifyOnClose,
        authorId: currentBohUserId,
      });

      const updated = await fetchTicketComments(ticket.id);
      setActivities(updated);
      setCloseComment('');
      setShouldNotifyOnClose(false);
      setIsCloseModalOpen(false);

      const closed = await resolveStatusByKeyFragment('closed');
      const newStatusId = closed?.id ?? ticket.statusId;
      
      const updatedTicket = await updateTicket(ticket.id, {
        statusId: newStatusId,
        lastUpdatedAt: new Date()
      });
      
      onUpdateTicket(updatedTicket);
    } catch (err) {
      console.error('Error closing ticket with comment:', err);
    }
  };

  const handleReopenTicket = async () => {
    if (!canUpdateStatus) return;

    try {
      const nonClosedStatuses = statusOptions.filter((s) => {
        const key = (s.key || s.label || '').toLowerCase();
        return !(key.includes('closed') || key.includes('resolved') || key.includes('done'));
      });

      const byOpen = nonClosedStatuses.find((s) => (s.key || '').toLowerCase().includes('open'));
      const byNew = nonClosedStatuses.find((s) => (s.key || '').toLowerCase().includes('new'));
      const fallback = nonClosedStatuses[0] ?? null;

      let nextStatusId = byOpen?.id ?? byNew?.id ?? fallback?.id ?? null;

      if (!nextStatusId) {
        const open = await resolveStatusByKeyFragment('open');
        const newStatus = open ?? (await resolveStatusByKeyFragment('new'));
        nextStatusId = newStatus?.id ?? null;
      }

      if (!nextStatusId) return;

      const updatedTicket = await updateTicket(ticket.id, {
        statusId: nextStatusId,
        lastUpdatedAt: new Date(),
      });

      onUpdateTicket(updatedTicket);
    } catch (err) {
      console.error('Error reopening ticket:', err);
    }
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(ticket.requesterEmail);
  };

  const handleStartEditTicket = () => {
    if (!canEdit) return;
    setDraftSubject(ticket.subject);
    setDraftDescription(ticket.description);
    setSelectedStatusId(ticket.statusId);
    setSelectedPriorityId(ticket.priorityId);
    setSelectedReleaseVersionId(ticket.release_version_id || '');
    
    // Ensure selected app area is correct
    const byId = appAreas.find(area => area.id === ticket.app_area_id);
    const byCode = appAreas.find(area => area.code === ticket.app);
    const area = byId || byCode || null;
    setSelectedAppAreaId(area ? area.id : '');

    setIsEditingTicket(true);
  };

  const handleCancelEditTicket = () => {
    setIsEditingTicket(false);
    setDraftSubject(ticket.subject);
    setDraftDescription(ticket.description);
    setSelectedStatusId(ticket.statusId);
    setSelectedPriorityId(ticket.priorityId);
    setSelectedReleaseVersionId(ticket.release_version_id || '');
  };

  const handleSaveTicketEdits = async () => {
    const trimmedSubject = draftSubject.trim();
    const trimmedDescription = draftDescription.trim();
    if (!trimmedSubject || !trimmedDescription || isSavingTicket) return;

    setIsSavingTicket(true);
    try {
        // Find selected app area code if changed
        let appCode = ticket.app;
        if (selectedAppAreaId) {
            const area = appAreas.find(a => a.id === selectedAppAreaId);
            if (area) {
                appCode = area.code as any;
            }
        }

        const updated = await updateTicket(ticket.id, {
          subject: trimmedSubject,
          description: trimmedDescription,
          statusId: selectedStatusId,
          priorityId: selectedPriorityId,
          app: appCode,
          release_version_id: selectedReleaseVersionId || null,
        } as any);

        onUpdateTicket(updated);
        setIsEditingTicket(false);
    } catch (err) {
        console.error('Error updating ticket:', err);
    } finally {
        setIsSavingTicket(false);
    }
  };

  const ChatTranscriptCard = () => (
    <div className="chat-transcript-card">
      <div className="chat-transcript-header">
        <h3>Chat transcript (from bot)</h3>
        <p>Captured from JOBZ CAFE chatbot before this ticket was created.</p>
      </div>
      <div className="chat-transcript-body">
        {ticket.chatTranscript?.map((msg, index) => (
          <div key={index} className="chat-message">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-boh-surface-light dark:bg-boh-surface flex items-center justify-center text-sm font-bold text-boh-text-sub-light dark:text-boh-text-sub">
              {msg.role.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-baseline">
                <div>
                  <span className="text-sm font-semibold text-boh-text-light dark:text-boh-text">{msg.role}</span>
                  <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-boh-surface-light dark:bg-boh-surface text-boh-text-sub-light dark:text-boh-text-sub">
                    {msg.role === 'user' ? 'User' : 'Bot'}
                  </span>
                </div>
                <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{msg.timestamp}</p>
              </div>
              <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={isDrawerVariant ? 'min-h-0' : undefined}>
      {!isDrawerVariant && (
      <div className="border-b border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border">
        <div className="px-4 py-4 sm:px-6 lg:px-8">
          <div className="mb-4">
            <button
              onClick={onBack}
              className="inline-flex items-center text-sm font-medium text-boh-text-sub-light transition-colors hover:text-boh-primary dark:text-boh-text-sub dark:hover:text-boh-primary-tint"
            >
              <ArrowLeftIcon className="w-5 h-5 mr-2" />
              Back to tickets
            </button>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">Ticket record</p>
              <h1 className="mt-1 font-mono text-xl font-semibold text-boh-text-light dark:text-boh-text">{ticket.ticketNumber || 'Ticket'}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AppBadge app={ticket.app} />
              <StatusBadge statusLabel={ticket.statusLabel} statusKey={ticket.statusKey} />
              <PriorityBadge priorityLabel={ticket.priorityLabel} priorityKey={ticket.priorityKey} priorityWeight={ticket.priorityWeight} />
              <SeverityBadge severity={ticket.severity} />
            </div>
          </div>
        </div>
      </div>
      )}

      <div className={`border-b border-boh-border-light px-4 dark:border-boh-border ${isDrawerVariant ? 'sm:px-5' : 'bg-boh-bg-light/40 dark:bg-boh-bg/40 sm:px-6 lg:px-8'}`}>
        <div className="flex gap-6 overflow-x-auto boh-hide-scrollbar">
          {[
            { key: 'details', label: 'Details' },
            { key: 'requester', label: 'Requester' },
            { key: 'activity', label: 'Activity' },
            { key: 'history', label: 'History' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as 'details' | 'requester' | 'activity' | 'history')}
              className={`h-11 border-b-2 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'border-boh-primary text-boh-primary dark:text-boh-primary-tint'
                  : 'border-transparent text-boh-text-sub-light hover:text-boh-text-light dark:text-boh-text-sub dark:hover:text-boh-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={isDrawerVariant ? 'p-4 sm:p-5' : 'p-4 sm:p-5 lg:p-6'}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className={`${activeTab === 'details' ? 'hidden' : 'lg:col-span-3 space-y-4'}`}>
            {activeTab === 'history' && (
              ticket.source === 'chatbot' && ticket.chatTranscript && ticket.chatTranscript.length > 0
                ? <ChatTranscriptCard />
                : (
                  <div className="rounded-md border border-boh-border-light p-4 text-sm text-boh-text-sub-light dark:border-boh-border dark:text-boh-text-sub">
                    No chatbot transcript is attached to this ticket.
                  </div>
                )
            )}

            {activeTab === 'activity' && <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(24rem,1.1fr)]">
              <section className={detailSectionClass}>
                <div className="mb-4 flex flex-col gap-3 border-b border-boh-border-light pb-4 dark:border-boh-border">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Compose</h2>
                    {canUpdateStatus &&
                      (isTicketClosed ? (
                        <button
                          type="button"
                          onClick={() => void handleReopenTicket()}
                          className="inline-flex w-full items-center justify-center rounded-md bg-boh-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-boh-primary/90 focus:outline-none focus:ring-2 focus:ring-boh-primary/30 sm:w-auto"
                        >
                          Reopen ticket
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCloseModalOpen(true);
                            setCloseComment('');
                            setShouldNotifyOnClose(false);
                          }}
                          className="inline-flex w-full items-center justify-center rounded-md bg-boh-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-boh-primary/90 focus:outline-none focus:ring-2 focus:ring-boh-primary/30 sm:w-auto"
                        >
                          Close ticket
                        </button>
                      ))}
                  </div>
                  <div className="flex w-full rounded-lg border border-boh-border-light bg-boh-bg-light/50 p-1 dark:border-boh-border dark:bg-boh-surface">
                    <button
                      type="button"
                      onClick={() => {
                        setComposerType('reply');
                        setIsComposerVisible(true);
                      }}
                      className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                        composerType === 'reply'
                          ? 'bg-boh-primary text-white shadow-sm'
                          : 'text-boh-text-sub-light hover:text-boh-text-light dark:text-boh-text-sub dark:hover:text-boh-text'
                      }`}
                    >
                      Reply to user
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setComposerType('internal');
                        setIsComposerVisible(true);
                      }}
                      disabled={isInternalNoteDisabled}
                      className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                        composerType === 'internal'
                          ? 'bg-boh-primary text-white shadow-sm'
                          : 'text-boh-text-sub-light hover:text-boh-text-light dark:text-boh-text-sub dark:hover:text-boh-text disabled:cursor-not-allowed disabled:opacity-45'
                      }`}
                    >
                      Internal note
                    </button>
                  </div>
                </div>

                {isComposerVisible && (
                <div className="activity-composer">
                  <textarea
                    ref={composerRef}
                    className="w-full rounded-lg border border-boh-border-light bg-boh-bg-light p-3 text-boh-text-light shadow-sm outline-none focus:border-boh-primary focus:ring-2 focus:ring-boh-primary/30 dark:border-boh-border dark:bg-boh-bg dark:text-boh-text sm:text-sm"
                    rows={7}
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    disabled={composerType === 'internal' && isInternalNoteDisabled}
                    placeholder={composerType === 'reply' ? 'Write a reply to the requester…' : 'Add an internal note (only visible to the team)…'}
                  ></textarea>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleAddActivity()}
                      className="inline-flex w-full sm:w-auto justify-center items-center rounded-md bg-boh-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-boh-primary/90 focus:outline-none focus:ring-2 focus:ring-boh-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!composerText.trim() || (composerType === 'internal' && isInternalNoteDisabled)}
                    >
                      {composerType === 'reply' ? 'Send reply' : 'Add note'}
                    </button>
                  </div>
                </div>
                )}
              </section>

              <section className={`min-h-0 ${detailSectionClass}`}>
                <div className="mb-3 flex items-center justify-between border-b border-boh-border-light pb-3 dark:border-boh-border">
                  <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Timeline</h2>
                  <span className="text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">{activities.length} item{activities.length === 1 ? '' : 's'}</span>
                </div>
              <div className="boh-hide-scrollbar max-h-[calc(100vh-21rem)] min-h-[18rem] space-y-4 overflow-y-auto pr-1">
                {activities.map((activity, index) => (
                  <div key={index} className="flex space-x-3 rounded-lg border border-boh-border-light bg-boh-bg-light/40 p-3 dark:border-boh-border dark:bg-boh-surface/40">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-boh-surface-light dark:bg-boh-surface flex items-center justify-center text-sm font-bold text-boh-text-sub-light dark:text-boh-text-sub">
                      {activity.author.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-baseline">
                        <div>
                          <span className="text-sm font-semibold text-boh-text-light dark:text-boh-text">{activity.author}</span>
                          <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-boh-surface-light dark:bg-boh-surface text-boh-text-sub-light dark:text-boh-text-sub">
                            {activity.type}
                          </span>
                        </div>
                        <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{activity.timestamp}</p>
                      </div>

                      {editingActivityId === activity.id ? (
                        <div className="mt-2">
                          <textarea
                            className="mb-2 w-full rounded-lg border border-boh-border-light bg-boh-bg-light px-3 py-2 text-sm text-boh-text-light outline-none focus:border-boh-primary focus:ring-2 focus:ring-boh-primary/30 dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                            rows={3}
                            value={editActivityText}
                            onChange={(e) => setEditActivityText(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveActivityEdit(activity.id!)}
                              className="px-3 py-1.5 text-xs font-medium rounded border border-transparent text-white bg-boh-primary hover:bg-boh-primary/90"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditActivity}
                              className="px-3 py-1.5 text-xs font-medium rounded border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text-sub bg-boh-surface-light dark:bg-boh-bg hover:bg-boh-bg-light dark:hover:bg-boh-bg"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="group relative">
                          <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub whitespace-pre-wrap">{activity.note}</p>
                          {/* Show edit button if current user is author */}
                          {currentBohUserId && activity.authorId === currentBohUserId && (
                            <button
                              onClick={() => handleStartEditActivity(activity)}
                              className="hidden group-hover:inline-flex absolute top-0 right-0 text-xs text-boh-text-sub hover:text-boh-primary"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              </section>
            </div>}
          </div>

          <div className={`${activeTab === 'details' ? 'lg:col-span-3 grid gap-4' : 'hidden'}`}>
            <div className={detailSectionClass}>
              <div className="mb-4 flex flex-col gap-3 border-b border-boh-border-light pb-3 dark:border-boh-border sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Ticket Overview</h2>
                  <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">Core routing, ownership, and release details.</p>
                </div>
                <div className="flex gap-2">
                  {canEdit && !isEditingTicket ? (
                    <button
                      type="button"
                      onClick={handleStartEditTicket}
                      className="h-10 rounded-md bg-boh-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-boh-primary/90"
                    >
                      Edit ticket
                    </button>
                  ) : canEdit ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveTicketEdits}
                        disabled={isSavingTicket}
                        className="h-10 rounded-md bg-boh-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-boh-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSavingTicket ? 'Saving...' : 'Save changes'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditTicket}
                        className="h-10 rounded-md border border-boh-border-light bg-boh-surface-light px-4 text-sm font-semibold text-boh-text-light transition-colors hover:bg-boh-bg-light dark:border-boh-border dark:bg-boh-bg dark:text-boh-text dark:hover:bg-boh-surface"
                      >
                        Cancel
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className={`md:col-span-3 ${detailSubsectionClass}`}>
                  <label className="block text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-2">Subject</label>
                  {canEdit && isEditingTicket ? (
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-lg border border-boh-border-light bg-boh-bg-light px-3 py-2 text-boh-text-light shadow-sm outline-none focus:border-boh-primary focus:ring-2 focus:ring-boh-primary/30 dark:border-boh-border dark:bg-boh-bg dark:text-boh-text sm:text-sm"
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                    />
                  ) : (
                    <p className="mt-1 text-base font-semibold text-boh-text-light dark:text-boh-text">{ticket.subject}</p>
                  )}
                </div>
                <div className={`md:col-span-3 ${detailSubsectionClass}`}>
                  <label className="block text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-2">Description</label>
                  {canEdit && isEditingTicket ? (
                    <textarea
                      className="mt-1 block w-full rounded-lg border border-boh-border-light bg-boh-bg-light px-3 py-2 text-boh-text-light shadow-sm outline-none focus:border-boh-primary focus:ring-2 focus:ring-boh-primary/30 dark:border-boh-border dark:bg-boh-bg dark:text-boh-text sm:text-sm"
                      rows={4}
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                    />
                  ) : (
                    <p className="mt-1 text-sm text-boh-text-light dark:text-boh-text whitespace-pre-wrap">{ticket.description}</p>
                  )}
                </div>
                <div className={detailSubsectionClass}>
                  <label className="block text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-2">Status</label>
                  {canEdit && isEditingTicket ? (
                    <div className="mt-1">
                      <BohSelect
                        value={selectedStatusId}
                        onChange={setSelectedStatusId}
                        options={statusSelectOptions}
                      />
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-boh-text-light dark:text-boh-text">{ticket.statusLabel}</p>
                  )}
                </div>
                <div className={detailSubsectionClass}>
                  <label className="block text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-2">Priority</label>
                  {canEdit && isEditingTicket ? (
                    <div className="mt-1">
                      <BohSelect
                        value={selectedPriorityId}
                        onChange={setSelectedPriorityId}
                        options={prioritySelectOptions}
                      />
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-boh-text-light dark:text-boh-text">{ticket.priorityLabel}</p>
                  )}
                </div>
                <div className={detailSubsectionClass}>
                  <label className="block text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub">Assigned to</label>
                  {canEdit && isEditingTicket ? (
                    <div className="mt-1">
                      <BohSelect
                        value={ticket.assignee || 'Unassigned'}
                        onChange={(value) => void handleAssigneeChange(value)}
                        options={assigneeSelectOptions}
                      />
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-boh-text-light dark:text-boh-text">{ticket.assignee}</p>
                  )}
                </div>
                <div className={`order-3 md:col-span-3 ${detailSubsectionClass}`}>
                  <label className="block text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-2">Release Version</label>
                  {canEdit && isEditingTicket ? (
                    <div className="rounded-2xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-4 shadow-sm dark:shadow-[0_25px_45px_rgba(2,6,23,0.55)]">
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-boh-primary dark:text-boh-primary-tint">
                        <span>Minor release roadmap</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-boh-primary/10 dark:bg-boh-surface/70 px-2 py-0.5 text-[10px] font-semibold text-boh-primary shadow-sm dark:text-boh-primary-tint">
                          <span className="text-[11px]">●</span> Minor only
                        </span>
                      </div>
                      <div className="hidden">
                        <select
                          value={selectedReleaseVersionId}
                          onChange={(e) => setSelectedReleaseVersionId(e.target.value)}
                          className="boh-select"
                        >
                          <option value="">None</option>
                          {minorReleaseVersions.map((version) => {
                            const year = typeof (version as any).release_year === 'number' ? String((version as any).release_year) : '';
                            const cycle = typeof (version as any).release_cycle === 'string' ? (version as any).release_cycle : '';
                            const vn = typeof version.version_number === 'string' && version.version_number.trim() ? `v${version.version_number.trim().replace(/^v\s*/i, '')}` : '';
                            const prefixParts = [year, cycle, vn].filter(Boolean);
                            const prefix = prefixParts.length ? `${prefixParts.join(' · ')} · ` : '';
                            return (
                              <option key={version.id} value={version.id}>
                                {`${prefix}${version.version_label}`}
                              </option>
                            );
                          })}
                        </select>
                        <SelectChevron />
                      </div>
                      <BohSelect
                        className="mt-3"
                        value={selectedReleaseVersionId}
                        onChange={setSelectedReleaseVersionId}
                        options={minorReleaseSelectOptions}
                      />
                      <p className="mt-3 text-xs text-boh-primary dark:text-boh-primary-tint">
                        Sorted chronologically so the next release is always at the top.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-boh-text-light dark:text-boh-text">
                      {releaseVersionDisplay}
                      {ticket.release_version_id && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-boh-primary/10 px-2 py-0.5 text-xs font-medium text-boh-primary dark:bg-boh-surface dark:text-boh-primary-tint">
                          Release
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className={`order-1 ${detailSubsectionClass}`}>
                  <label className="block text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub">Severity (user-reported)</label>
                  <p className="mt-1 text-sm text-boh-text-light dark:text-boh-text">{severityLabel}</p>
                </div>
                <div className={`order-2 ${detailSubsectionClass}`}>
                  <label className="block text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-2">App Area</label>
                  {isLoadingAreas ? (
                    <p className="mt-1 text-sm text-boh-text-light dark:text-boh-text">Loading...</p>
                  ) : canEdit && isEditingTicket ? (
                    <div className="mt-1">
                      <BohSelect
                        value={selectedAppAreaId}
                        onChange={(value) => void handleAppAreaChange(value)}
                        options={appAreaSelectOptions}
                      />
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-boh-text-light dark:text-boh-text">{appDisplayString}</p>
                  )}
                </div>
                <div className={`order-4 ${detailSubsectionClass}`}>
                  <label className="block text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub">Created</label>
                  <p className="mt-1 text-sm text-boh-text-light dark:text-boh-text" title={ticket.createdAt.toLocaleString()}>{formatTimeAgo(ticket.createdAt)}</p>
                </div>
                <div className={`order-5 ${detailSubsectionClass}`}>
                  <label className="block text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub">Last Updated</label>
                  <p className="mt-1 text-sm text-boh-text-light dark:text-boh-text" title={ticket.lastUpdatedAt.toLocaleString()}>{formatTimeAgo(ticket.lastUpdatedAt)}</p>
                </div>
                <div className="hidden">
                  {canEdit && !isEditingTicket ? (
                    <button
                      type="button"
                      onClick={handleStartEditTicket}
                      className="px-3 py-1.5 text-sm font-medium rounded-md border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text-sub bg-boh-surface-light dark:bg-boh-bg hover:bg-boh-bg-light dark:hover:bg-boh-bg"
                    >
                      Edit ticket
                    </button>
                  ) : canEdit ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveTicketEdits}
                        className="px-3 py-1.5 text-sm font-medium rounded-md border border-transparent text-white bg-boh-primary hover:bg-boh-primary/90"
                      >
                        Save changes
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditTicket}
                        className="px-3 py-1.5 text-sm font-medium rounded-md border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text-sub bg-boh-surface-light dark:bg-boh-bg hover:bg-boh-bg-light dark:hover:bg-boh-bg"
                      >
                        Cancel
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

          </div>

          <div className={`${activeTab === 'requester' ? 'lg:col-span-3' : 'hidden'}`}>
            <div className="requester-card">
              <h3>Requester</h3>
              <div className="requester-body">
                <div className="requester-info">
                  <div className="requester-name">{ticket.requesterName}</div>
                  <div className="requester-email">{ticket.requesterEmail}</div>
                </div>
                <div className="requester-actions">
                  <button type="button" onClick={handleCopyEmail} className="link-button">Copy</button>
                  <a href={`mailto:${ticket.requesterEmail}`} className="link-button">Email</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isCloseModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-boh-surface-light dark:bg-boh-bg rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-2">Close ticket</h3>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-4">
              Add a brief note about how this ticket was resolved. This note can be internal only or emailed to the requester.
            </p>
            <textarea
              className="mb-4 w-full rounded-lg border border-boh-border-light bg-boh-bg-light px-3 py-2 text-sm text-boh-text-light outline-none focus:border-boh-primary focus:ring-2 focus:ring-boh-primary/30 dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
              rows={4}
              value={closeComment}
              onChange={(e) => setCloseComment(e.target.value)}
              placeholder="Describe how this ticket was resolved…"
            />
            <label className="flex items-center gap-2 mb-4 text-sm text-boh-text-light dark:text-boh-text-sub">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-boh-border-light dark:border-boh-border text-boh-primary focus:ring-boh-primary"
                checked={shouldNotifyOnClose}
                onChange={(e) => setShouldNotifyOnClose(e.target.checked)}
              />
              <span>Also email this closing note to the requester</span>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setIsCloseModalOpen(false); setCloseComment(''); setShouldNotifyOnClose(false); }}
                className="px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-md shadow-sm text-sm font-medium text-boh-text-light dark:text-boh-text bg-boh-surface-light dark:bg-boh-surface hover:bg-boh-bg-light dark:hover:bg-boh-bg focus:outline-none focus:ring-2 focus:ring-boh-primary/30"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCloseTicketWithComment()}
                disabled={!closeComment.trim() || !canUpdateStatus}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-boh-primary hover:bg-boh-primary/90 focus:outline-none focus:ring-2 focus:ring-boh-primary/30 disabled:opacity-50"
              >
                Close ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketDetailPage;
