import React, { useState, useMemo, useEffect } from 'react';
import type { Ticket, Agent, AppKey, CounterTicketStatus, CounterTicketPriority } from '../types';

import { APP_OPTIONS, CAREER_MODULE_LABELS } from '../constants';
import { SearchIcon } from '../components/Icons';

import { StatusBadge, PriorityBadge } from '../components/Badges';
import { fetchTicketsForView, fetchTicketLookups } from '../api/counterTicketsApi';
import { supabase } from '../../../../lib/supabase';

interface MyTicketsPageProps {
  agents: Agent[];
  onTicketSelect: (ticket: Ticket) => void;
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

const getAppDisplay = (ticket: Ticket): string => {
  const appLabel = APP_OPTIONS.find(a => a.key === ticket.app)?.label || ticket.app;
  if (ticket.app === 'career_studio' && ticket.careerModule && ticket.careerModule !== 'none') {
    const moduleLabel = CAREER_MODULE_LABELS[ticket.careerModule];
    return `${appLabel} (${moduleLabel})`;
  }
  return appLabel;
};

const getTicketUserDisplay = (user: Ticket['created_by_user'] | Ticket['assigned_to_user'] | null | undefined): string => {
  if (!user) return 'Unassigned';
  return user.full_name || user.email || 'Unassigned';
};

const isClosedLikeStatus = (ticket: Ticket): boolean => {
  const key = (ticket.statusKey || ticket.statusLabel || '').toLowerCase();
  return key.includes('closed') || key.includes('resolved') || key.includes('done');
};

const isWaitingOnUserStatus = (ticket: Ticket): boolean => {
  const key = (ticket.statusKey || ticket.statusLabel || '').toLowerCase();
  return key.includes('waiting') && key.includes('user');
};

const MyTicketsPage: React.FC<MyTicketsPageProps> = ({ onTicketSelect }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [allMyTickets, setAllMyTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bohUserId, setBohUserId] = useState<string | null>(null);
  const [statusOptions, setStatusOptions] = useState<CounterTicketStatus[]>([]);
  const [priorityOptions, setPriorityOptions] = useState<CounterTicketPriority[]>([]);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [appFilter, setAppFilter] = useState<AppKey | 'all'>('all');
  const [search, setSearch] = useState<string>('');
  const [showClosed, setShowClosed] = useState<boolean>(false);
  const trimmedSearch = search.trim();

  useEffect(() => {
    const loadUserAndTickets = async () => {
      try {
        // Get current auth user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setTickets([]);
          return;
        }

        // Resolve BOH user id for this auth user so we can match created_by / assigned_to
        const { data: bohUser, error: bohUserError } = await supabase
          .from('boh_user')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (bohUserError) {
          console.error('Error loading boh_user for My Tickets:', bohUserError);
          setTickets([]);
          return;
        }

        if (!bohUser?.id) {
          // No BOH user row; user will not have any Counter tickets yet.
          setTickets([]);
          return;
        }

        setBohUserId(bohUser.id);

        setIsLoading(true);
        const { tickets: myTickets } = await fetchTicketsForView('my', { bohUserId: bohUser.id });
        setAllMyTickets(myTickets);
        setTickets(myTickets);
      } catch (error) {
        console.error('Error loading my tickets:', error);
        setTickets([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadUserAndTickets();
  }, []);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const lookups = await fetchTicketLookups();
        setStatusOptions(lookups.statuses);
        setPriorityOptions(lookups.priorities);
      } catch (error) {
        console.error('Error loading ticket lookups:', error);
        setStatusOptions([]);
        setPriorityOptions([]);
      }
    };
    loadLookups();
  }, []);

