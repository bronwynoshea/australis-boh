import React, { useEffect, useMemo, useState } from 'react';

import type { Ticket, Agent, CounterTicketPriority, CounterTicketStatus, ReleaseVersion } from '../types';
import { CounterTicketCard } from '../components/CounterTicketCard';
import { AppBadge, PriorityBadge, SeverityBadge, StatusBadge } from '../components/Badges';
import { assignTicket, fetchReleaseVersions, fetchTicketLookups, updateTicket } from '../api/counterTicketsApi';
import BohSlideOver from '../../../../components/boh/BohSlideOver';
import BohSelect from '../../../../components/boh/BohSelect';

interface CounterInboxPageProps {
  tickets: Ticket[];
  agents: Agent[];
  onUpdateTicket: (updatedTicket: Ticket) => void;
}

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const CrewStatsList: React.FC<{ tickets: Ticket[]; agents: Agent[] }> = ({ tickets, agents }) => {
  const crewStats = useMemo(() => {
    const activeAgents = agents.filter(agent => agent.canReceiveTickets);
    return activeAgents.map(agent => {
      const agentTickets = tickets.filter(ticket => ticket.assignee === agent.name);
      const open = agentTickets.filter(ticket => !((ticket.statusKey || ticket.statusLabel || '').toLowerCase().includes('closed'))).length;
      const waiting = agentTickets.filter(ticket => {
        const key = (ticket.statusKey || ticket.statusLabel || '').toLowerCase();
        return key.includes('waiting') && (key.includes('us') || key.includes('team')) && !key.includes('user');
      }).length;
      return { name: agent.name, open, waiting };
    });
  }, [tickets, agents]);

  return (
    <ul className="space-y-2">
      {crewStats.map(stat => (
        <li key={stat.name} className="rounded-md border border-boh-border-light px-3 py-2 dark:border-boh-border">
          <p className="text-sm font-medium text-boh-text-light dark:text-boh-text">{stat.name}</p>
          <p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
            {stat.open} open &middot; {stat.waiting} waiting on us
          </p>
        </li>
      ))}
    </ul>
  );
};

