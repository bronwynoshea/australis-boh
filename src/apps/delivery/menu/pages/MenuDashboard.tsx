import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMenuInitiatives } from '../hooks/useMenuInitiatives';
import type { Initiative } from '../../../../types/product';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

const FORGE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text' },
  submitted: { label: 'Submitted', color: 'bg-boh-primary/10 dark:bg-boh-primary/10 text-boh-primary dark:text-boh-primary' },
  accepted: { label: 'Accepted', color: 'bg-boh-primary/20 dark:bg-boh-primary/20 text-boh-primary dark:text-boh-primary' },
  deferred: { label: 'Deferred', color: 'bg-boh-primary/15 dark:bg-boh-primary/15 text-boh-primary dark:text-boh-primary' },
  rejected: { label: 'Rejected', color: 'bg-boh-primary/10 dark:bg-boh-primary/10 text-boh-text-sub-light dark:text-boh-text-sub' },
};

type InitiativeIssue = 'missing_owner' | 'no_stories' | 'missing_description' | 'missing_app';

function detectIssues(initiative: Initiative): InitiativeIssue[] {
  const issues: InitiativeIssue[] = [];
  
  if (!initiative.owner_user_id) {
    issues.push('missing_owner');
  }
  
  if (!initiative.user_story_count || initiative.user_story_count === 0) {
    issues.push('no_stories');
  }
  
  if (!initiative.description || initiative.description.trim() === '') {
    issues.push('missing_description');
  }
  
  if (!initiative.app_id) {
    issues.push('missing_app');
  }
  
  return issues;
}

function isReadyToSubmit(initiative: Initiative): boolean {
  // Has all required fields and has not been submitted/accepted yet
  const hasRequiredFields = 
    initiative.title &&
    initiative.description &&
    initiative.description.trim() !== '' &&
    initiative.app_id &&
    initiative.owner_user_id &&
    initiative.target_quarter &&
    initiative.target_year &&
    initiative.user_story_count && initiative.user_story_count > 0;
  
  const forgeStatus = initiative.forge_status?.key;
  const notSubmitted = !forgeStatus || forgeStatus === 'draft';
  
  return hasRequiredFields && notSubmitted;
}

