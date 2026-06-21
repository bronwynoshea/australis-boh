import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMenuInitiatives } from '../hooks/useMenuInitiatives';
import type { Initiative } from '../../../../types/product';
import MenuFiltersBar from '../components/MenuFiltersBar';

// Inline SVG icons
const IconLayers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
    <polyline points="2 17 12 22 22 17"/>
    <polyline points="2 12 12 17 22 12"/>
  </svg>
);

const IconCheckCircle = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const IconUser = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconCalendar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const IconArrowRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

const SummaryCard: React.FC<{ label: string; value: number; icon?: React.ReactNode; color?: 'default' | 'success' | 'warning' | 'danger' }> = ({ 
  label, 
  value, 
  icon,
  color = 'default' 
}) => {
  const colorClasses = {
    default: 'border-boh-border-light dark:border-boh-border',
    success: 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-boh-bg/20',
    warning: 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-boh-bg/20',
    danger: 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-boh-bg/20',
  };

  return (
    <div className={`rounded-xl border ${colorClasses[color]} bg-boh-surface-light dark:bg-boh-surface p-4 shadow-sm flex items-center gap-3`}>
      {icon && (
        <div className={`p-2 rounded-lg ${
          color === 'success' ? 'bg-green-100 dark:bg-boh-bg/30 text-green-600 dark:text-boh-text' :
          color === 'warning' ? 'bg-amber-100 dark:bg-boh-bg/30 text-amber-600 dark:text-boh-text' :
          color === 'danger' ? 'bg-red-100 dark:bg-boh-bg/30 text-red-600 dark:text-boh-text' :
          'bg-boh-primary/10 text-boh-primary'
        }`}>
          {icon}
        </div>
      )}
      <div className="flex flex-col">
        <p className="text-2xl font-semibold text-boh-text-light dark:text-boh-text">{value}</p>
        <p className="text-[11px] font-medium uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">{label}</p>
      </div>
    </div>
  );
};

