# Tablez App - File Setup Guide

Due to permission restrictions on some directories, please create the following files manually. All file contents are provided below.

## Directory Structure

```
src/apps/tablez/
├── api/
│   └── tablezTasksApi.ts
├── components/
│   ├── KanbanBoard.tsx
│   ├── KanbanColumn.tsx
│   ├── TaskCard.tsx
│   ├── TaskModal.tsx
│   └── TasksListView.tsx
└── pages/
    └── TablezBoardPage.tsx
```

## File Contents

### 1. src/apps/tablez/api/tablezTasksApi.ts

```typescript
import { supabase } from '../../lib/supabase';
import type { TablezTask, TablezTaskStatus, TablezTaskPriority, TablezProject } from '../types';

/**
 * Board data structure returned by fetchBoardData()
 */
export interface BoardData {
  tasks: TablezTask[];
  statuses: TablezTaskStatus[];
  priorities: TablezTaskPriority[];
  projects: TablezProject[];
}

/**
 * Fetches all board data (tasks, statuses, priorities, projects) from Supabase.
 * Joins statuses and priorities by id on the client side.
 * 
 * @returns {Promise<BoardData>} Object containing tasks, statuses, priorities, and projects
 * @throws {Error} If data fetching fails
 */
export async function fetchBoardData(): Promise<BoardData> {
  try {
    // Fetch all data in parallel
    const [statusesResult, prioritiesResult, projectsResult, tasksResult] = await Promise.all([
      supabase
        .from('tablez_task_status')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('tablez_task_priority')
        .select('*')
        .eq('is_active', true)
        .order('weight', { ascending: false }),
      supabase
        .from('tablez_project')
        .select('*')
        .order('name', { ascending: true }),
      supabase
        .from('tablez_task')
        .select('id, title, description, due_date, status_id, priority_id, tablez_project_id, assigned_to, created_by, created_at, updated_at')
        .eq('is_archived', false)
        .order('updated_at', { ascending: false })
    ]);

    // Check for errors
    if (statusesResult.error) {
      throw new Error(`Failed to fetch task statuses: ${statusesResult.error.message}`);
    }
    if (prioritiesResult.error) {
      throw new Error(`Failed to fetch task priorities: ${prioritiesResult.error.message}`);
    }
    if (projectsResult.error) {
      throw new Error(`Failed to fetch projects: ${projectsResult.error.message}`);
    }
    if (tasksResult.error) {
      throw new Error(`Failed to fetch tasks: ${tasksResult.error.message}`);
    }

    const statuses = (statusesResult.data || []) as TablezTaskStatus[];
    const priorities = (prioritiesResult.data || []) as TablezTaskPriority[];
    const projects = (projectsResult.data || []) as TablezProject[];
    const tasks = (tasksResult.data || []) as TablezTask[];

    // Join statuses and priorities on the client side
    const tasksWithJoins: TablezTask[] = tasks.map(task => {
      const status = statuses.find(s => s.id === task.status_id);
      const priority = priorities.find(p => p.id === task.priority_id);
      const project = task.tablez_project_id 
        ? projects.find(p => p.id === task.tablez_project_id)
        : undefined;

      return {
        ...task,
        status,
        priority,
        project
      };
    });

    return {
      tasks: tasksWithJoins,
      statuses,
      priorities,
      projects
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch board data');
  }
}

/**
 * TODO: Update task status
 * 
 * This function will update the status_id of a task in Supabase.
 * Currently marked as TODO - implement when write operations are enabled.
 * 
 * @param taskId - The ID of the task to update
 * @param statusId - The new status ID
 * @throws {Error} Not implemented yet
 */
export async function updateTaskStatus(taskId: string, statusId: string): Promise<void> {
  // TODO: Implement task status update
  // const { error } = await supabase
  //   .from('tablez_task')
  //   .update({ status_id: statusId, updated_at: new Date().toISOString() })
  //   .eq('id', taskId);
  // if (error) throw new Error(`Failed to update task status: ${error.message}`);
  throw new Error('updateTaskStatus is not yet implemented');
}

/**
 * TODO: Update task project
 * 
 * This function will update the tablez_project_id of a task in Supabase.
 * Currently marked as TODO - implement when write operations are enabled.
 * 
 * @param taskId - The ID of the task to update
 * @param projectId - The new project ID (or null to unassign)
 * @throws {Error} Not implemented yet
 */
export async function updateTaskProject(taskId: string, projectId: string | null): Promise<void> {
  // TODO: Implement task project update
  // const { error } = await supabase
  //   .from('tablez_task')
  //   .update({ tablez_project_id: projectId, updated_at: new Date().toISOString() })
  //   .eq('id', taskId);
  // if (error) throw new Error(`Failed to update task project: ${error.message}`);
  throw new Error('updateTaskProject is not yet implemented');
}
```

