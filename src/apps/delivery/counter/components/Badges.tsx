import React from 'react';
import { AppKey, TicketSeverity, InternalPriority } from '../types';
import { SEVERITY_OPTIONS, APP_OPTIONS } from '../constants';

interface StatusBadgeProps {
  statusLabel: string;
  statusKey?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ statusLabel, statusKey }) => {
  const key = (statusKey || statusLabel || '').toLowerCase();

  let className = 'badge--status-open';
  if (key.includes('closed')) className = 'badge--status-closed';
  else if (key.includes('waiting') && key.includes('user')) className = 'badge--status-waiting-user';
  else if (key.includes('waiting')) className = 'badge--status-waiting-us';

  return <span className={`badge ${className}`}>{statusLabel || '—'}</span>;
};


interface SeverityBadgeProps {
  severity: TicketSeverity;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
    const severityOption = SEVERITY_OPTIONS.find(opt => opt.key === severity);

    if (!severityOption) {
        return <span className="badge badge--severity-low">Unknown</span>;
    }

    const severityToClass: { [key in InternalPriority]: string } = {
        [InternalPriority.Urgent]: 'badge--severity-urgent',
        [InternalPriority.High]: 'badge--severity-high',
        [InternalPriority.Medium]: 'badge--severity-medium',
        [InternalPriority.Low]: 'badge--severity-low',
        [InternalPriority.Unassigned]: 'badge--severity-low',
    };
    
    return (
        <span 
            className={`badge ${severityToClass[severityOption.internalPriority]}`}
            title={severityOption.label}
        >
            {severityOption.label}
        </span>
    );
}

interface PriorityBadgeProps {
  priorityLabel: string;
  priorityKey?: string;
  priorityWeight?: number | null;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priorityLabel, priorityKey, priorityWeight }) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    const key = `${priorityKey || ''} ${priorityLabel || ''}`.toLowerCase();
    const weight = typeof priorityWeight === 'number' ? priorityWeight : null;

    let style = "bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text-sub";

    if (key.includes('urgent') || key.includes('critical')) {
        style = "border border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200";
    } else if (key.includes('high')) {
        style = "border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 dark:border-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200";
    } else if (key.includes('medium')) {
        style = "border border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200";
    } else if (key.includes('low')) {
        style = "border border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200";
    } else if (weight !== null) {
        if (weight >= 75) style = "border border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200";
        else if (weight >= 50) style = "border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 dark:border-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200";
        else if (weight >= 25) style = "border border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200";
        else if (weight > 0) style = "border border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200";
    }

    return <span className={`${baseClasses} ${style}`}>{priorityLabel || 'Unassigned'}</span>;
}

interface AppBadgeProps {
  app: AppKey;
}

export const AppBadge: React.FC<AppBadgeProps> = ({ app }) => {
  const baseClasses = "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium";
  const appLabel = APP_OPTIONS.find(a => a.key === app)?.label || app;
  
  const appStyles: { [key in AppKey]?: string } = {
    boh: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    career_studio: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    counter: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    talent: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
    other: 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text-sub',
  };

  return <span className={`${baseClasses} ${appStyles[app] || appStyles['other']}`}>{appLabel}</span>;
}

interface AssigneeBadgeProps {
  assignee: string;
}

export const AssigneeBadge: React.FC<AssigneeBadgeProps> = ({ assignee }) => {
    const baseClasses = "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium";
    
    let style = "bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text-sub"; // Default/Unassigned
    
    if (assignee === 'You') {
        style = "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200";
    } else if (assignee === 'Support Bot') {
        style = "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200";
    } else if (assignee === 'Team Inbox') {
        style = "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200";
    } else if (assignee !== 'Unassigned') {
        // A consistent style for any other named agent
        style = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    }
    
    return <span className={`${baseClasses} ${style}`}>{assignee}</span>
}
