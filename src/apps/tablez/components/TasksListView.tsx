import React from 'react';
import type { TablezTask, TablezTaskStatus, TablezTaskPriority, TablezProject } from '../types';

interface TasksListViewProps {
  tasks: TablezTask[];
  statuses: TablezTaskStatus[];
  priorities: TablezTaskPriority[];
  projects: TablezProject[];
  onChangeStatus: (taskId: string, statusId: string) => void;
  onTaskClick: (task: TablezTask) => void;
  isBulkSelectMode?: boolean;
  selectedTaskIds?: Set<string>;
  onToggleSelectTask?: (taskId: string) => void;
}

const TasksListView: React.FC<TasksListViewProps> = ({
  tasks,
  statuses,
  priorities,
  projects,
  onChangeStatus,
  onTaskClick,
  isBulkSelectMode,
  selectedTaskIds,
  onToggleSelectTask
}) => {
  const getStatus = (task: TablezTask): TablezTaskStatus | undefined => {
    return statuses.find(s => s.id === task.status_id);
  };

  const getPriority = (task: TablezTask): TablezTaskPriority | undefined => {
    return priorities.find(p => p.id === task.priority_id);
  };

  const getProject = (task: TablezTask): TablezProject | undefined => {
    if (!task.tablez_project_id) return undefined;
    return projects.find(p => p.id === task.tablez_project_id);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getPriorityColor = (priorityKey: string) => {
    switch (priorityKey) {
      case 'urgent':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text';
      default:
        return 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text';
    }
  };

  return (
    <div className="w-full h-full min-h-0 overflow-hidden">
      <div className="w-full h-full overflow-auto">
        {/* Desktop table view */}
        <table className="w-full border-collapse hidden md:table">
          <thead>
            <tr className="border-b border-boh-border-light dark:border-boh-border">
              {isBulkSelectMode && (
                <th className="sticky top-0 z-10 bg-boh-surface-light dark:bg-boh-bg text-left py-3 px-4 text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase w-10">
                  
                </th>
              )}
              <th className="sticky top-0 z-10 bg-boh-surface-light dark:bg-boh-bg text-left py-3 px-4 text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase">Task</th>
              <th className="sticky top-0 z-10 bg-boh-surface-light dark:bg-boh-bg text-left py-3 px-4 text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase">Project</th>
              <th className="sticky top-0 z-10 bg-boh-surface-light dark:bg-boh-bg text-left py-3 px-4 text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase">Status</th>
              <th className="sticky top-0 z-10 bg-boh-surface-light dark:bg-boh-bg text-left py-3 px-4 text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase">Priority</th>
              <th className="sticky top-0 z-10 bg-boh-surface-light dark:bg-boh-bg text-left py-3 px-4 text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase">Due Date</th>
              <th className="sticky top-0 z-10 bg-boh-surface-light dark:bg-boh-bg text-left py-3 px-4 text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const status = getStatus(task);
              const priority = getPriority(task);
              const project = getProject(task);
              const isSelected = !!selectedTaskIds?.has(task.id);
              return (
                <tr
                  key={task.id}
                  onClick={() => {
                    if (isBulkSelectMode) {
                      onToggleSelectTask?.(task.id);
                      return;
                    }
                    onTaskClick(task);
                  }}
                  className="border-b border-boh-border-light dark:border-boh-border hover:bg-boh-bg-light dark:hover:bg-boh-bg cursor-pointer transition-colors"
                >
                  {isBulkSelectMode && (
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectTask?.(task.id)}
                        className="rounded border-boh-border-light dark:border-boh-border"
                      />
                    </td>
                  )}
                  <td className="py-3 px-4">
                    <div className="font-medium text-sm text-boh-text-light dark:text-boh-text">{task.title}</div>
                    {task.description && (
                      <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1 line-clamp-1">{task.description}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                    {project ? project.name : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={task.status_id}
                      onChange={(e) => onChangeStatus(task.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs border border-boh-border-light dark:border-boh-border rounded px-2 py-1 bg-boh-surface-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text-sub focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {statuses.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    {priority && (
                      <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(priority.key)}`}>
                        {priority.label}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                    {formatDate(task.due_date)}
                  </td>
                  <td className="py-3 px-4 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                    {formatDate(task.updated_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Mobile card view */}
        <div className="md:hidden space-y-3">
          {tasks.map((task) => {
            const status = getStatus(task);
            const priority = getPriority(task);
            const project = getProject(task);
            const isSelected = !!selectedTaskIds?.has(task.id);
            return (
              <div
                key={task.id}
                onClick={() => {
                  if (isBulkSelectMode) {
                    onToggleSelectTask?.(task.id);
                    return;
                  }
                  onTaskClick(task);
                }}
                className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border-light dark:border-boh-border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-sm text-boh-text-light dark:text-boh-text flex-1">{task.title}</h3>
                  {isBulkSelectMode && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelectTask?.(task.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="ml-2 rounded border-boh-border-light dark:border-boh-border-light dark:border-boh-border"
                    />
                  )}
                  {priority && (
                    <span className={`text-xs px-2 py-0.5 rounded ml-2 ${getPriorityColor(priority.key)}`}>
                      {priority.label}
                    </span>
                  )}
                </div>
                {task.description && (
                  <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mb-2 line-clamp-2">{task.description}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-3 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                  {project && <span>Project: {project.name}</span>}
                  {status && <span>Status: {status.label}</span>}
                  {task.due_date && <span>Due: {formatDate(task.due_date)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TasksListView;