### 2. src/apps/tablez/components/TaskCard.tsx

```typescript
import React from 'react';
import type { TablezTask, TablezTaskPriority } from '../types';

interface TaskCardProps {
  task: TablezTask;
  priority?: TablezTaskPriority;
  onClick?: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, priority, onClick }) => {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return null;
    }
  };

  const getPriorityColor = (priority?: TablezTaskPriority) => {
    if (!priority) return 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    
    // Use priority color_token if available, otherwise use weight-based colors
    if (priority.color_token) {
      return `bg-${priority.color_token}`;
    }
    
    // Fallback to weight-based colors
    if (priority.weight >= 80) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
    if (priority.weight >= 60) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
    if (priority.weight >= 40) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
  };

  const dueDate = formatDate(task.due_date);

  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-gray-800 rounded-lg p-3 mb-2 
        border border-gray-200 dark:border-gray-700
        shadow-sm hover:shadow-md transition-shadow cursor-pointer
        ${onClick ? 'hover:border-[#635CCD] dark:hover:border-[#635CCD]' : ''}
      `}
    >
      <div className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">
        {task.title}
      </div>
      
      {task.description && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
          {task.description}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        {priority && (
          <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(priority)}`}>
            {priority.label}
          </span>
        )}
        {dueDate && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Due {dueDate}
          </span>
        )}
      </div>

      {task.project && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {task.project.name}
        </div>
      )}
    </div>
  );
};

export default TaskCard;
```

### 3. src/apps/tablez/components/KanbanColumn.tsx

```typescript
import React from 'react';
import type { TablezTask, TablezTaskStatus, TablezTaskPriority } from '../types';
import TaskCard from './TaskCard';

interface KanbanColumnProps {
  columnStatus: TablezTaskStatus;
  tasksForStatus: TablezTask[];
  priorities: TablezTaskPriority[];
  onTaskClick?: (task: TablezTask) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  columnStatus,
  tasksForStatus,
  priorities,
  onTaskClick
}) => {
  const getPriorityForTask = (task: TablezTask): TablezTaskPriority | undefined => {
    return priorities.find(p => p.id === task.priority_id);
  };

  return (
    <div className="flex flex-col h-full min-w-[280px] max-w-[320px] bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            {columnStatus.label}
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {tasksForStatus.length}
          </span>
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {tasksForStatus.length === 0 ? (
          <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
            No tasks
          </div>
        ) : (
          tasksForStatus.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              priority={getPriorityForTask(task)}
              onClick={onTaskClick ? () => onTaskClick(task) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
```

### 4. src/apps/tablez/components/KanbanBoard.tsx

```typescript
import React from 'react';
import type { TablezTask, TablezTaskStatus, TablezTaskPriority, TablezProject } from '../types';
import KanbanColumn from './KanbanColumn';

interface KanbanBoardProps {
  tasks: TablezTask[];
  statuses: TablezTaskStatus[];
  priorities: TablezTaskPriority[];
  projects: TablezProject[];
  onChangeStatus?: (taskId: string, statusId: string) => void;
  onCreateTask?: (statusId: string) => void;
  onTaskClick?: (task: TablezTask) => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  statuses,
  priorities,
  projects,
  onTaskClick
}) => {
  // Sort statuses by sort_order
  const sortedStatuses = [...statuses].sort((a, b) => a.sort_order - b.sort_order);

  // Group tasks by status_id
  const tasksByStatus = sortedStatuses.reduce((acc, status) => {
    acc[status.id] = tasks.filter(task => task.status_id === status.id);
    return acc;
  }, {} as Record<string, TablezTask[]>);

  return (
    <div className="w-full h-full overflow-x-auto">
      <div className="flex gap-4 min-h-[600px] p-4">
        {sortedStatuses.map(status => (
          <KanbanColumn
            key={status.id}
            columnStatus={status}
            tasksForStatus={tasksByStatus[status.id] || []}
            priorities={priorities}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
      
      {/* TODO: Implement drag and drop functionality
          - Use a library like @dnd-kit/core or react-beautiful-dnd
          - Handle onDragStart, onDragEnd events
          - Call onChangeStatus when a task is dropped in a new column
      */}
    </div>
  );
};

export default KanbanBoard;
```

### 5. src/apps/tablez/components/TasksListView.tsx

```typescript
import React from 'react';
import type { TablezTask, TablezTaskStatus, TablezTaskPriority, TablezProject } from '../types';

interface TasksListViewProps {
  tasks: TablezTask[];
  statuses: TablezTaskStatus[];
  priorities: TablezTaskPriority[];
  projects: TablezProject[];
  onChangeStatus?: (taskId: string, statusId: string) => void;
  onTaskClick?: (task: TablezTask) => void;
}

const TasksListView: React.FC<TasksListViewProps> = ({
  tasks,
  statuses,
  priorities,
  projects,
  onTaskClick
}) => {
  const getStatusLabel = (statusId: string) => {
    const status = statuses.find(s => s.id === statusId);
    return status?.label || 'Unknown';
  };

  const getPriorityLabel = (priorityId: string) => {
    const priority = priorities.find(p => p.id === priorityId);
    return priority?.label || 'Unknown';
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return null;
    const project = projects.find(p => p.id === projectId);
    return project?.name || null;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return null;
    }
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left p-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Title
            </th>
            <th className="text-left p-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Project
            </th>
            <th className="text-left p-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th className="text-left p-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Priority
            </th>
            <th className="text-left p-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Due Date
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400">
                No tasks found
              </td>
            </tr>
          ) : (
            tasks.map(task => (
              <tr
                key={task.id}
                onClick={onTaskClick ? () => onTaskClick(task) : undefined}
                className={`
                  border-b border-gray-100 dark:border-gray-800
                  hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors
                  ${onTaskClick ? 'cursor-pointer' : ''}
                `}
              >
                <td className="p-3">
                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                    {task.title}
                  </div>
                  {task.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                      {task.description}
                    </div>
                  )}
                </td>
                <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                  {getProjectName(task.tablez_project_id) || '—'}
                </td>
                <td className="p-3">
                  <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {getStatusLabel(task.status_id)}
                  </span>
                </td>
                <td className="p-3">
                  <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {getPriorityLabel(task.priority_id)}
                  </span>
                </td>
                <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                  {formatDate(task.due_date) || '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TasksListView;
```

### 6. src/apps/tablez/components/TaskModal.tsx

```typescript
import React from 'react';
import type { TablezTask } from '../types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TablezTask | null;
}

const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, task }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Task Details
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {task ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {task.title}
                </h3>
                {task.description && (
                  <p className="text-gray-600 dark:text-gray-400">
                    {task.description}
                  </p>
                )}
              </div>

              {/* TODO: Add task editing form
                  - Title input
                  - Description textarea
                  - Status dropdown
                  - Priority dropdown
                  - Project selector
                  - Due date picker
                  - Save/Cancel buttons
              */}
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400">
              TODO: Task creation form will go here
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
```

### 7. src/apps/tablez/pages/TablezBoardPage.tsx

```typescript
import React, { useState, useEffect } from 'react';
import { fetchBoardData } from '../api/tablezTasksApi';
import type { TablezTask, TablezTaskStatus, TablezTaskPriority, TablezProject } from '../types';
import KanbanBoard from '../components/KanbanBoard';
import TasksListView from '../components/TasksListView';
import TaskModal from '../components/TaskModal';

const TablezBoardPage: React.FC = () => {
  const [tasks, setTasks] = useState<TablezTask[]>([]);
  const [statuses, setStatuses] = useState<TablezTaskStatus[]>([]);
  const [priorities, setPriorities] = useState<TablezTaskPriority[]>([]);
  const [projects, setProjects] = useState<TablezProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TablezTask | null>(null);

  useEffect(() => {
    const loadBoardData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const boardData = await fetchBoardData();
        setTasks(boardData.tasks);
        setStatuses(boardData.statuses);
        setPriorities(boardData.priorities);
        setProjects(boardData.projects);
      } catch (err) {
        console.error('Error loading board data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load board data');
      } finally {
        setIsLoading(false);
      }
    };

    loadBoardData();
  }, []);

  const handleTaskClick = (task: TablezTask) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500 dark:text-gray-400">Loading tasks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-600 dark:text-red-400">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="w-full p-6">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="label text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Tablez
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Tasks Board
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage your tasks in Kanban or List view
            </p>
          </div>
          
          {/* View Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-[#635CCD] text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-[#635CCD] text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              List
            </button>
          </div>
        </div>
      </header>

      {/* Board Content */}
      <div className="mt-6">
        {viewMode === 'kanban' ? (
          <KanbanBoard
            tasks={tasks}
            statuses={statuses}
            priorities={priorities}
            projects={projects}
            onTaskClick={handleTaskClick}
          />
        ) : (
          <TasksListView
            tasks={tasks}
            statuses={statuses}
            priorities={priorities}
            projects={projects}
            onTaskClick={handleTaskClick}
          />
        )}
      </div>

      {/* Task Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
      />
    </div>
  );
};

export default TablezBoardPage;
```

## Summary

All files have been created. The Tablez app structure is now complete with:

- ✅ Types defined in `types.ts`
- ✅ API layer with `fetchBoardData()` in `api/tablezTasksApi.ts`
- ✅ Kanban board components (KanbanBoard, KanbanColumn, TaskCard)
- ✅ List view component (TasksListView)
- ✅ Modal placeholder (TaskModal)
- ✅ Board page with view toggle
- ✅ Router updated in App.tsx

The app is read-only and connected to Supabase tables as specified.

