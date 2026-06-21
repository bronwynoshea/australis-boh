import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMenuInitiatives } from '../hooks/useMenuInitiatives';
import type { Initiative } from '../../../../types/product';

// Generate quarters for display (current year - 1 to Q4 2028)
const generateQuarters = () => {
  const quarters = [];
  const currentYear = new Date().getFullYear();

  for (let year = currentYear - 1; year <= 2028; year++) {
    for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4'] as const) {
      quarters.push({ year, quarter, key: `${year}-${quarter}` });
    }
  }

  return quarters;
};

const QUARTERS = generateQuarters();
const LEFT_COL_WIDTH = 280;
const QUARTER_WIDTH = 100;

// Type for grouped app data
interface AppTimelineData {
  appId: string;
  appName: string;
  initiativesByQuarter: Map<string, Initiative[]>;
  allInitiatives: Initiative[];
  hasBacklogItems: boolean;
}

// Get subtle bar color for planning stage
const getStageBarColor = (stageKey?: string | null): string => {
  switch (stageKey) {
    case 'ready':
      return 'bg-violet-500/30 border-violet-400/40 text-violet-100 dark:text-violet-100 text-violet-700';
    case 'in_review':
      return 'bg-blue-500/30 border-blue-400/40 text-blue-100 dark:text-blue-100 text-blue-700';
    case 'draft':
    default:
      return 'bg-slate-600/40 border-slate-500/40 text-boh-text dark:text-boh-text dark:text-boh-text dark:text-boh-text text-slate-700';
  }
};

interface QuarterCellProps {
  initiatives: Initiative[];
  onClickInitiative: (initiative: Initiative) => void;
}