  useEffect(() => {
    let mounted = true;
    const handle = window.setTimeout(async () => {
      if (!bohUserId) return;

      try {
        setIsLoading(true);

        const filters: {
          statuses?: string[];
          apps?: string[];
          priorities?: string[];
        } = {};

        if (statusFilter !== 'all') {
          filters.statuses = [statusFilter];
        }

        if (priorityFilter !== 'all') {
          filters.priorities = [priorityFilter];
        }

        if (appFilter !== 'all') {
          filters.apps = [appFilter];
        }

        const { tickets: next } = await fetchTicketsForView('my', {
          bohUserId,
          filters,
          search: trimmedSearch ? trimmedSearch : undefined,
        });

        if (mounted) {
          setTickets(next);
        }
      } catch (error) {
        console.error('Error loading filtered my tickets:', error);
        if (mounted) setTickets([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }, 250);

    return () => {
      mounted = false;
      window.clearTimeout(handle);
    };
  }, [bohUserId, statusFilter, priorityFilter, appFilter, trimmedSearch]);

  const handleTicketSelect = (ticket: Ticket) => {
    onTicketSelect(ticket);
  };

  const visibleTickets = useMemo(() => {
    const ordered = [...tickets].sort((a, b) => b.lastUpdatedAt.getTime() - a.lastUpdatedAt.getTime());
    if (showClosed) return ordered;
    return ordered.filter((t) => !isClosedLikeStatus(t));
  }, [tickets, showClosed]);

  const assignedToMeCount = useMemo(() => {
    if (!bohUserId) return 0;
    return allMyTickets.filter((t) => t.assignedToId === bohUserId).length;
  }, [allMyTickets, bohUserId]);

  const createdByMeCount = useMemo(() => {
    if (!bohUserId) return 0;
    return allMyTickets.filter((t) => t.createdById === bohUserId).length;
  }, [allMyTickets, bohUserId]);

  const waitingOnUserCount = useMemo(() => {
    return allMyTickets.filter((t) => !isClosedLikeStatus(t) && isWaitingOnUserStatus(t)).length;
  }, [allMyTickets]);

  if (isLoading) {
    return (
      <div>
        <div className="border-b border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <h1 className="text-3xl font-bold text-boh-text-light dark:text-boh-text">My Tickets</h1>
            <p className="mt-1 text-md text-boh-text-sub-light dark:text-boh-text-sub">Tickets created by you or assigned to you.</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading tickets...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-boh-text-light dark:text-boh-text">My Tickets</h1>
            <p className="mt-1 text-md text-boh-text-sub-light dark:text-boh-text-sub">Tickets created by you or assigned to you.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-boh-text-sub-light dark:text-boh-text-sub">Assigned to me</div>
              <div className="mt-1 text-2xl font-bold text-boh-text-light dark:text-boh-text">{assignedToMeCount}</div>
            </div>
            <div className="rounded-xl border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-boh-text-sub-light dark:text-boh-text-sub">Created by me</div>
              <div className="mt-1 text-2xl font-bold text-boh-text-light dark:text-boh-text">{createdByMeCount}</div>
            </div>
            <div className="rounded-xl border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-boh-text-sub-light dark:text-boh-text-sub">Waiting on user</div>
              <div className="mt-1 text-2xl font-bold text-boh-text-light dark:text-boh-text">{waitingOnUserCount}</div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-boh-text-sub" />
              </div>
              <input
                type="text"
                placeholder="Search ticket #, subject, requester email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border rounded-lg bg-boh-bg-light dark:bg-boh-bg dark:bg-boh-surface focus:ring-primary focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="boh-select-wrapper">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="boh-select"
                >
                  <option value="all">All statuses</option>
                  {statusOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                <div className="boh-select-chevron" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 8L10 13L15 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              <div className="boh-select-wrapper">
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="boh-select"
                >
                  <option value="all">All priorities</option>
                  {priorityOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <div className="boh-select-chevron" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 8L10 13L15 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              <div className="boh-select-wrapper">
                <select
                  value={appFilter}
                  onChange={(e) => setAppFilter(e.target.value as AppKey | 'all')}
                  className="boh-select"
                >
                  <option value="all">All apps</option>
                  {APP_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
                <div className="boh-select-chevron" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 8L10 13L15 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              <label className="flex items-center gap-2 px-3 h-11 border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border rounded-xl bg-boh-bg-light dark:bg-boh-bg dark:bg-boh-surface">
                <input
                  type="checkbox"
                  checked={showClosed}
                  onChange={(e) => setShowClosed(e.target.checked)}
                />
                <span className="text-sm text-boh-text-light dark:text-boh-text">Show closed</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {visibleTickets.length === 0 ? (
          <div className="rounded-xl border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-8 text-center space-y-2">
            {trimmedSearch ? (
              <>
                <div className="text-boh-text-light dark:text-boh-text font-semibold">No results for “{trimmedSearch}”.</div>
                <p className="text-boh-text-sub-light dark:text-boh-text-sub">Try adjusting your search or filters.</p>
              </>
            ) : allMyTickets.length === 0 ? (
              <div className="text-boh-text-light dark:text-boh-text font-semibold">No tickets assigned to you or created by you yet.</div>
            ) : (
              <>
                <div className="text-boh-text-light dark:text-boh-text font-semibold">No tickets match your current filters.</div>
                <p className="text-boh-text-sub-light dark:text-boh-text-sub">Clear filters or include closed tickets to see more.</p>
              </>
            )}
          </div>
        ) : null}

        <div className={`hidden lg:block bg-boh-surface-light dark:bg-boh-surface rounded-lg shadow overflow-hidden ${visibleTickets.length === 0 ? 'hidden' : ''}`}>
          <table className="min-w-full divide-y divide-boh-border-light dark:divide-boh-border dark:divide-boh-border-light dark:divide-boh-border table-fixed">
            <thead className="bg-boh-bg-light dark:bg-boh-bg">
              <tr>
                <th scope="col" className="w-[10%] px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">Ticket #</th>
                <th scope="col" className="w-[25%] px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">Subject</th>
                <th scope="col" className="w-[14%] px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">App / Area</th>
                <th scope="col" className="w-[12%] px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">Status</th>
                <th scope="col" className="w-[12%] px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">Priority</th>
                <th scope="col" className="w-[12%] px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">Created by</th>
                <th scope="col" className="w-[12%] px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">Assigned to</th>
                <th scope="col" className="w-[13%] px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">Updated</th>
                <th scope="col" className="w-[12%] px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub uppercase tracking-wider">Created by</th>
                <th scope="col" className="w-[12%] px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub uppercase tracking-wider">Assigned to</th>
                <th scope="col" className="w-[13%] px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub uppercase tracking-wider">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-boh-border-light dark:divide-boh-border">
              {visibleTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-boh-bg-light dark:hover:bg-boh-bg dark:hover:bg-boh-bg/50 cursor-pointer" onClick={() => handleTicketSelect(ticket)}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-boh-text-light dark:text-boh-text">{ticket.ticketNumber || ''}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-boh-text-light dark:text-boh-text truncate" title={ticket.subject}>{ticket.subject}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-boh-text-sub-light dark:text-boh-text-sub">{getAppDisplay(ticket)}</td>
                  <td className="px-6 py-4 whitespace-nowrap"><StatusBadge statusLabel={ticket.statusLabel} statusKey={ticket.statusKey} /></td>
                  <td className="px-6 py-4 text-sm">
                    <PriorityBadge priorityLabel={ticket.priorityLabel} priorityKey={ticket.priorityKey} priorityWeight={ticket.priorityWeight} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-boh-text-sub-light dark:text-boh-text-sub">{getTicketUserDisplay(ticket.created_by_user)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-boh-text-sub-light dark:text-boh-text-sub">{getTicketUserDisplay(ticket.assigned_to_user)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-boh-text-sub-light dark:text-boh-text-sub">{formatTimeAgo(ticket.lastUpdatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={`lg:hidden ${visibleTickets.length === 0 ? 'hidden' : ''}`}>
          <ul className="space-y-4">
            {visibleTickets.map((ticket) => (
              <li key={ticket.id} className="bg-boh-surface-light dark:bg-boh-surface rounded-2xl shadow py-4 px-5 cursor-pointer" onClick={() => handleTicketSelect(ticket)}>
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub">{ticket.ticketNumber || ''}</span>
                  </div>
                  <p className="text-md font-semibold text-boh-text-light dark:text-boh-text">{ticket.subject}</p>
                  <div className="flex items-center space-x-2 flex-wrap">
                    <StatusBadge statusLabel={ticket.statusLabel} statusKey={ticket.statusKey} />
                    <PriorityBadge priorityLabel={ticket.priorityLabel} priorityKey={ticket.priorityKey} priorityWeight={ticket.priorityWeight} />
                  </div>
                  <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                    <div>Created by: {getTicketUserDisplay(ticket.created_by_user)}</div>
                    <div>Assigned to: {getTicketUserDisplay(ticket.assigned_to_user)}</div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-boh-text-sub-light dark:text-boh-text-sub pt-2">
                    <span>{getAppDisplay(ticket)}</span>
                    <span>{formatTimeAgo(ticket.lastUpdatedAt)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MyTicketsPage;