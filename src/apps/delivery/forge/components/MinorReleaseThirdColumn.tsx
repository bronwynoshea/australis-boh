import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ReleaseVersionUsageRow, TicketRow } from './types';

interface MinorReleaseThirdColumnProps {
  selectedRelease: ReleaseVersionUsageRow | null;
  tickets: TicketRow[];
  isLoadingTickets: boolean;
  isTicketReleaseReady: (ticket: TicketRow) => boolean;
}

export const MinorReleaseThirdColumn: React.FC<MinorReleaseThirdColumnProps> = ({
  selectedRelease,
  tickets,
  isLoadingTickets,
  isTicketReleaseReady,
}) => {
  const sortedTickets = useMemo(() => [...tickets].sort((a, b) => {
    const aWeight = Number.isFinite(a.priority?.weight as number)
      ? (a.priority?.weight as number)
      : Number.MAX_SAFE_INTEGER;
    const bWeight = Number.isFinite(b.priority?.weight as number)
      ? (b.priority?.weight as number)
      : Number.MAX_SAFE_INTEGER;
    return aWeight - bWeight;
  }), [tickets]);

  const completedTickets = sortedTickets.filter(isTicketReleaseReady);
  const openTickets = sortedTickets.filter((ticket) => !isTicketReleaseReady(ticket));

  if (!selectedRelease) {
    return (
      <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl h-full flex items-center justify-center">
        <div className="text-center text-boh-text-sub-light dark:text-boh-text-sub">
          <p className="text-sm">Select a minor release to view tickets</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-boh-border-light dark:border-boh-border flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
                Assigned Tickets ({tickets.length})
              </h3>
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">
                Counter tickets assigned to this minor release
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-right">
              <div>
                <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">Completed</div>
                <div className="text-sm font-semibold text-boh-text-light dark:text-boh-text">{completedTickets.length}</div>
              </div>
              <div>
                <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">Open</div>
                <div className="text-sm font-semibold text-boh-text-light dark:text-boh-text">{openTickets.length}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 overflow-y-auto flex-1 scrollbar-hide">
          {isLoadingTickets ? (
            <div className="text-center py-8">
              <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading tickets...</div>
            </div>
          ) : tickets.length > 0 ? (
            <div className="space-y-3">
              {sortedTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="border border-boh-border-light dark:border-boh-border rounded-lg p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-boh-text-light dark:text-boh-text">
                          #{ticket.ticket_number || ticket.id.slice(0, 8).toUpperCase()}
                        </span>
                        {ticket.status && (
                          <span className="inline-flex min-w-[72px] items-center justify-center whitespace-nowrap rounded-full px-2 pt-0.5 pb-1.5 text-xs font-medium bg-boh-surface-light dark:bg-boh-surface dark:text-boh-text">
                            {ticket.status.label || ticket.status.key}
                          </span>
                        )}
                        {ticket.priority && (
                          <span
                            className={`inline-flex items-center whitespace-nowrap rounded px-2 py-1 text-xs font-medium ${
                              ticket.priority.weight <= 2
                                ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200'
                                : ticket.priority.weight <= 4
                                  ? 'bg-violet-100 text-violet-800 dark:bg-violet-800 dark:text-violet-100'
                                  : 'bg-boh-surface-light dark:bg-boh-surface dark:text-boh-text'
                            }`}
                          >
                            {ticket.priority.label}
                          </span>
                        )}
                        {isTicketReleaseReady(ticket) && (
                          <span className="inline-flex items-center whitespace-nowrap rounded-full px-2 pt-0.5 pb-1.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200">
                            Completed
                          </span>
                        )}
                      </div>
                      <Link
                        to={`/counter/tickets/${ticket.id}`}
                        className="block text-sm text-boh-text-light dark:text-boh-text hover:text-boh-primary mb-1"
                      >
                        {ticket.subject || 'No subject'}
                      </Link>
                      {ticket.requester_name && (
                        <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                          From: {ticket.requester_name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-boh-text-sub-light dark:text-boh-text-sub">
                No tickets assigned to this release
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
