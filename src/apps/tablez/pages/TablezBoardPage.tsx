import React, { useState, useEffect } from 'react';
import type { TablezTask, TablezTaskStatus, TablezTaskPriority, TablezProject } from '../types';
import {
  fetchTaskStatuses,
  fetchTaskPriorities,
  fetchMyTasksForBoard,
  fetchAllTasksForBoard,
  fetchTodayTasks,
  fetchProjects,
  updateTaskStatus,
  createTask,
  updateTask,
  getCurrentUserId
} from '../api/tablezTasksApi';
import KanbanBoard from '../components/KanbanBoard';
import TasksListView from '../components/TasksListView';
import PaginationControls from '../components/PaginationControls.tsx';
import TaskModal from '../components/TaskModal';
import Alert from '../components/Alert';
import { useActiveChair } from '../hooks/useActiveChair';
import { fetchActiveTables, fetchChairsForTable, type BohChairWithUser, type BohTableOption } from '../api/tablezContextApi';
import { supabase } from '../../../lib/supabase';

const VIEW_MODE_KEY = 'tablez_view_mode';

// Hook to detect mobile viewport (< 768px, which is Tailwind's md breakpoint)
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}

const TablezBoardPage: React.FC = () => {
  const [statuses, setStatuses] = useState<TablezTaskStatus[]>([]);
  const [priorities, setPriorities] = useState<TablezTaskPriority[]>([]);
  const [projects, setProjects] = useState<TablezProject[]>([]);
  const [tasks, setTasks] = useState<TablezTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    return (saved === 'list' || saved === 'kanban') ? saved : 'kanban';
  });
  const [filter, setFilter] = useState<'all' | 'today'>('all');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TablezTask | null>(null);
  const [defaultStatusId, setDefaultStatusId] = useState<string | undefined>();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [isBulkSelectMode, setIsBulkSelectMode] = useState<boolean>(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkTables, setBulkTables] = useState<BohTableOption[]>([]);
  const [bulkChairs, setBulkChairs] = useState<BohChairWithUser[]>([]);
  const [bulkSelectedTableId, setBulkSelectedTableId] = useState<string>('');
  const [bulkSelectedChairId, setBulkSelectedChairId] = useState<string>('');
  const [bulkError, setBulkError] = useState<string>('');

  const [assignedScope, setAssignedScope] = useState<'me' | 'all'>('me');
  const [quickFilter, setQuickFilter] = useState<'all' | 'outstanding' | 'closed' | 'dueSoon' | 'overdue'>('outstanding');
  const [onlyThisChairTable, setOnlyThisChairTable] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');

  // List view pagination (client-side)
  const [listPage, setListPage] = useState<number>(1);
  const [listPageSize, setListPageSize] = useState<10 | 25 | 50 | 100>(10);

  // Mobile detection
  const isMobile = useIsMobile();
  
  // Effective view mode: force 'list' on mobile, otherwise use stored viewMode
  const effectiveViewMode = isMobile ? 'list' : viewMode;

  const {
    chairs,
    activeChairId,
    setActiveChairId,
    activeTableId,
    activeSectionId,
    isLoading: isChairLoading,
  } = useActiveChair(currentUserId);

  useEffect(() => {
    if (chairs.length === 0 && onlyThisChairTable) {
      setOnlyThisChairTable(false);
    }
  }, [chairs.length, onlyThisChairTable]);

  // Reset list pagination when filter or view mode changes
  useEffect(() => {
    setListPage(1);
  }, [filter, effectiveViewMode, assignedScope, quickFilter, onlyThisChairTable, debouncedSearchQuery]);

  useEffect(() => {
    if (effectiveViewMode !== 'list') {
      setIsBulkSelectMode(false);
      setSelectedTaskIds(new Set());
      setBulkSelectedTableId('');
      setBulkSelectedChairId('');
      setBulkError('');
    }
  }, [effectiveViewMode]);

  // Debounce search input
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Get current user ID
        const userId = await getCurrentUserId();
        if (!userId) {
          throw new Error('User not authenticated');
        }
        setCurrentUserId(userId);

        // Chair/table/section context is derived separately.

        // Fetch all data in parallel
        const [statusesData, prioritiesData, projectsData] = await Promise.all([
          fetchTaskStatuses(),
          fetchTaskPriorities(),
          fetchProjects(),
        ]);

        setStatuses(statusesData);
        setPriorities(prioritiesData);
        setProjects(projectsData);

        // Load tasks based on filter
        const tasksData = filter === 'today'
          ? await fetchTodayTasks(userId)
          : (assignedScope === 'all' ? await fetchAllTasksForBoard() : await fetchMyTasksForBoard(userId));
        setTasks(tasksData);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [filter, assignedScope]);

  // Persist view mode to localStorage
  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  const closedStatusIds = React.useMemo(() => {
    const closedKeys = new Set(['done', 'completed', 'closed']);
    const closedLabelRegex = /(done|complete|closed)/i;

    return new Set(
      statuses
        .filter((s) => closedKeys.has((s.key || '').toLowerCase()) || closedLabelRegex.test(s.label || ''))
        .map((s) => s.id)
    );
  }, [statuses]);

  const projectNameById = React.useMemo(() => {
    return new Map(projects.map(p => [p.id, p.name] as const));
  }, [projects]);

  // Scoped tasks for TOP counts:
  // Includes search + optional chair/table scope, but does NOT apply the quick filter.
  // (So the counts remain useful regardless of which quick filter is selected.)
  const scopedTasksForCounts = React.useMemo(() => {
    const q = debouncedSearchQuery.toLowerCase();

    return tasks.filter((t) => {
      if (onlyThisChairTable) {
        if (activeTableId) {
          if (t.table_id !== activeTableId) return false;
        } else if (activeChairId) {
          if (t.chair_id !== activeChairId) return false;
        }
      }

      if (!q) return true;
      const projectName = t.tablez_project_id ? (projectNameById.get(t.tablez_project_id) || '') : '';
      const haystack = `${t.title || ''} ${t.description || ''} ${projectName}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [activeChairId, activeTableId, debouncedSearchQuery, onlyThisChairTable, projectNameById, tasks]);

  const scopedCounts = React.useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const dueSoonEnd = new Date(todayStart);
    dueSoonEnd.setDate(dueSoonEnd.getDate() + 3);
    dueSoonEnd.setHours(23, 59, 59, 999);

    let outstandingCount = 0;
    let closedCount = 0;
    let overdueCount = 0;
    let dueSoonCount = 0;

    for (const t of scopedTasksForCounts) {
      const isClosed = closedStatusIds.has(t.status_id);
      if (isClosed) {
        closedCount += 1;
        continue;
      }

      outstandingCount += 1;

      if (t.due_date) {
        const due = new Date(t.due_date);
        if (due < todayStart) overdueCount += 1;
        if (due >= todayStart && due <= dueSoonEnd) dueSoonCount += 1;
      }
    }

    return {
      totalCount: scopedTasksForCounts.length,
      outstandingCount,
      closedCount,
      overdueCount,
      dueSoonCount,
    };
  }, [closedStatusIds, scopedTasksForCounts]);

  const filteredTasks = React.useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const dueSoonEnd = new Date(todayStart);
    dueSoonEnd.setDate(dueSoonEnd.getDate() + 3);
    dueSoonEnd.setHours(23, 59, 59, 999);

    const q = debouncedSearchQuery.toLowerCase();

    return tasks.filter((t) => {
      const isClosed = closedStatusIds.has(t.status_id);

      if (quickFilter === 'all') {
        // no status/date filtering
      } else {
        if (quickFilter === 'closed' && !isClosed) return false;
        if (quickFilter === 'outstanding' && isClosed) return false;

        if (quickFilter === 'dueSoon') {
          if (isClosed) return false;
          if (!t.due_date) return false;
          const due = new Date(t.due_date);
          return due >= todayStart && due <= dueSoonEnd;
        }

        if (quickFilter === 'overdue') {
          if (isClosed) return false;
          if (!t.due_date) return false;
          const due = new Date(t.due_date);
          return due < todayStart;
        }
      }

      if (onlyThisChairTable) {
        if (activeTableId) {
          if (t.table_id !== activeTableId) return false;
        } else if (activeChairId) {
          if (t.chair_id !== activeChairId) return false;
        }
      }

      if (!q) return true;
      const projectName = t.tablez_project_id ? (projectNameById.get(t.tablez_project_id) || '') : '';
      const haystack = `${t.title || ''} ${t.description || ''} ${projectName}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [activeChairId, activeTableId, closedStatusIds, debouncedSearchQuery, onlyThisChairTable, projectNameById, quickFilter, tasks]);

  const totalTasks = filteredTasks.length;
  const totalPages = Math.max(1, Math.ceil(totalTasks / listPageSize));

  // Ensure current page is always valid after any task count changes
  useEffect(() => {
    if (listPage > totalPages) {
      setListPage(totalPages);
    }
  }, [listPage, totalPages]);

  const pagedTasks = React.useMemo(() => {
    if (effectiveViewMode !== 'list') return filteredTasks;
    const startIndex = (listPage - 1) * listPageSize;
    return filteredTasks.slice(startIndex, startIndex + listPageSize);
  }, [effectiveViewMode, filteredTasks, listPage, listPageSize]);

  const handleStatusChange = async (taskId: string, statusId: string) => {
    // Optimistically update UI first for immediate feedback
    const previousTasks = tasks;
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, status_id: statusId } : task
      )
    );

    try {
      await updateTaskStatus(taskId, statusId);
    } catch (err) {
      console.error('Error updating task status:', err);
      // Revert optimistic update on error
      setTasks(previousTasks);
      // Reload tasks from server to ensure consistency
      if (currentUserId) {
        const refreshedTasks = await fetchMyTasksForBoard(currentUserId);
        setTasks(refreshedTasks);
      }
    }
  };

  const handleCreateTask = (statusId: string) => {
    setDefaultStatusId(statusId);
    setSelectedTask(null);
    setIsTaskModalOpen(true);
  };

  const handleTaskClick = (task: TablezTask) => {
    setSelectedTask(task);
    setDefaultStatusId(undefined);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async (taskData: Partial<TablezTask>) => {
    if (!currentUserId) {
      throw new Error('Missing required context');
    }

    if (!taskData.section_id || !taskData.table_id) {
      throw new Error('Missing required table context');
    }

    if (selectedTask) {
      // Update existing task
      const updated = await updateTask(selectedTask.id, taskData);
      setTasks(prevTasks =>
        prevTasks.map(task => task.id === updated.id ? updated : task)
      );
    } else {
      // Create new task
      const newTask = await createTask({
        ...taskData,
        assigned_to: currentUserId,
        created_by: currentUserId,
        section_id: taskData.section_id,
        table_id: taskData.table_id,
        status_id: taskData.status_id!,
        priority_id: taskData.priority_id!,
      } as any);
      setTasks(prevTasks => [...prevTasks, newTask]);
    }
  };

  const selectedTasks = React.useMemo(() => {
    if (selectedTaskIds.size === 0) return [];
    const ids = selectedTaskIds;
    return tasks.filter(t => ids.has(t.id));
  }, [selectedTaskIds, tasks]);

  const selectedCommonTableId = React.useMemo(() => {
    if (selectedTasks.length === 0) return null;
    const first = selectedTasks[0]?.table_id;
    if (!first) return null;
    for (const t of selectedTasks) {
      if (t.table_id !== first) return null;
    }
    return first;
  }, [selectedTasks]);

  useEffect(() => {
    let mounted = true;
    async function loadBulkTables() {
      if (!isBulkSelectMode) return;
      try {
        const t = await fetchActiveTables();
        if (!mounted) return;
        setBulkTables(t);
      } catch (err) {
        console.error('[TablezBoard] bulk tables load error', err);
        if (!mounted) return;
        setBulkTables([]);
      }
    }
    void loadBulkTables();
    return () => {
      mounted = false;
    };
  }, [isBulkSelectMode]);

  useEffect(() => {
    let mounted = true;
    async function loadBulkChairs() {
      if (!isBulkSelectMode) return;

      const tableForChair = bulkSelectedTableId || selectedCommonTableId;
      if (!tableForChair) {
        setBulkChairs([]);
        return;
      }

      try {
        const c = await fetchChairsForTable(tableForChair);
        if (!mounted) return;
        setBulkChairs(c);
      } catch (err) {
        console.error('[TablezBoard] bulk chairs load error', err);
        if (!mounted) return;
        setBulkChairs([]);
      }
    }
    void loadBulkChairs();
    return () => {
      mounted = false;
    };
  }, [bulkSelectedTableId, isBulkSelectMode, selectedCommonTableId]);

  const toggleSelectedTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const clearBulkSelection = () => {
    setSelectedTaskIds(new Set());
    setBulkSelectedTableId('');
    setBulkSelectedChairId('');
    setBulkError('');
  };

  const applyBulkChangeTable = async () => {
    setBulkError('');
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;
    if (!bulkSelectedTableId) {
      setBulkError('Select a table to apply.');
      return;
    }

    const table = bulkTables.find(t => t.id === bulkSelectedTableId) || null;
    if (!table?.section_id) {
      setBulkError('Selected table is missing a section.');
      return;
    }

    const previous = tasks;
    setTasks(prev => prev.map(t => selectedTaskIds.has(t.id)
      ? { ...t, table_id: table.id, section_id: table.section_id as string, chair_id: null }
      : t
    ));

    try {
      const { error } = await supabase
        .from('tablez_task')
        .update({ table_id: table.id, section_id: table.section_id, chair_id: null, updated_at: new Date().toISOString() })
        .in('id', ids);

      if (error) throw error;
      clearBulkSelection();
    } catch (err) {
      console.error('[TablezBoard] bulk change table error', err);
      setTasks(previous);
      setBulkError(err instanceof Error ? err.message : 'Bulk update failed');
    }
  };

  const applyBulkChangeChair = async () => {
    setBulkError('');
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;

    const tableForChair = bulkSelectedTableId || selectedCommonTableId;
    if (!tableForChair) {
      setBulkError('Select a table first (tasks span multiple tables).');
      return;
    }

    if (!bulkSelectedChairId) {
      setBulkError('Select a chair to apply.');
      return;
    }

    const previous = tasks;
    setTasks(prev => prev.map(t => selectedTaskIds.has(t.id)
      ? { ...t, chair_id: bulkSelectedChairId }
      : t
    ));

    try {
      const { error } = await supabase
        .from('tablez_task')
        .update({ chair_id: bulkSelectedChairId, updated_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
      clearBulkSelection();
    } catch (err) {
      console.error('[TablezBoard] bulk change chair error', err);
      setTasks(previous);
      setBulkError(err instanceof Error ? err.message : 'Bulk update failed');
    }
  };

  const applyBulkClearChair = async () => {
    setBulkError('');
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;

    const previous = tasks;
    setTasks(prev => prev.map(t => selectedTaskIds.has(t.id)
      ? { ...t, chair_id: null }
      : t
    ));

    try {
      const { error } = await supabase
        .from('tablez_task')
        .update({ chair_id: null, updated_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
      clearBulkSelection();
    } catch (err) {
      console.error('[TablezBoard] bulk clear chair error', err);
      setTasks(previous);
      setBulkError(err instanceof Error ? err.message : 'Bulk update failed');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading tasks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="error">Error: {error}</Alert>
      </div>
    );
  }

  return (
    <div className={`flex-1 w-full ${effectiveViewMode === 'list' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col min-h-0">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wide mb-1">Tablez</div>
              <h2 className="text-2xl font-bold text-boh-text-light dark:text-boh-text mb-1">Tasks Board</h2>
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">{isMobile ? 'Manage your tasks in List view' : 'Manage your tasks in Kanban or List view'}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Filter chips - Only show on desktop */}
              {!isMobile && (
                <div className="flex bg-boh-surface-light dark:bg-boh-surface rounded-lg p-1 mr-2">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      filter === 'all'
                        ? 'bg-boh-surface-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text shadow-sm'
                        : 'text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:text-boh-text dark:hover:text-boh-text'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilter('today')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      filter === 'today'
                        ? 'bg-boh-surface-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text shadow-sm'
                        : 'text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:text-boh-text dark:hover:text-boh-text'
                    }`}
                  >
                    Today
                  </button>
                </div>
              )}
              {/* View Toggle - Only show on desktop */}
              {!isMobile && (
                <div className="flex bg-boh-surface-light dark:bg-boh-surface rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('kanban')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'kanban'
                        ? 'bg-primary text-white'
                        : 'text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:text-boh-text dark:hover:text-boh-text'
                    }`}
                  >
                    Kanban
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'list'
                        ? 'bg-primary text-white'
                        : 'text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:text-boh-text dark:hover:text-boh-text'
                    }`}
                  >
                    List
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks"
                className="w-full md:max-w-md px-3 py-2 text-sm border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              {effectiveViewMode === 'list' && (
                <button
                  type="button"
                  onClick={() => {
                    setBulkError('');
                    setIsBulkSelectMode((prev) => {
                      const next = !prev;
                      if (!next) {
                        clearBulkSelection();
                      }
                      return next;
                    });
                  }}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    isBulkSelectMode
                      ? 'bg-primary text-white border-primary'
                      : 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text-sub border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border'
                  }`}
                >
                  {isBulkSelectMode ? 'Done' : 'Select'}
                </button>
              )}

              <div className="flex bg-boh-surface-light dark:bg-boh-surface rounded-lg p-1 w-full md:w-auto">
                <button
                  onClick={() => setQuickFilter('all')}
                  className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    quickFilter === 'all'
                      ? 'bg-boh-surface-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text shadow-sm'
                      : 'text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:text-boh-text dark:hover:text-boh-text'
                  }`}
                >
                  All ({scopedCounts.totalCount})
                </button>
                <button
                  onClick={() => setQuickFilter('outstanding')}
                  className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    quickFilter === 'outstanding'
                      ? 'bg-boh-surface-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text shadow-sm'
                      : 'text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:text-boh-text dark:hover:text-boh-text'
                  }`}
                >
                  Outstanding ({scopedCounts.outstandingCount})
                </button>
                <button
                  onClick={() => setQuickFilter('overdue')}
                  className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    quickFilter === 'overdue'
                      ? 'bg-boh-surface-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text shadow-sm'
                      : 'text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:text-boh-text dark:hover:text-boh-text'
                  }`}
                >
                  Overdue ({scopedCounts.overdueCount})
                </button>
                <button
                  onClick={() => setQuickFilter('dueSoon')}
                  className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    quickFilter === 'dueSoon'
                      ? 'bg-boh-surface-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text shadow-sm'
                      : 'text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:text-boh-text dark:hover:text-boh-text'
                  }`}
                >
                  Due Soon ({scopedCounts.dueSoonCount})
                </button>
                <button
                  onClick={() => setQuickFilter('closed')}
                  className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    quickFilter === 'closed'
                      ? 'bg-boh-surface-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text shadow-sm'
                      : 'text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:text-boh-text dark:hover:text-boh-text'
                  }`}
                >
                  Closed ({scopedCounts.closedCount})
                </button>
              </div>

              <div className="flex bg-boh-surface-light dark:bg-boh-surface rounded-lg p-1">
                <button
                  onClick={() => setAssignedScope('me')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    assignedScope === 'me'
                      ? 'bg-boh-surface-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text shadow-sm'
                      : 'text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:text-boh-text dark:hover:text-boh-text'
                  }`}
                >
                  Assigned to Me
                </button>
                <button
                  onClick={() => setAssignedScope('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    assignedScope === 'all'
                      ? 'bg-boh-surface-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text shadow-sm'
                      : 'text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:text-boh-text dark:hover:text-boh-text'
                  }`}
                >
                  All
                </button>
              </div>

              {chairs.length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">Chair</label>
                    <select
                      value={activeChairId || ''}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        if (!nextId) return;
                        setActiveChairId(nextId);
                      }}
                      disabled={isChairLoading}
                      className="text-sm border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border rounded-md px-2 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text-sub focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {chairs.map((c, idx) => (
                        <option key={c.id} value={c.id}>
                          {c.chair_role_label ?? '—'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                    <input
                      type="checkbox"
                      checked={onlyThisChairTable}
                      onChange={(e) => setOnlyThisChairTable(e.target.checked)}
                      className="rounded border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border"
                    />
                    Only this chair/table
                  </label>
                </>
              )}
            </div>
          </div>

          {effectiveViewMode === 'list' && isBulkSelectMode && selectedTaskIds.size > 0 && (
            <div className="mt-3 p-3 border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-boh-text-light dark:text-boh-text-sub">
                  {selectedTaskIds.size} selected
                </div>

                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <select
                    value={bulkSelectedTableId}
                    onChange={(e) => {
                      setBulkSelectedTableId(e.target.value);
                      setBulkSelectedChairId('');
                      setBulkError('');
                    }}
                    className="text-sm border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border rounded-md px-2 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text-sub"
                  >
                    <option value="">Change Table…</option>
                    {bulkTables.map((t) => {
                      const label = t.section_name ? `${t.section_name} • ${t.name || 'Unnamed table'}` : (t.name || 'Unnamed table');
                      return (
                        <option key={t.id} value={t.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>

                  <button
                    type="button"
                    onClick={applyBulkChangeTable}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-primary text-white"
                  >
                    Apply Table
                  </button>

                  <select
                    value={bulkSelectedChairId}
                    onChange={(e) => {
                      setBulkSelectedChairId(e.target.value);
                      setBulkError('');
                    }}
                    className="text-sm border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border rounded-md px-2 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text-sub"
                    disabled={!(bulkSelectedTableId || selectedCommonTableId)}
                  >
                    <option value="">Change Chair…</option>
                    {bulkChairs.map((c, idx) => {
                      const who = c.user?.full_name || c.user?.email || '';
                      const baseLabel = c.chair_role_label ?? '—';
                      const label = who ? `${baseLabel} — ${who}` : baseLabel;
                      return (
                        <option key={c.id} value={c.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>

                  <button
                    type="button"
                    onClick={applyBulkChangeChair}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-primary text-white"
                    disabled={!bulkSelectedChairId}
                  >
                    Apply Chair
                  </button>

                  <button
                    type="button"
                    onClick={applyBulkClearChair}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text-sub border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border"
                  >
                    Clear Chair
                  </button>
                </div>
              </div>

              {bulkError && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {bulkError}
                </div>
              )}
            </div>
          )}
        </header>

        {/* Board Content */}
        <div className="flex-1 min-h-0">
          {!isMobile && effectiveViewMode === 'kanban' ? (
            <KanbanBoard
              statuses={statuses}
              tasks={tasks}
              priorities={priorities}
              projects={projects}
              onChangeStatus={handleStatusChange}
              onCreateTask={handleCreateTask}
              onTaskClick={handleTaskClick}
              isMobile={isMobile}
              effectiveViewMode={effectiveViewMode}
            />
          ) : (
            <div className="flex flex-col min-h-0 h-full">
              <div className="flex-1 min-h-0">
                <TasksListView
                  tasks={pagedTasks}
                  statuses={statuses}
                  priorities={priorities}
                  projects={projects}
                  onChangeStatus={handleStatusChange}
                  onTaskClick={handleTaskClick}
                  isBulkSelectMode={isBulkSelectMode}
                  selectedTaskIds={selectedTaskIds}
                  onToggleSelectTask={toggleSelectedTask}
                />
              </div>
              <PaginationControls
                className="mt-3"
                currentPage={listPage}
                pageSize={listPageSize}
                totalItems={totalTasks}
                pageSizeOptions={[10, 25, 50, 100]}
                onPageChange={(nextPage) => setListPage(nextPage)}
                onPageSizeChange={(nextPageSize) => {
                  setListPageSize(nextPageSize);
                  setListPage(1);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Task Modal */}
      {currentUserId && (
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
            setDefaultStatusId(undefined);
          }}
          onSave={handleSaveTask}
          task={selectedTask}
          statuses={statuses}
          priorities={priorities}
          projects={projects}
          defaultStatusId={defaultStatusId}
          currentUserId={currentUserId}
          chairId={activeChairId}
        />
      )}
    </div>
  );
};

export default TablezBoardPage;