// Summary Card Component
const SummaryCard: React.FC<{ 
  label: string; 
  value: number; 
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  subtitle?: string;
}> = ({ label, value, color = 'default', subtitle }) => {
  const colorClasses = {
    default: 'border-boh-border-light dark:border-boh-border',
    success: 'border-boh-primary/20 dark:border-boh-primary/20 bg-boh-primary/5 dark:bg-boh-primary/5',
    warning: 'border-boh-primary/20 dark:border-boh-primary/20 bg-boh-primary/5 dark:bg-boh-primary/5',
    danger: 'border-boh-primary/20 dark:border-boh-primary/20 bg-boh-primary/5 dark:bg-boh-primary/5',
    info: 'border-boh-primary/20 dark:border-boh-primary/20 bg-boh-primary/5 dark:bg-boh-primary/5',
  };

  const valueColorClasses = {
    default: 'text-boh-text-light dark:text-boh-text',
    success: 'text-boh-primary dark:text-boh-primary',
    warning: 'text-boh-primary dark:text-boh-primary',
    danger: 'text-boh-primary dark:text-boh-primary',
    info: 'text-boh-primary dark:text-boh-primary',
  };

  return (
    <div className={`rounded-xl border ${colorClasses[color]} bg-boh-surface-light dark:bg-boh-surface p-4 shadow-sm`}>
      <div className="flex flex-col">
        <p className={`text-2xl font-bold ${valueColorClasses[color]}`}>{value}</p>
        <p className="text-[11px] font-medium uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">{label}</p>
        {subtitle && (
          <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

// Pipeline Flow Component
const PipelineFlow: React.FC<{ 
  planned: number; 
  ready: number; 
  submitted: number; 
  accepted: number; 
  deferred: number;
}> = ({ planned, ready, submitted, accepted, deferred }) => (
  <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-4">
    <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text mb-4">Menu-to-Forge Handoff</h3>
    <div className="flex items-center justify-between gap-2">
      {/* Planned */}
      <div className="flex-1 text-center">
        <div className="text-lg font-semibold text-boh-text-light dark:text-boh-text">{planned}</div>
        <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">Planned</div>
      </div>
      
      {/* Arrow */}
      <svg className="w-4 h-4 text-boh-text-sub-light dark:text-boh-text-sub flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      
      {/* Ready */}
      <div className="flex-1 text-center">
        <div className="text-lg font-semibold text-boh-primary dark:text-boh-primary">{ready}</div>
        <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">Ready</div>
      </div>
      
      {/* Arrow */}
      <svg className="w-4 h-4 text-boh-text-sub-light dark:text-boh-text-sub flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      
      {/* Submitted */}
      <div className="flex-1 text-center">
        <div className="text-lg font-semibold text-boh-primary dark:text-boh-primary">{submitted}</div>
        <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">Submitted</div>
      </div>
      
      {/* Arrow */}
      <svg className="w-4 h-4 text-boh-text-sub-light dark:text-boh-text-sub flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      
      {/* Accepted */}
      <div className="flex-1 text-center">
        <div className="text-lg font-semibold text-boh-primary dark:text-boh-primary">{accepted}</div>
        <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">Accepted</div>
      </div>
      
      {/* Arrow */}
      <svg className="w-4 h-4 text-boh-text-sub-light dark:text-boh-text-sub flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      
      {/* Deferred */}
      <div className="flex-1 text-center">
        <div className="text-lg font-semibold text-boh-primary dark:text-boh-primary">{deferred}</div>
        <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">Deferred</div>
      </div>
    </div>
  </div>
);

// Issue Tag Component
const IssueTag: React.FC<{ issue: InitiativeIssue }> = ({ issue }) => {
  const config: Record<InitiativeIssue, { label: string; color: string }> = {
    missing_owner: { label: 'No Owner', color: 'bg-boh-primary/10 dark:bg-boh-primary/10 text-boh-primary dark:text-boh-primary border-boh-primary/20 dark:border-boh-primary/20' },
    no_stories: { label: 'No Stories', color: 'bg-boh-primary/10 dark:bg-boh-primary/10 text-boh-primary dark:text-boh-primary border-boh-primary/20 dark:border-boh-primary/20' },
    missing_description: { label: 'No Description', color: 'bg-boh-primary/10 dark:bg-boh-primary/10 text-boh-primary dark:text-boh-primary border-boh-primary/20 dark:border-boh-primary/20' },
    missing_app: { label: 'No App', color: 'bg-boh-primary/10 dark:bg-boh-primary/10 text-boh-primary dark:text-boh-primary border-boh-primary/20 dark:border-boh-primary/20' },
  };
  
  const { label, color } = config[issue];
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
      {label}
    </span>
  );
};

// At Risk Initiative Card
const AtRiskCard: React.FC<{ initiative: Initiative; onClick: () => void }> = ({ initiative, onClick }) => {
  const issues = detectIssues(initiative);
  
  return (
    <div
      onClick={onClick}
      className="border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface rounded-lg p-3 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-boh-text-light dark:text-boh-text text-sm truncate flex-1">{initiative.title}</h4>
        <div className="flex flex-wrap gap-1 ml-2">
          {issues.slice(0, 2).map(issue => <IssueTag key={issue} issue={issue} />)}
          {issues.length > 2 && (
            <span className="text-xs text-boh-primary dark:text-boh-text-sub font-medium">+{issues.length - 2}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
        <span>{initiative.app?.name || 'No App'}</span>
        <span>{initiative.owner_user?.full_name || 'No Owner'}</span>
        <span>{initiative.user_story_count || 0} stories</span>
        {initiative.target_quarter && initiative.target_year && (
          <span>{initiative.target_quarter} {initiative.target_year}</span>
        )}
      </div>
    </div>
  );
};

// Forge Decision Card
const ForgeDecisionCard: React.FC<{ initiative: Initiative; onClick: () => void }> = ({ initiative, onClick }) => {
  const forgeStatus = initiative.forge_status;
  const isPositive = forgeStatus?.key === 'accepted';
  const isNeutral = forgeStatus?.key === 'deferred';
  
  return (
    <div
      onClick={onClick}
      className={`border rounded-lg p-3 hover:shadow-md transition-all cursor-pointer ${
        isPositive 
          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
          : isNeutral
          ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
          : 'border-boh-border-light dark:border-boh-border dark:border-boh-border dark:bg-boh-bg/20 dark:bg-boh-bg/20'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-boh-text-light dark:text-boh-text text-sm truncate flex-1">{initiative.title}</h4>
        {forgeStatus && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${FORGE_STATUS_CONFIG[forgeStatus.key]?.color || 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text'}`}>
            {forgeStatus.label}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
        <span>{initiative.app?.name}</span>
        <span>{initiative.owner_user?.full_name}</span>
        {initiative.forge_reviewed_at && (
          <span>{new Date(initiative.forge_reviewed_at).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
};

// Main Overview Component
const MenuDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { initiatives, isLoading, error } = useMenuInitiatives();

  // Calculate metrics
  const metrics = useMemo(() => {
    // Upcoming (Next 90 Days)
    const now = new Date();
    const ninetyDaysLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const upcoming = initiatives.filter(initiative => {
      if (!initiative.target_quarter || !initiative.target_year) return false;
      const quarterMonthMap: Record<string, number> = { Q1: 0, Q2: 3, Q3: 6, Q4: 9 };
      const targetDate = new Date(initiative.target_year, quarterMonthMap[initiative.target_quarter], 1);
      return targetDate >= now && targetDate <= ninetyDaysLater;
    }).length;

    // Ready to Submit
    const readyToSubmit = initiatives.filter(isReadyToSubmit).length;

    // Submitted to Forge
    const submittedToForge = initiatives.filter(i => i.forge_status?.key === 'submitted').length;

    // Accepted by Forge
    const acceptedByForge = initiatives.filter(i => i.forge_status?.key === 'accepted').length;

    // At Risk (missing stories OR incomplete setup in current quarter)
    const currentQuarter = getCurrentQuarter();
    const atRisk = initiatives.filter(i => {
      const isInCurrentQuarter = i.target_year === currentQuarter.year && i.target_quarter === currentQuarter.quarter;
      const hasIssues = detectIssues(i).length > 0;
      const hasNoStories = !i.user_story_count || i.user_story_count === 0;
      return (isInCurrentQuarter && (hasIssues || hasNoStories));
    }).length;

    // Pipeline counts
    const planned = initiatives.filter(i => !i.forge_status || i.forge_status.key === 'draft').length;
    const ready = initiatives.filter(isReadyToSubmit).length;
    const submitted = initiatives.filter(i => i.forge_status?.key === 'submitted').length;
    const accepted = initiatives.filter(i => i.forge_status?.key === 'accepted').length;
    const deferred = initiatives.filter(i => i.forge_status?.key === 'deferred').length;

    return {
      upcoming,
      readyToSubmit,
      submittedToForge,
      acceptedByForge,
      atRisk,
      pipeline: { planned, ready, submitted, accepted, deferred },
    };
  }, [initiatives]);

  // At Risk initiatives (max 5, sorted by severity)
  const atRiskInitiatives = useMemo(() => {
    const currentQuarter = getCurrentQuarter();
    const atRisk = initiatives
      .filter(i => {
        const isInCurrentQuarter = i.target_year === currentQuarter.year && i.target_quarter === currentQuarter.quarter;
        const hasIssues = detectIssues(i).length > 0;
        const hasNoStories = !i.user_story_count || i.user_story_count === 0;
        return (isInCurrentQuarter && (hasIssues || hasNoStories));
      })
      .sort((a, b) => {
        // Sort by severity: no stories first, then by number of issues
        const aHasNoStories = !a.user_story_count || a.user_story_count === 0;
        const bHasNoStories = !b.user_story_count || b.user_story_count === 0;
        if (aHasNoStories !== bHasNoStories) return bHasNoStories ? 1 : -1;
        
        const aIssues = detectIssues(a).length;
        const bIssues = detectIssues(b).length;
        if (aIssues !== bIssues) return bIssues - aIssues;
        
        return a.title.localeCompare(b.title);
      })
      .slice(0, 5);
    
    return atRisk;
  }, [initiatives]);

  // Recent Forge Decisions
  const recentForgeDecisions = useMemo(() => {
    return initiatives
      .filter(i => i.forge_status && ['accepted', 'deferred'].includes(i.forge_status.key) && i.forge_reviewed_at)
      .sort((a, b) => new Date(b.forge_reviewed_at!).getTime() - new Date(a.forge_reviewed_at!).getTime())
      .slice(0, 5);
  }, [initiatives]);

  // Helper to get current quarter
  function getCurrentQuarter() {
    const now = new Date();
    const month = now.getMonth();
    const quarter = QUARTERS[Math.floor(month / 3)];
    const year = now.getFullYear();
    return { quarter, year };
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-boh-bg-light dark:bg-boh-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-boh-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Loading overview...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-boh-bg-light p-6 dark:bg-boh-bg">
        <div className="rounded-lg border border-boh-border-light bg-boh-surface-light p-4 text-sm text-boh-text-light dark:border-boh-border dark:bg-boh-surface dark:text-boh-text">
          <h2 className="mb-1 font-semibold">Overview data could not load</h2>
          <p className="text-boh-text-sub-light dark:text-boh-text-sub">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-boh-bg-light dark:bg-boh-bg overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-2">
          <span className="text-boh-text-light dark:text-boh-text font-medium">Menu</span>
          <span className="text-boh-text-sub-light dark:text-boh-text-sub">/</span>
          <span className="text-boh-text-sub-light dark:text-boh-text-sub">Overview</span>
        </nav>
        <h1 className="text-2xl font-semibold text-boh-text-light dark:text-boh-text">Overview</h1>
        <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">
          Strategic snapshot of Menu-owned initiative readiness and Forge handoff status
        </p>
      </div>

      {/* Main Content - No page scroll */}
      <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden">
        {/* 1. SUMMARY STRIP */}
        <div className="flex-shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <SummaryCard 
              label="Upcoming" 
              value={metrics.upcoming}
              color="info"
              subtitle="Next 90 days"
            />
            <SummaryCard 
              label="Ready to Submit" 
              value={metrics.readyToSubmit}
              color="success"
            />
            <SummaryCard 
              label="Submitted to Forge" 
              value={metrics.submittedToForge}
              color="info"
            />
            <SummaryCard 
              label="Accepted by Forge" 
              value={metrics.acceptedByForge}
              color="success"
            />
            <SummaryCard 
              label="At Risk" 
              value={metrics.atRisk}
              color={metrics.atRisk > 0 ? 'danger' : 'default'}
            />
          </div>
        </div>

        {/* 2. PIPELINE FLOW */}
        <div className="flex-shrink-0">
          <PipelineFlow {...metrics.pipeline} />
        </div>

        {/* 3. TWO-COLUMN LAYOUT FOR AT RISK AND RECENT DECISIONS */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AT RISK SECTION */}
          <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl flex flex-col h-[360px]">
            {/* Fixed Header */}
            <div className="flex-shrink-0 p-4 border-b border-boh-border-light dark:border-boh-border">
              <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">At Risk</h3>
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                {atRiskInitiatives.length} initiatives need attention
              </p>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto boh-hide-scrollbars p-4">
              {atRiskInitiatives.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto mb-3 text-green-600 dark:text-green-400 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-boh-text-sub-light dark:text-boh-text-sub">
                    No initiatives at risk
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {atRiskInitiatives.map(initiative => (
                    <AtRiskCard
                      key={initiative.id}
                      initiative={initiative}
                      onClick={() => navigate(`/menu/initiatives/${initiative.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RECENT FORGE DECISIONS */}
          <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl flex flex-col h-[360px]">
            {/* Fixed Header */}
            <div className="flex-shrink-0 p-4 border-b border-boh-border-light dark:border-boh-border">
              <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Recent Forge Decisions</h3>
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                {recentForgeDecisions.length} recent decisions
              </p>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto boh-hide-scrollbars p-4">
              {recentForgeDecisions.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto mb-3 text-boh-text-sub-light dark:text-boh-text-sub opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-boh-text-sub-light dark:text-boh-text-sub">
                    No recent Forge decisions
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentForgeDecisions.map(initiative => (
                    <ForgeDecisionCard
                      key={initiative.id}
                      initiative={initiative}
                      onClick={() => navigate(`/menu/initiatives/${initiative.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuDashboard;
