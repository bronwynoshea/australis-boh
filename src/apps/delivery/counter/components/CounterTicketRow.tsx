import React from 'react';
import type { Ticket } from '../types';
import { StatusBadge, SeverityBadge, PriorityBadge, AppBadge } from './Badges';

interface CounterTicketRowProps {
  ticket: Ticket;
  onTicketClick: (ticket: Ticket) => void;
  onAssignClick?: (ticket: Ticket, agentName: string) => void;
  assignableAgents?: Array<{ id: string; name: string }>;
  showAssignButton?: boolean;
  metricView?: 'severity' | 'priority';
}

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const getAppDisplay = (ticket: Ticket): string => {
  const { APP_OPTIONS, CAREER_MODULE_LABELS } = require('../constants');
  const appLabel = APP_OPTIONS.find((a: any) => a.key === ticket.app)?.label || ticket.app;
  if (ticket.app === 'career_studio' && ticket.careerModule && ticket.careerModule !== 'none') {
    const moduleLabel = CAREER_MODULE_LABELS[ticket.careerModule];
    return `${appLabel} (${moduleLabel})`;
  }
  return appLabel;
};

export const CounterTicketRow: React.FC<CounterTicketRowProps> = ({ 
  ticket, 
  onTicketClick,
  onAssignClick,
  assignableAgents = [],
  showAssignButton = false,
  metricView = 'severity'
}) => {
  return (
    <tr 
      key={ticket.id} 
      className="group hover:bg-boh-bg-light/50 dark:hover:bg-boh-bg/50 cursor-pointer transition-colors"
      onClick={() => onTicketClick(ticket)}
    >
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-boh-text-light dark:text-boh-text truncate" title={ticket.subject}>
        <div>{ticket.subject}</div>
        <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{ticket.id}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <AppBadge app={ticket.app} />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {metricView === 'severity' ? (
          <SeverityBadge severity={ticket.severity} />
        ) : (
          <PriorityBadge priorityLabel={ticket.priorityLabel} priorityKey={ticket.priorityKey} priorityWeight={ticket.priorityWeight} />
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-boh-text-sub-light dark:text-boh-text-sub">
        {formatTimeAgo(ticket.createdAt)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        {showAssignButton && onAssignClick && assignableAgents.length > 0 ? (
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1 border border-boh-border-light dark:border-boh-border rounded-md text-sm text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light/50 dark:hover:bg-boh-bg/50 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                // For now, just trigger the first agent or show a dropdown
                // This will be replaced with proper dropdown/sheet
              }}
            >
              {ticket.assignee}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        ) : (
          <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">{ticket.assignee}</span>
        )}
      </td>
    </tr>
  );
};