const SectionCard: React.FC<{ title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, description, children, action }) => (
  <section className="rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-4 shadow-sm">
    <div className="flex items-center justify-between mb-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">{title}</h3>
        {description && (
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
    {children}
  </section>
);

const InitiativeRow: React.FC<{ initiative: Initiative; showIndicators?: boolean; actionButton?: React.ReactNode }> = ({ 
  initiative, 
  showIndicators = true,
  actionButton 
}) => {
  const navigate = useNavigate();
  const hasStories = (initiative.user_story_count ?? 0) > 0;
  
  return (
    <div 
      onClick={() => navigate(`/menu/initiatives/${initiative.id}`)}
      className="flex items-center justify-between p-3 rounded-lg border border-boh-border-light dark:border-boh-border hover:bg-boh-bg-light dark:hover:bg-boh-bg/50 transition-colors cursor-pointer"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-boh-text-light dark:text-boh-text truncate">{initiative.title}</p>
          {initiative.priority?.label && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-boh-primary/10 text-boh-primary font-medium whitespace-nowrap">
              {initiative.priority.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
          <span>{initiative.app?.name || 'Unknown app'}</span>
          {initiative.owner_user?.full_name && (
            <span className="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              {initiative.owner_user.full_name}
            </span>
          )}
          {initiative.target_quarter && initiative.target_year && (
            <span className="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {initiative.target_quarter} {initiative.target_year}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {showIndicators && (
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              hasStories 
                ? 'bg-green-100 dark:bg-boh-bg/30 text-green-700 dark:text-boh-text' 
                : 'bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub'
            }`}>
              {hasStories ? `${initiative.user_story_count} stories` : 'No stories'}
            </span>
          </div>
        )}
        {actionButton}
      </div>
    </div>
  );
};

const AttentionRow: React.FC<{ initiative: Initiative; reason: string }> = ({ initiative, reason }) => {
  const reasonColor = reason.includes('owner') 
    ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' 
    : reason.includes('quarter') 
    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
    : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-boh-border-light dark:border-boh-border hover:bg-boh-bg-light dark:hover:bg-boh-bg/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-boh-text-light dark:text-boh-text truncate">{initiative.title}</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${reasonColor}`}>
            {reason}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
          <span>{initiative.app?.name || 'Unknown app'}</span>
          {initiative.planning_stage?.label && (
            <span className="text-boh-text-sub-light dark:text-boh-text-sub">{initiative.planning_stage.label}</span>
          )}
        </div>
      </div>
    </div>
  );
};

const MenuDashboard: React.FC = () => {
  const { initiatives, appGroups, isLoading } = useMenuInitiatives();

  const derived = useMemo(() => {
    const approvedInitiatives = initiatives.filter(i => i.planning_stage?.key === 'approved');
    const framingInitiatives = initiatives.filter(i => i.planning_stage?.key === 'framing');

    // Ready for execution: Approved with owner AND quarter/year
    const readyForExecution = approvedInitiatives.filter(i => 
      i.owner_user_id && 
      i.target_quarter && 
      i.target_year
    );

    // Needs attention
    const approvedMissingOwner = approvedInitiatives.filter(i => !i.owner_user_id);
    const approvedMissingQuarter = approvedInitiatives.filter(i => 
      i.owner_user_id && (!i.target_quarter || !i.target_year)
    );
    const framingNoStories = framingInitiatives.filter(i => (i.user_story_count ?? 0) === 0);

    // Summary counts
    const totalFiltered = initiatives.length;
    const approvedCount = approvedInitiatives.length;
    const missingOwnerCount = initiatives.filter(i => !i.owner_user_id).length;
    const missingQuarterCount = initiatives.filter(i => !i.target_quarter || !i.target_year).length;

    // App groups sorted by count
    const initiativesByApp = Object.values(appGroups)
      .sort((a, b) => b.initiatives.length - a.initiatives.length)
      .slice(0, 8);

    return {
      readyForExecution,
      approvedMissingOwner,
      approvedMissingQuarter,
      framingNoStories,
      totalFiltered,
      approvedCount,
      missingOwnerCount,
      missingQuarterCount,
      initiativesByApp,
    };
  }, [initiatives, appGroups]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-20 rounded-xl bg-boh-skeleton animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-48 rounded-xl bg-boh-skeleton animate-pulse" />
          <div className="h-48 rounded-xl bg-boh-skeleton animate-pulse" />
        </div>
      </div>
    );
  }

  const hasAttentionItems = 
    derived.approvedMissingOwner.length > 0 || 
    derived.approvedMissingQuarter.length > 0 || 
    derived.framingNoStories.length > 0;

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="border-b border-boh-border-light dark:border-boh-border flex-shrink-0 px-4 sm:px-6 lg:px-8 py-4">
        <h1 className="text-2xl font-semibold tracking-tight text-boh-text-light dark:text-boh-text">Overview</h1>
        <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
          Decision-focused initiative management. Identify what's ready for execution and what needs attention.
        </p>
      </div>
      
      {/* Content */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 lg:px-8">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-6 h-full">
          {/* Main Content */}
          <div className="min-h-0 flex flex-col space-y-5">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <SummaryCard 
                label="Total Initiatives" 
                value={derived.totalFiltered}
                icon={<IconLayers />}
              />
              <SummaryCard 
                label="Approved & Ready" 
                value={derived.approvedCount}
                icon={<IconCheckCircle />}
                color="success"
              />
              <SummaryCard 
                label="Missing Owner" 
                value={derived.missingOwnerCount}
                icon={<IconUser />}
                color={derived.missingOwnerCount > 0 ? 'warning' : 'default'}
              />
              <SummaryCard 
                label="Missing Quarter/Year" 
                value={derived.missingQuarterCount}
                icon={<IconCalendar />}
                color={derived.missingQuarterCount > 0 ? 'warning' : 'default'}
              />
            </div>

            {initiatives.length === 0 && (
              <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                No initiatives yet. Start by creating your first initiative.
              </div>
            )}

            {/* Section 1: Ready for Execution */}
            <SectionCard 
              title="Ready for Execution" 
              description={`${derived.readyForExecution.length} initiatives fully configured and ready to become Forge workstreams`}
            >
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {derived.readyForExecution.map((initiative) => (
                  <InitiativeRow 
                    key={initiative.id} 
                    initiative={initiative}
                    actionButton={
                      <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-boh-primary text-white hover:bg-boh-primary/90 transition-colors">
                        Create Workstream
                        <IconArrowRight />
                      </button>
                    }
                  />
                ))}
                {derived.readyForExecution.length === 0 && (
                  <div className="text-center py-6 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 opacity-50">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <p>No initiatives are fully configured yet.</p>
                    <p className="text-xs mt-1">Approved initiatives need an owner, quarter, and year to appear here.</p>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Section 2: Needs Attention */}
            {hasAttentionItems && (
              <SectionCard 
                title="Needs Attention" 
                description="Initiatives missing required data or incomplete setup"
              >
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {derived.approvedMissingOwner.map((initiative) => (
                    <AttentionRow 
                      key={initiative.id} 
                      initiative={initiative} 
                      reason="Missing owner" 
                    />
                  ))}
                  {derived.approvedMissingQuarter.map((initiative) => (
                    <AttentionRow 
                      key={initiative.id} 
                      initiative={initiative} 
                      reason="Missing quarter/year" 
                    />
                  ))}
                  {derived.framingNoStories.map((initiative) => (
                    <AttentionRow 
                      key={initiative.id} 
                      initiative={initiative} 
                      reason="No stories defined" 
                    />
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Section 3: Initiatives by App */}
            <SectionCard 
              title="Initiatives by App" 
              description="Click to filter initiatives by app"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {derived.initiativesByApp.map(({ appName, initiatives }) => (
                  <button 
                    key={appName}
                    className="flex items-center justify-between p-3 rounded-lg border border-boh-border-light dark:border-boh-border hover:bg-boh-bg-light dark:hover:bg-boh-bg/50 transition-colors text-left"
                  >
                    <span className="font-medium text-sm text-boh-text-light dark:text-boh-text truncate">{appName}</span>
                    <span className="text-sm font-semibold text-boh-primary">{initiatives.length}</span>
                  </button>
                ))}
                {derived.initiativesByApp.length === 0 && (
                  <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub col-span-full">No initiatives available.</p>
                )}
              </div>
            </SectionCard>
          </div>
          
          {/* Right Column: Filters Panel */}
          <div className="hidden xl:block w-[320px]">
            <div className="sticky top-0 max-h-screen overflow-y-auto boh-hide-scrollbars lg:boh-show-scrollbars p-4">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text mb-3 uppercase tracking-wide">
                  Overview Filters
                </h3>
              </div>
              <MenuFiltersBar />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuDashboard;
