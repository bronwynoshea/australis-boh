import React from 'react';
import type { PatronActivity } from '../types';

interface PatronActivityListProps {
  activities: PatronActivity[];
  loading?: boolean;
}

const getActivityTypeLabel = (type: PatronActivity['type']): string => {
  switch (type) {
    case 'note':
      return 'Note';
    case 'call':
      return 'Call';
    case 'email':
      return 'Email';
    case 'meeting':
      return 'Meeting';
    case 'task':
      return 'Task';
    case 'other':
      return 'Other';
    default:
      return type;
  }
};

const getActivityTypeClasses = (type: PatronActivity['type']): string => {
  switch (type) {
    case 'note':
      return 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text dark:bg-boh-surface dark:text-boh-text-sub';
    case 'call':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'email':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'meeting':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-boh-text';
    case 'task':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'other':
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    default:
      return 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text dark:bg-boh-surface dark:text-boh-text-sub';
  }
};

const formatTimeAgo = (dateString: string | null): string => {
  if (!dateString) return 'Unknown time';
  
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
};

const PatronActivityList: React.FC<PatronActivityListProps> = ({ activities, loading = false }) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-20 bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-bg rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-boh-text-sub-light dark:text-boh-text-sub">
        No activities yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="p-4 bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border-light dark:border-boh-border"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActivityTypeClasses(activity.type)}`}>
                {getActivityTypeLabel(activity.type)}
              </span>
            </div>
            <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
              {formatTimeAgo(activity.created_at)}
            </span>
          </div>
          {activity.body && (
            <p className="text-sm text-boh-text-light dark:text-boh-text mt-2 whitespace-pre-wrap">
              {activity.body}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

export default PatronActivityList;