const CounterInboxPage: React.FC<CounterInboxPageProps> = ({ tickets, agents, onUpdateTicket }) => {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isCrewOpen, setIsCrewOpen] = useState(false);
  const [statusOptions, setStatusOptions] = useState<CounterTicketStatus[]>([]);
  const [priorityOptions, setPriorityOptions] = useState<CounterTicketPriority[]>([]);
  const [releaseOptions, setReleaseOptions] = useState<ReleaseVersion[]>([]);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftStatusId, setDraftStatusId] = useState('');
  const [draftPriorityId, setDraftPriorityId] = useState('');
  const [draftReleaseId, setDraftReleaseId] = useState('');
  const [draftAssigneeId, setDraftAssigneeId] = useState('');
  const [isSavingTicket, setIsSavingTicket] = useState(false);

  const safeTickets = Array.isArray(tickets) ? tickets : [];

  const inboxTickets = useMemo(() => {
    return safeTickets.filter((ticket) => {
      return (ticket.statusKey || ticket.statusLabel || '').toLowerCase() === 'new';
    }).sort((a, b) => {
      const aWeight = typeof a.priorityWeight === 'number' ? a.priorityWeight : 0;
      const bWeight = typeof b.priorityWeight === 'number' ? b.priorityWeight : 0;
      if (aWeight !== bWeight) return bWeight - aWeight;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }, [safeTickets]);

  const assignableAgents = useMemo(() => {
    return agents.filter(agent => agent.canReceiveTickets);
  }, [agents]);

  useEffect(() => {
    const loadDrawerLookups = async () => {
      try {
        const [lookups, releases] = await Promise.all([
          fetchTicketLookups(),
          fetchReleaseVersions(),
        ]);
        setStatusOptions(lookups.statuses);
        setPriorityOptions(lookups.priorities);
        setReleaseOptions(releases);
      } catch (error) {
        console.error('Error loading inbox ticket lookups:', error);
        setStatusOptions([]);
        setPriorityOptions([]);
        setReleaseOptions([]);
      }
    };

    loadDrawerLookups();
  }, []);

  useEffect(() => {
    if (!selectedTicket) return;
    setDraftSubject(selectedTicket.subject || '');
    setDraftDescription(selectedTicket.description || '');
    setDraftStatusId(selectedTicket.statusId || '');
    setDraftPriorityId(selectedTicket.priorityId || '');
    setDraftReleaseId(selectedTicket.release_version_id || '');
    setDraftAssigneeId(selectedTicket.assignedToId || '');
  }, [selectedTicket]);

  const crewSelectOptions = useMemo(() => [
    { value: '', label: 'Unassigned' },
    ...assignableAgents.map(agent => ({ value: agent.bohUserId || agent.id, label: agent.name })),
  ], [assignableAgents]);

  const releaseSelectOptions = useMemo(() => [
    { value: '', label: 'No release' },
    ...releaseOptions.map((release) => {
      const year = typeof release.release_year === 'number' ? String(release.release_year) : '';
      const cycle = release.release_cycle || '';
      const version = release.version_number ? `v${release.version_number.replace(/^v\s*/i, '')}` : '';
      const label = [year, cycle, version, release.version_label].filter(Boolean).join(' - ');
      return { value: release.id, label };
    }),
  ], [releaseOptions]);

  const handleSaveSelectedTicket = async () => {
    if (!selectedTicket) return;
    setIsSavingTicket(true);
    try {
      let savedTicket = await updateTicket(selectedTicket.id, {
        subject: draftSubject.trim() || selectedTicket.subject,
        description: draftDescription,
        statusId: draftStatusId,
        priorityId: draftPriorityId,
        release_version_id: draftReleaseId || null,
      } as Partial<Ticket>);

      if ((draftAssigneeId || '') !== (selectedTicket.assignedToId || '')) {
        savedTicket = await assignTicket(selectedTicket.id, draftAssigneeId || null);
      }

      onUpdateTicket(savedTicket);
      setSelectedTicket(savedTicket);
    } catch (error) {
      console.error('Error saving ticket:', error);
    } finally {
      setIsSavingTicket(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-boh-border-light px-4 py-4 dark:border-boh-border sm:px-6 lg:px-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-boh-text-light dark:text-boh-text">Inbox</h1>
          <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">Triage and assign new tickets.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsCrewOpen(true)}
          className="h-10 shrink-0 rounded-md border border-boh-border-light px-4 text-sm font-medium text-boh-text-light transition-colors hover:bg-boh-bg-light/60 dark:border-boh-border dark:text-boh-text dark:hover:bg-boh-bg/60"
        >
          Crew
        </button>
      </div>

      <div className="min-h-0 flex-1 p-4 sm:p-6 lg:px-8">
        <div className="min-h-0">
          <div className="hidden overflow-x-auto rounded-lg border border-boh-border-light bg-boh-surface-light shadow-sm dark:border-boh-border dark:bg-boh-surface lg:block">
            <table className="w-full min-w-[900px] divide-y divide-boh-border-light dark:divide-boh-border">
              <thead className="bg-boh-bg-light/50 dark:bg-boh-bg/50">
                <tr>
                  <th scope="col" className="min-w-[90px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-boh-text-sub-light dark:text-boh-text-sub">Ticket #</th>
                  <th scope="col" className="min-w-[260px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-boh-text-sub-light dark:text-boh-text-sub">Subject</th>
                  <th scope="col" className="min-w-[90px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-boh-text-sub-light dark:text-boh-text-sub">App</th>
                  <th scope="col" className="min-w-[120px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-boh-text-sub-light dark:text-boh-text-sub">Priority</th>
                  <th scope="col" className="min-w-[110px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-boh-text-sub-light dark:text-boh-text-sub">Created</th>
                  <th scope="col" className="min-w-[140px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-boh-text-sub-light dark:text-boh-text-sub">Assign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-boh-border-light bg-boh-surface-light dark:divide-boh-border dark:bg-boh-surface">
                {inboxTickets.map(ticket => (
                  <tr
                    key={ticket.id}
                    className="group cursor-pointer transition-colors hover:bg-boh-bg-light/50 dark:hover:bg-boh-bg/50"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <td className="whitespace-nowrap px-4 py-4 font-mono text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                      {ticket.ticketNumber || ''}
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-boh-text-light dark:text-boh-text" title={ticket.subject}>
                      <div className="line-clamp-2 font-semibold leading-snug">{ticket.subject}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <AppBadge app={ticket.app} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <PriorityBadge priorityLabel={ticket.priorityLabel} priorityKey={ticket.priorityKey} priorityWeight={ticket.priorityWeight} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                      {formatTimeAgo(ticket.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(ticket)}
                        className="rounded-md border border-boh-border-light px-3 py-1 text-sm text-boh-text-light transition-colors hover:bg-boh-bg-light/50 dark:border-boh-border dark:text-boh-text dark:hover:bg-boh-bg/50"
                      >
                        {ticket.assignee}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-4 lg:hidden">
            {inboxTickets.map(ticket => (
              <CounterTicketCard
                key={ticket.id}
                ticket={ticket}
                onAssignClick={setSelectedTicket}
                onTicketClick={setSelectedTicket}
                showAssignButton={true}
              />
            ))}
          </ul>
        </div>
      </div>

      <BohSlideOver
        isOpen={isCrewOpen}
        title="Crew"
        description="Current open and waiting workload by assignable crew member."
        onClose={() => setIsCrewOpen(false)}
        closeLabel="Close crew"
      >
        <CrewStatsList tickets={safeTickets} agents={agents} />
      </BohSlideOver>

      <BohSlideOver
        isOpen={Boolean(selectedTicket)}
        title={selectedTicket?.ticketNumber || 'Ticket'}
        description={selectedTicket?.subject}
        onClose={() => setSelectedTicket(null)}
        closeLabel="Close ticket"
        footer={selectedTicket && (
          <div className="flex w-full justify-end gap-2">
            <button
              type="button"
              onClick={() => setSelectedTicket(null)}
              className="h-10 rounded-md border border-boh-border-light px-4 text-sm font-semibold text-boh-text-light transition-colors hover:bg-boh-bg-light/60 dark:border-boh-border dark:text-boh-text dark:hover:bg-boh-bg/60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSaveSelectedTicket()}
              disabled={isSavingTicket}
              className="h-10 rounded-md bg-boh-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-boh-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingTicket ? 'Saving...' : 'Save Ticket'}
            </button>
          </div>
        )}
      >
        {selectedTicket && (
          <div className="space-y-5">
            <section className="rounded-md border border-boh-border-light p-3 dark:border-boh-border">
              <div className="mb-3 flex flex-wrap gap-2">
                <AppBadge app={selectedTicket.app} />
                <PriorityBadge priorityLabel={selectedTicket.priorityLabel} priorityKey={selectedTicket.priorityKey} priorityWeight={selectedTicket.priorityWeight} />
                <SeverityBadge severity={selectedTicket.severity} />
                <StatusBadge statusLabel={selectedTicket.statusLabel} statusKey={selectedTicket.statusKey} />
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase text-boh-text-sub-light dark:text-boh-text-sub">Requester</dt>
                  <dd className="mt-1 text-boh-text-light dark:text-boh-text">{selectedTicket.requesterName || 'Unknown'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-boh-text-sub-light dark:text-boh-text-sub">Assigned</dt>
                  <dd className="mt-1 text-boh-text-light dark:text-boh-text">{selectedTicket.assignee}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-boh-text-sub-light dark:text-boh-text-sub">Created</dt>
                  <dd className="mt-1 text-boh-text-light dark:text-boh-text">{formatTimeAgo(selectedTicket.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-boh-text-sub-light dark:text-boh-text-sub">Updated</dt>
                  <dd className="mt-1 text-boh-text-light dark:text-boh-text">{formatTimeAgo(selectedTicket.lastUpdatedAt)}</dd>
                </div>
              </dl>
            </section>

            <section className="space-y-4 rounded-md border border-boh-border-light p-3 dark:border-boh-border">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-boh-text-sub-light dark:text-boh-text-sub">Subject</label>
                <input
                  type="text"
                  value={draftSubject}
                  onChange={(event) => setDraftSubject(event.target.value)}
                  className="h-11 w-full rounded-xl border border-boh-border-light bg-boh-surface-light px-3 text-sm text-boh-text-light focus:border-boh-primary focus:outline-none focus:ring-2 focus:ring-boh-primary/30 dark:border-boh-border dark:bg-boh-surface dark:text-boh-text"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-boh-text-sub-light dark:text-boh-text-sub">Description</label>
                <textarea
                  value={draftDescription}
                  onChange={(event) => setDraftDescription(event.target.value)}
                  rows={5}
                  className="w-full resize-none rounded-xl border border-boh-border-light bg-boh-surface-light px-3 py-2 text-sm leading-6 text-boh-text-light focus:border-boh-primary focus:outline-none focus:ring-2 focus:ring-boh-primary/30 dark:border-boh-border dark:bg-boh-surface dark:text-boh-text"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <BohSelect
                  label="Status"
                  value={draftStatusId}
                  onChange={setDraftStatusId}
                  options={statusOptions.map(status => ({ value: status.id, label: status.label }))}
                  placeholder="Select status"
                />
                <BohSelect
                  label="Priority"
                  value={draftPriorityId}
                  onChange={setDraftPriorityId}
                  options={priorityOptions.map(priority => ({ value: priority.id, label: priority.label }))}
                  placeholder="Select priority"
                />
                <BohSelect
                  label="Crew"
                  value={draftAssigneeId}
                  onChange={setDraftAssigneeId}
                  options={crewSelectOptions}
                  placeholder="Select crew"
                />
                <BohSelect
                  label="Release"
                  value={draftReleaseId}
                  onChange={setDraftReleaseId}
                  options={releaseSelectOptions}
                  placeholder="Select release"
                />
              </div>
            </section>

            {selectedTicket.chatTranscript && selectedTicket.chatTranscript.length > 0 && (
              <section className="rounded-md border border-boh-border-light p-3 dark:border-boh-border">
                <h3 className="mb-2 text-xs font-semibold uppercase text-boh-text-sub-light dark:text-boh-text-sub">Transcript</h3>
                <div className="space-y-2">
                  {selectedTicket.chatTranscript.slice(0, 4).map((message, index) => (
                    <div key={`${message.timestamp}-${index}`} className="rounded-md bg-boh-bg-light/60 p-2 text-sm dark:bg-boh-bg/60">
                      <p className="mb-1 text-xs font-semibold uppercase text-boh-text-sub-light dark:text-boh-text-sub">{message.role}</p>
                      <p className="text-boh-text-light dark:text-boh-text">{message.content}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </BohSlideOver>

    </div>
  );
};

export default CounterInboxPage;
