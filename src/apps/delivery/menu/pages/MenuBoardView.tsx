import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useMenuInitiatives } from '../hooks/useMenuInitiatives';
import { useForgeStatuses, usePlanningStages } from '../../../../hooks/useProductData';
import { supabase } from '../../../../lib/supabase';
import type { Initiative } from '../../../../types/product';
import DraggableCard from '../../../../components/DraggableCard';

type FilterType = 'current' | 'next' | 'backlog';
type StageKey = 'draft' | 'ready' | 'submitted' | 'accepted' | 'deferred';

interface FilterButtonProps {
  value: FilterType;
  label: string;
  active: boolean;
  onClick: () => void;
}

const FilterButton: React.FC<FilterButtonProps> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-boh-primary text-white'
        : 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg border border-boh-border-light dark:border-boh-border'
    }`}
  >
    {label}
  </button>
);

// Valid moves matrix: source -> allowed destinations
const VALID_MOVES: Record<StageKey, StageKey[]> = {
  draft: ['ready', 'deferred'],
  ready: ['draft', 'submitted', 'deferred'],
  submitted: ['accepted', 'deferred', 'draft'],
  accepted: ['deferred'], // Cannot go back once accepted
  deferred: ['draft'], // Can revive from deferred
};

const isValidMove = (source: StageKey, destination: StageKey): boolean => {
  if (source === destination) return false;
  return VALID_MOVES[source]?.includes(destination) ?? false;
};

interface UpdatePayload {
  planning_stage_id?: string | null;
  forge_status_id?: string | null;
  submitted_to_forge_at?: string | null;
  forge_reviewed_at?: string | null;
}

const getUpdatePayload = (
  destination: StageKey,
  planningStages: Array<{ id: string; key: string }> | undefined,
  forgeStatuses: Array<{ id: string; key: string }> | undefined
): UpdatePayload => {
  switch (destination) {
    case 'draft': {
      const draftStage = planningStages?.find(s => s.key === 'draft');
      return { planning_stage_id: draftStage?.id || null, forge_status_id: null, submitted_to_forge_at: null, forge_reviewed_at: null };
    }
    case 'ready': {
      const approvedStage = planningStages?.find(s => s.key === 'approved');
      return { planning_stage_id: approvedStage?.id || null };
    }
    case 'submitted': {
      const submittedStatus = forgeStatuses?.find(s => s.key === 'submitted');
      return { forge_status_id: submittedStatus?.id || null, submitted_to_forge_at: new Date().toISOString(), forge_reviewed_at: null };
    }
    case 'accepted': {
      const acceptedStatus = forgeStatuses?.find(s => s.key === 'accepted');
      return { forge_status_id: acceptedStatus?.id || null, forge_reviewed_at: new Date().toISOString() };
    }
    case 'deferred': {
      const deferredStatus = forgeStatuses?.find(s => s.key === 'deferred');
      return { forge_status_id: deferredStatus?.id || null, forge_reviewed_at: new Date().toISOString() };
    }
    default:
      return {};
  }
};

interface PipelineColumnProps {
  id: StageKey;
  title: string;
  count: number;
  children: React.ReactNode;
  isOver?: boolean;
  canDrop?: boolean;
}

const PipelineColumn: React.FC<PipelineColumnProps> = ({ id, title, count, children, isOver, canDrop }) => {
  const { setNodeRef } = useDroppable({
    id,
  });

  const getBorderColor = () => {
    if (isOver && canDrop) return 'border-boh-primary dark:border-boh-primary';
    if (isOver && !canDrop) return 'border-red-400 dark:border-red-400';
    return 'border-boh-border-light dark:border-boh-border';
  };

  return (
    <div
      ref={setNodeRef}
      onDragOver={(e) => e.preventDefault()}
      className={`flex flex-col w-[72vw] sm:w-[240px] lg:w-[250px] xl:w-[270px] flex-shrink-0 h-full min-h-0 overflow-hidden bg-boh-surface-light dark:bg-boh-surface rounded-lg border-2 ${getBorderColor()} transition-colors`}
    >
      {/* Column Header - Fixed */}
      <div className="px-3 py-2 border-b border-boh-border-light dark:border-boh-border flex justify-between items-center flex-shrink-0">
        <span className="text-sm font-semibold text-boh-text-light dark:text-boh-text">{title}</span>
        <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub opacity-60">{count}</span>
      </div>
      {/* Column Body - Internal Scroll with padding for scrollbar */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden boh-hide-scrollbars p-2.5 pr-1.5 pb-3 space-y-2">
        {children}
      </div>
    </div>
  );
};

const EmptyState: React.FC = () => (
  <div className="rounded-lg border border-dashed border-boh-border-light dark:border-boh-border p-4 text-center">
    <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">No initiatives</p>
  </div>
);

interface InitiativeCardProps {
  initiative: Initiative;
  isDragOverlay?: boolean;
}

const InitiativeCard: React.FC<InitiativeCardProps> = ({ initiative, isDragOverlay }) => {
  const navigate = useNavigate();
  
  // Determine readiness
  const isReady = initiative.owner_user_id && 
    initiative.target_quarter && 
    initiative.target_year && 
    (initiative.user_story_count || 0) > 0;

  // Handle opening the initiative
  const handleOpen = () => {
    navigate(`/menu/initiatives/${initiative.id}`);
  };

  return (
    <DraggableCard
      id={initiative.id}
      data={{ initiative }}
      title={initiative.title}
      onClick={handleOpen}
      isDragOverlay={isDragOverlay}
      className="min-h-[68px] sm:min-h-[72px] lg:min-h-[70px]"
      openButtonTooltip="Open initiative"
      dragHandleTooltip="Drag to move"
    >
      {/* Middle: App name + Owner */}
      <div className="space-y-1">
        <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub truncate leading-tight">
          {initiative.app?.name || 'No app'}
        </div>
        <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub opacity-70 truncate leading-tight">
          {initiative.owner_user?.full_name || 'No owner'}
        </div>
      </div>
    </DraggableCard>
  );
};

const MenuBoardView: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>('current');
  const { stageBuckets: initialStageBuckets, isLoading, error, mutate } = useMenuInitiatives();
  const { data: forgeStatuses } = useForgeStatuses();
  const { data: planningStages } = usePlanningStages();
  
  // Local state for optimistic updates
  const [stageBuckets, setStageBuckets] = useState<Record<StageKey, Initiative[]>>({
    draft: [],
    ready: [],
    submitted: [],
    accepted: [],
    deferred: [],
  });
  
  // Sync with initial data
  useEffect(() => {
    if (initialStageBuckets) {
      setStageBuckets(prev => ({
        ...prev,
        ...initialStageBuckets,
      }));
    }
  }, [initialStageBuckets]);
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeInitiative, setActiveInitiative] = useState<Initiative | null>(null);
  const [overColumn, setOverColumn] = useState<StageKey | null>(null);

  // Define column configuration
  const COLUMNS = useMemo(() => [
    { key: 'draft' as StageKey, label: 'Draft' },
    { key: 'ready' as StageKey, label: 'Ready to Submit' },
    { key: 'submitted' as StageKey, label: 'Submitted to Forge' },
    { key: 'accepted' as StageKey, label: 'Accepted by Forge' },
    { key: 'deferred' as StageKey, label: 'Deferred' },
  ], []);

  // Helper to check if initiative is ready to submit (same logic as hook)
  const isReadyToSubmit = useCallback((initiative: Initiative): boolean => {
    if (!initiative.owner_user_id) return false;
    if (!initiative.target_quarter || !initiative.target_year) return false;
    if (!initiative.user_story_count || initiative.user_story_count < 1) return false;
    return true;
  }, []);

  // Get initiative's current stage (aligned with hook's getPipelineBucket logic)
  const getInitiativeStage = useCallback((initiative: Initiative): StageKey => {
    const forgeKey = initiative.forge_status?.key;
    
    // Explicit forge statuses take precedence
    if (forgeKey === 'accepted') return 'accepted';
    if (forgeKey === 'submitted') return 'submitted';
    if (forgeKey === 'deferred') return 'deferred';
    
    // Check if explicitly marked as approved via planning_stage
    if (initiative.planning_stage?.key === 'approved') {
      return 'ready';
    }
    
    // For null or 'draft' forge status, check readiness criteria
    if (!forgeKey || forgeKey === 'draft') {
      if (isReadyToSubmit(initiative)) {
        return 'ready';
      }
      return 'draft';
    }
    
    return 'draft';
  }, [isReadyToSubmit]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    setActiveInitiative(active.data.current?.initiative as Initiative);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      setOverColumn(over.id as StageKey);
    } else {
      setOverColumn(null);
    }
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setActiveInitiative(null);
    setOverColumn(null);
    
    if (!over) return;
    
    const initiative = active.data.current?.initiative as Initiative;
    const sourceStage = getInitiativeStage(initiative);
    const destinationStage = over.id as StageKey;
    
    if (sourceStage === destinationStage) return;
    if (!isValidMove(sourceStage, destinationStage)) {
      console.warn(`Invalid move: ${sourceStage} -> ${destinationStage}`);
      return;
    }
    
    // Get update payload for backend
    const updatePayload = getUpdatePayload(destinationStage, planningStages, forgeStatuses);
    
    // Optimistic update - immediately move the card in local state
    setStageBuckets(prev => {
      const newBuckets = { ...prev };
      
      // Remove from source
      newBuckets[sourceStage] = newBuckets[sourceStage]?.filter(
        (i) => i.id !== initiative.id
      ) || [];
      
      // Create updated initiative with new stage fields
      const updatedInitiative = { ...initiative };
      if (updatePayload.planning_stage_id !== undefined) {
        updatedInitiative.planning_stage_id = updatePayload.planning_stage_id;
        // Also update the joined planning_stage object for immediate UI feedback
        if (updatePayload.planning_stage_id && planningStages) {
          const stage = planningStages.find(s => s.id === updatePayload.planning_stage_id);
          if (stage) {
            updatedInitiative.planning_stage = {
              id: stage.id,
              key: stage.key,
              label: '',
              sort_order: 0,
              is_active: true,
            };
          }
        } else if (updatePayload.planning_stage_id === null) {
          updatedInitiative.planning_stage = null;
        }
      }
      if (updatePayload.forge_status_id !== undefined) {
        updatedInitiative.forge_status_id = updatePayload.forge_status_id;
        // Also update the joined forge_status object for immediate UI feedback
        if (updatePayload.forge_status_id && forgeStatuses) {
          const status = forgeStatuses.find(s => s.id === updatePayload.forge_status_id);
          if (status) {
            updatedInitiative.forge_status = status;
          }
        } else if (updatePayload.forge_status_id === null) {
          updatedInitiative.forge_status = null;
        }
      }
      if (updatePayload.submitted_to_forge_at !== undefined) {
        updatedInitiative.submitted_to_forge_at = updatePayload.submitted_to_forge_at;
      }
      if (updatePayload.forge_reviewed_at !== undefined) {
        updatedInitiative.forge_reviewed_at = updatePayload.forge_reviewed_at;
      }
      
      // Add to destination
      newBuckets[destinationStage] = [
        ...(newBuckets[destinationStage] || []),
        updatedInitiative,
      ];
      
      return newBuckets;
    });
    
    // Persist to backend
    try {
      const { error } = await supabase
        .from('boh_initiative')
        .update(updatePayload)
        .eq('id', initiative.id);
      
      if (error) throw error;
      
      // Revalidate to ensure sync
      await mutate();
    } catch (error) {
      console.error('Failed to update initiative:', error);
      // Revert by revalidating - this will reset to server state
      await mutate();
    }
  }, [getInitiativeStage, mutate, planningStages, forgeStatuses]);

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-boh-bg-light dark:bg-boh-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-boh-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Loading pipeline...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-boh-bg-light p-6 dark:bg-boh-bg">
        <div className="rounded-lg border border-boh-border-light bg-boh-surface-light p-4 text-sm text-boh-text-light dark:border-boh-border dark:bg-boh-surface dark:text-boh-text">
          <h2 className="mb-1 font-semibold">Pipeline data could not load</h2>
          <p className="text-boh-text-sub-light dark:text-boh-text-sub">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-screen bg-boh-bg-light dark:bg-boh-bg overflow-hidden">
        {/* Header + Filter Bar */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
          <div className="flex items-center justify-between mb-3">
            <div>
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-sm mb-1">
                <span className="text-boh-text-light dark:text-boh-text font-medium">Menu</span>
                <span className="text-boh-text-sub-light dark:text-boh-text-sub">/</span>
                <span className="text-boh-text-sub-light dark:text-boh-text-sub">Menu-to-Forge Handoff</span>
              </nav>
              <h1 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Menu-to-Forge Handoff</h1>
            </div>
          </div>
          
          {/* Filter Bar */}
          <div className="flex gap-2">
            <FilterButton
              value="current"
              label="Current Quarter"
              active={filter === 'current'}
              onClick={() => setFilter('current')}
            />
            <FilterButton
              value="next"
              label="Next Quarter"
              active={filter === 'next'}
              onClick={() => setFilter('next')}
            />
            <FilterButton
              value="backlog"
              label="Backlog"
              active={filter === 'backlog'}
              onClick={() => setFilter('backlog')}
            />
          </div>
        </div>

        {/* Board - Horizontal Pipeline (vertical on mobile) */}
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden flex w-full px-4 pb-4">
          <div className="flex gap-3 h-full min-h-0 min-w-max max-md:flex-col max-md:min-w-0 max-md:h-auto pt-3 items-stretch">
            {COLUMNS.map((column) => {
              const initiatives = stageBuckets[column.key] || [];
              const isOver = overColumn === column.key;
              const sourceStage = activeInitiative ? getInitiativeStage(activeInitiative) : null;
              const canDrop = sourceStage ? isValidMove(sourceStage, column.key) : false;
              
              // Debug logging
              if (isOver && activeInitiative) {
                console.log('[DndDebug]', {
                  sourceStage,
                  destinationStage: column.key,
                  canDrop,
                  initiativeId: activeInitiative.id,
                  forgeStatus: activeInitiative.forge_status?.key,
                  planningStage: activeInitiative.planning_stage?.key,
                  isReady: activeInitiative.owner_user_id && activeInitiative.target_quarter && activeInitiative.target_year && (activeInitiative.user_story_count || 0) > 0,
                });
              }
              
              return (
                <PipelineColumn
                  key={column.key}
                  id={column.key}
                  title={column.label}
                  count={initiatives.length}
                  isOver={isOver}
                  canDrop={canDrop}
                >
                  {initiatives.length === 0 ? (
                    <EmptyState />
                  ) : (
                    initiatives.map((initiative) => (
                      <InitiativeCard 
                        key={initiative.id} 
                        initiative={initiative} 
                      />
                    ))
                  )}
                </PipelineColumn>
              );
            })}
          </div>
        </div>
      </div>
      
      <DragOverlay dropAnimation={dropAnimation}>
        {activeInitiative ? (
          <InitiativeCard initiative={activeInitiative} isDragOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default MenuBoardView;
