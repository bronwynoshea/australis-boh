import React from 'react';
import type { InitiativeReadiness, ReleaseReadiness } from '../types/reporting';

interface ReadinessBadgeProps {
  readiness: InitiativeReadiness | ReleaseReadiness;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const readinessConfig: Record<
  InitiativeReadiness | ReleaseReadiness,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  // Initiative readiness states
  on_track: {
    label: 'On Track',
    color: 'text-boh-success dark:text-boh-success',
    bgColor: 'bg-boh-success-tint dark:bg-boh-success/20',
    icon: 'check-circle',
  },
  needs_attention: {
    label: 'Needs Attention',
    color: 'text-boh-primary dark:text-boh-primary',
    bgColor: 'bg-boh-primary-tint dark:bg-boh-primary/20',
    icon: 'alert-triangle',
  },
  at_risk: {
    label: 'At Risk',
    color: 'text-boh-primary dark:text-boh-primary',
    bgColor: 'bg-boh-primary/10 dark:bg-boh-primary/10',
    icon: 'alert-octagon',
  },
  parked: {
    label: 'Parked',
    color: 'text-boh-text-sub-light dark:text-boh-text-sub',
    bgColor: 'bg-boh-surface-light dark:bg-boh-surface',
    icon: 'pause-circle',
  },
  no_coding_planned: {
    label: 'No Coding',
    color: 'text-boh-text-light dark:text-boh-text',
    bgColor: 'bg-boh-surface-light dark:bg-boh-surface',
    icon: 'code-off',
  },
  complete: {
    label: 'Complete',
    color: 'text-boh-success dark:text-boh-success',
    bgColor: 'bg-boh-success-tint dark:bg-boh-success/20',
    icon: 'check-circle',
  },
  // Release readiness states
  ready: {
    label: 'Ready',
    color: 'text-boh-success dark:text-boh-success',
    bgColor: 'bg-boh-success-tint dark:bg-boh-success/20',
    icon: 'check-circle',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-boh-primary dark:text-boh-primary',
    bgColor: 'bg-boh-primary-tint dark:bg-boh-primary/20',
    icon: 'loader',
  },
  blocked: {
    label: 'Blocked',
    color: 'text-boh-primary dark:text-boh-primary',
    bgColor: 'bg-boh-primary/10 dark:bg-boh-primary/10',
    icon: 'ban',
  },
};

const Icons: Record<string, React.FC<{ className?: string }>> = {
  'check-circle': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  'alert-triangle': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  'alert-octagon': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  'pause-circle': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="10" y1="15" x2="10" y2="9" />
      <line x1="14" y1="15" x2="14" y2="9" />
    </svg>
  ),
  'code-off': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  ),
  'loader': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  ),
  'ban': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  ),
};

const ReadinessBadge: React.FC<ReadinessBadgeProps> = ({
  readiness,
  showLabel = true,
  size = 'md',
  className = '',
}) => {
  const config = readinessConfig[readiness] || readinessConfig.on_track;
  const Icon = Icons[config.icon] || Icons['check-circle'];

  const sizeClasses = {
    sm: 'h-5 px-1.5 text-xs gap-1',
    md: 'h-6 px-2.5 text-sm gap-1.5',
    lg: 'h-7 px-3 text-sm gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center rounded-full font-medium
        ${config.color} ${config.bgColor}
        ${sizeClasses[size]}
        ${className}
      `}
      title={config.label}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
};

export default ReadinessBadge;
