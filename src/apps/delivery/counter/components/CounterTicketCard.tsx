import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Ticket } from '../types';
import { StatusBadge, SeverityBadge, AppBadge } from './Badges';

interface CounterTicketCardProps {
  ticket: Ticket;
  onAssignClick?: (ticket: Ticket) => void;
  onTicketClick?: (ticket: Ticket) => void;
  showAssignButton?: boolean;
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
  const { APP_OPTIONS } = require('../constants');
  const appLabel = APP_OPTIONS.find((a: any) => a.key === ticket.app)?.label || ticket.app;
  return appLabel;
};

export const CounterTicketCard: React.FC<CounterTicketCardProps> = ({ 
  ticket, 
  onAssignClick,
  onTicketClick,
  showAssignButton = false 
}) => {
  const navigate = useNavigate();
  
  const handleTicketClick = () => {
    if (onTicketClick) {
      onTicketClick(ticket);
      return;
    }
    navigate(`tickets/${ticket.id}`);
  };

  return (
    <li className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl shadow-sm p-5">
      <div className="flex flex-col space-y-3">
        <div onClick={handleTicketClick} className="cursor-pointer">
          <p className="font-semibold text-boh-text-light dark:text-boh-text truncate">{ticket.subject}</p>
          <div className="flex items-center gap-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">
            <span className="font-mono">{ticket.ticketNumber || ticket.id}</span>
            <span>&bull;</span>
            <AppBadge app={ticket.app} />
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={ticket.severity} />
            <StatusBadge statusLabel={ticket.statusLabel} statusKey={ticket.statusKey} />
          </div>
        </div>
        {(showAssignButton && onAssignClick) && (
          <div className="pt-3 border-t border-boh-border-light dark:border-boh-border">
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-2">
              Assigned to: {ticket.assignee}
            </p>
            <button
              onClick={() => onAssignClick(ticket)}
              className="w-full text-center px-4 py-2 text-sm font-medium text-white bg-boh-primary border border-transparent rounded-md shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-boh-primary focus:ring-offset-2"
            >
              Assign
            </button>
          </div>
        )}
        {!showAssignButton && (
          <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
            <span>{formatTimeAgo(ticket.lastUpdatedAt)}</span>
          </div>
        )}
      </div>
    </li>
  );
};



