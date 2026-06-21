import React from 'react';

interface ReportSummaryCardsProps {
  totalInitiatives: number;
  activeInitiatives: number;
  plannedInitiatives: number;
  atRiskCount: number;
  totalStories: number;
  incompleteStories: number;
  totalTickets: number;
  outstandingTickets: number;
  highPriorityTickets: number;
  className?: string;
}

interface SummaryCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'primary' | 'surface' | 'risk' | 'success';
  subtitle?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, icon, color, subtitle }) => {
  const colorClasses = {
    primary: 'bg-boh-primary-tint dark:bg-boh-primary/20 border-boh-border-light dark:border-boh-border text-boh-primary dark:text-boh-primary',
    surface: 'bg-boh-surface-light dark:bg-boh-surface border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text',
    risk: 'bg-boh-primary/10 dark:bg-boh-primary/10 border-boh-primary/20 dark:border-boh-primary/20 text-boh-primary dark:text-boh-primary',
    success: 'bg-boh-success-tint dark:bg-boh-success/20 border-boh-success/30 dark:border-boh-success/30 text-boh-success dark:text-boh-success',
  };

  const iconColorClasses = {
    primary: 'text-boh-primary dark:text-boh-primary',
    surface: 'text-boh-text-light dark:text-boh-text',
    risk: 'text-boh-primary dark:text-boh-primary',
    success: 'text-boh-success dark:text-boh-success',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]} transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className={`${iconColorClasses[color]}`}>
          {icon}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        </div>
      </div>
      <div className="mt-2">
        <div className="text-sm font-medium">{label}</div>
        {subtitle && (
          <div className="text-xs opacity-75 mt-0.5">{subtitle}</div>
        )}
      </div>
    </div>
  );
};

const ReportSummaryCards: React.FC<ReportSummaryCardsProps> = ({
  totalInitiatives,
  activeInitiatives,
  plannedInitiatives,
  atRiskCount,
  totalStories,
  incompleteStories,
  totalTickets,
  outstandingTickets,
  highPriorityTickets,
  className = '',
}) => {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${className}`}>
      <SummaryCard
        label="Total Initiatives"
        value={totalInitiatives}
        icon={
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        }
        color="primary"
        subtitle={`${activeInitiatives} active, ${plannedInitiatives} planned`}
      />

      <SummaryCard
        label="At Risk"
        value={atRiskCount}
        icon={
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        }
        color={atRiskCount > 0 ? 'risk' : 'success'}
        subtitle={atRiskCount > 0 ? 'Needs attention' : 'All on track'}
      />

      <SummaryCard
        label="User Stories"
        value={totalStories}
        icon={
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        }
        color="primary"
        subtitle={`${incompleteStories} incomplete`}
      />

      <SummaryCard
        label="Tickets"
        value={totalTickets}
        icon={
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        }
        color="surface"
        subtitle={`${outstandingTickets} open`}
      />

      {highPriorityTickets > 0 && (
        <SummaryCard
          label="High Priority"
          value={highPriorityTickets}
          icon={
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
          color="risk"
          subtitle="Critical issues"
        />
      )}
    </div>
  );
};

export default ReportSummaryCards;