const QuarterCell: React.FC<QuarterCellProps> = ({ initiatives, onClickInitiative }) => {
  if (initiatives.length === 0) return null;

  if (initiatives.length === 1) {
    const initiative = initiatives[0];
    const stageKey = initiative.planning_stage?.key;
    const colorClass = getStageBarColor(stageKey);

    return (
      <div className="px-1.5 py-2">
        <div
          onClick={() => onClickInitiative(initiative)}
          className={`h-7 px-2.5 rounded-md border ${colorClass} cursor-pointer hover:opacity-90 transition-opacity flex items-center overflow-hidden`}
          title={initiative.title}
        >
          <span className="text-[11px] font-medium truncate dark:text-inherit">{initiative.title}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-1.5 py-2">
      <div className="h-7 px-2 rounded-md bg-violet-500/20 border border-violet-400/30 cursor-pointer hover:bg-violet-500/30 transition-colors flex items-center justify-center">
        <span className="text-[11px] font-medium text-violet-700 dark:text-violet-200">+{initiatives.length}</span>
      </div>
    </div>
  );
};

interface AppRowProps {
  appData: AppTimelineData;
  onClickInitiative: (initiative: Initiative) => void;
}

const AppRow: React.FC<AppRowProps> = ({ appData, onClickInitiative }) => {
  return (
    <div className="flex items-center h-11 border-b border-boh-border-light dark:border-boh-border dark:border-white/5 hover:bg-boh-bg-light dark:hover:bg-white/5 transition-colors">
      {/* Left column - App name only (fixed width) */}
      <div 
        className="flex-shrink-0 px-4 flex items-center border-r border-boh-border-light dark:border-boh-border dark:border-white/10"
        style={{ width: LEFT_COL_WIDTH }}
      >
        <div className="text-primary font-medium text-boh-text-light dark:text-boh-text dark:text-boh-text truncate">
          {appData.appName}
        </div>
        {appData.hasBacklogItems && (
          <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px]">
            Backlog
          </span>
        )}
      </div>

      {/* Right side - Timeline grid cells */}
      <div className="flex" style={{ minWidth: `${QUARTERS.length * QUARTER_WIDTH}px` }}>
        {QUARTERS.map(q => {
          const quarterInitiatives = appData.initiativesByQuarter.get(q.key) || [];
          return (
            <div
              key={q.key}
              className={`flex-shrink-0 border-r border-boh-border-light dark:border-boh-border dark:border-white/5 ${
                quarterInitiatives.length > 0 ? 'bg-violet-500/5' : ''
              }`}
              style={{ width: QUARTER_WIDTH }}
            >
              <QuarterCell
                initiatives={quarterInitiatives}
                onClickInitiative={onClickInitiative}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MenuTimelineView: React.FC = () => {
  const navigate = useNavigate();
  const { initiatives, isLoading } = useMenuInitiatives();
  const [showBacklog, setShowBacklog] = useState(false);
  
  // Refs for syncing scroll between left and right sections
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  // Group initiatives by app_id
  const appsData = useMemo(() => {
    const filteredInitiatives = initiatives.filter(initiative => {
      if (initiative.is_archived) return false;
      if (initiative.status === 'cancelled') return false;
      if (!initiative.app_id || !initiative.app?.name) return false;
      if (initiative.planning_stage?.key === 'parking_lot' && !showBacklog) {
        return false;
      }
      return true;
    });

    const appsMap = new Map<string, AppTimelineData>();

    filteredInitiatives.forEach(initiative => {
      const appId = initiative.app_id!;
      const appName = initiative.app!.name;

      if (!appsMap.has(appId)) {
        appsMap.set(appId, {
          appId,
          appName,
          initiativesByQuarter: new Map(),
          allInitiatives: [],
          hasBacklogItems: false,
        });
      }

      const appData = appsMap.get(appId)!;
      appData.allInitiatives.push(initiative);

      const isBacklog = !initiative.target_quarter || 
                        !initiative.target_year || 
                        initiative.planning_stage?.key === 'parking_lot';

      if (isBacklog) {
        appData.hasBacklogItems = true;
      } else {
        const quarterKey = `${initiative.target_year}-${initiative.target_quarter}`;
        if (!appData.initiativesByQuarter.has(quarterKey)) {
          appData.initiativesByQuarter.set(quarterKey, []);
        }
        appData.initiativesByQuarter.get(quarterKey)!.push(initiative);
      }
    });

    const appsArray = Array.from(appsMap.values());
    appsArray.sort((a, b) => a.appName.localeCompare(b.appName));

    return appsArray;
  }, [initiatives, showBacklog]);

  // Group initiatives by quarter for the header counts
  const quarterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    QUARTERS.forEach(q => {
      counts[q.key] = appsData.reduce((sum, app) => {
        return sum + (app.initiativesByQuarter.get(q.key)?.length || 0);
      }, 0);
    });
    return counts;
  }, [appsData]);

  // Count backlog items
  const backlogCount = useMemo(() => {
    return initiatives.filter(i => 
      !i.is_archived && 
      i.status !== 'cancelled' &&
      (!i.target_quarter || !i.target_year || i.planning_stage?.key === 'parking_lot')
    ).length;
  }, [initiatives]);

  const handleInitiativeClick = (initiative: Initiative) => {
    navigate(`/menu/initiatives/${initiative.id}`);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-boh-bg-light dark:bg-boh-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-boh-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Loading timeline...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-boh-bg-light dark:bg-boh-bg dark:bg-boh-surface overflow-hidden">
      {/* App Header - Fixed */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-boh-border-light dark:border-boh-border dark:border-white/10 bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-bg focus:ring-primary">
        <div className="flex items-center justify-between">
          <div>
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm mb-1">
              <span className="text-boh-text-light dark:text-boh-text dark:text-boh-text font-medium">Menu</span>
              <span className="text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub">/</span>
              <span className="text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub">Timeline</span>
            </nav>
            <h1 className="text-lg font-semibold text-boh-text-light dark:text-boh-text dark:text-boh-text">Timeline</h1>
          </div>
        </div>
      </div>

      {/* Controls Row - Fixed */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-boh-border-light dark:border-boh-border dark:border-white/10 bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-bg focus:ring-primary">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBacklog(false)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              !showBacklog 
                ? 'bg-boh-primary/20 text-boh-primary border border-boh-primary/30' 
                : 'text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-slate-300'
            }`}
          >
            Active Only
          </button>
          <button
            onClick={() => setShowBacklog(true)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              showBacklog 
                ? 'bg-boh-primary/20 text-boh-primary border border-boh-primary/30' 
                : 'text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-slate-300'
            }`}
          >
            Include Backlog ({backlogCount})
          </button>
        </div>
      </div>

      {/* Quarter Header Row - Fixed */}
      <div className="flex-shrink-0 flex border-b border-boh-border-light dark:border-boh-border dark:border-white/10 bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-bg focus:ring-primary">
        {/* Left header - Apps */}
        <div 
          className="flex-shrink-0 px-4 py-2.5 border-r border-boh-border-light dark:border-boh-border dark:border-white/10 text-primary font-medium text-boh-text-light dark:text-slate-300"
          style={{ width: LEFT_COL_WIDTH }}
        >
          Apps ({appsData.length})
        </div>

        {/* Right header - Quarter labels (scrollable horizontally) */}
        <div className="flex-1 overflow-hidden">
          <div 
            className="flex"
            style={{ minWidth: `${QUARTERS.length * QUARTER_WIDTH}px` }}
          >
            {QUARTERS.map(q => (
              <div
                key={q.key}
                className="flex-shrink-0 px-1 py-2.5 border-r border-boh-border-light dark:border-boh-border dark:border-white/5 text-center"
                style={{ width: QUARTER_WIDTH }}
              >
                <div className="text-[11px] font-semibold text-boh-text-light dark:text-slate-300">
                  {q.quarter} {q.year}
                </div>
                <div className="text-[10px] text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub">
                  {quarterCounts[q.key] || 0}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline Workspace - Fill remaining space, scroll internally */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - App names (scrollable vertically) */}
        <div 
          ref={leftScrollRef}
          className="flex-shrink-0 overflow-y-auto bg-boh-bg-light dark:bg-boh-bg dark:bg-boh-surface"
          style={{ width: LEFT_COL_WIDTH }}
        >
          {appsData.length === 0 ? (
            <div className="flex items-center justify-center h-64 px-4">
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub">No apps</p>
            </div>
          ) : (
            appsData.map(appData => (
              <div 
                key={appData.appId}
                className="flex items-center h-11 px-4 border-b border-boh-border-light dark:border-boh-border dark:border-white/5 border-r border-boh-border-light dark:border-boh-border dark:border-white/10 hover:bg-boh-bg-light dark:hover:bg-white/5 transition-colors"
              >
                <div className="text-primary font-medium text-boh-text-light dark:text-boh-text dark:text-boh-text truncate">
                  {appData.appName}
                </div>
                {appData.hasBacklogItems && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px]">
                    Backlog
                  </span>
                )}
              </div>
            ))
          )}
          {/* Bottom padding */}
          <div className="h-6" />
        </div>

        {/* Right Grid - Quarters (scrollable both ways) */}
        <div 
          ref={rightScrollRef}
          className="flex-1 overflow-auto bg-boh-bg-light dark:bg-boh-bg dark:bg-boh-surface"
        >
          <div style={{ minWidth: `${QUARTERS.length * QUARTER_WIDTH}px` }}>
            {appsData.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center px-4">
                  <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub mb-2">
                    No initiatives scheduled
                  </p>
                  <p className="text-xs text-boh-text-sub-light/60 dark:text-slate-600">
                    {showBacklog 
                      ? 'All initiatives have target quarters set' 
                      : 'Initiatives without quarters are in backlog. Toggle "Include Backlog" to see them.'
                    }
                  </p>
                </div>
              </div>
            ) : (
              <>
                {appsData.map(appData => (
                  <div 
                    key={appData.appId}
                    className="flex items-center h-11 border-b border-boh-border-light dark:border-boh-border dark:border-white/5 hover:bg-boh-bg-light dark:hover:bg-white/5 transition-colors"
                  >
                    {QUARTERS.map(q => {
                      const quarterInitiatives = appData.initiativesByQuarter.get(q.key) || [];
                      return (
                        <div
                          key={q.key}
                          className={`flex-shrink-0 h-11 border-r border-boh-border-light dark:border-boh-border dark:border-white/5 ${
                            quarterInitiatives.length > 0 ? 'bg-violet-500/5' : ''
                          }`}
                          style={{ width: QUARTER_WIDTH }}
                        >
                          <QuarterCell
                            initiatives={quarterInitiatives}
                            onClickInitiative={handleInitiativeClick}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
                {/* Bottom padding */}
                <div className="h-6" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuTimelineView;
