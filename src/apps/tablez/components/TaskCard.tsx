import React from 'react';
import type { TablezTask, TablezTaskStatus, TablezTaskPriority, TablezProject } from '../types';

interface TaskCardProps {
  task: TablezTask;
  status: TablezTaskStatus;
  priority: TablezTaskPriority;
  project?: TablezProject;
  allStatuses: TablezTaskStatus[];
  onChangeStatus: (taskId: string, statusId: string) => void;
  onClick: (task: TablezTask) => void;
  onDragStart: (taskId: string) => void;
  isDragging: boolean;
  isDragEnabled: boolean;
  variant?: 'kanban' | 'list';
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  status,
  priority,
  project,
  allStatuses,
  onChangeStatus,
  onClick,
  onDragStart,
  isDragging,
  isDragEnabled,
  variant = 'kanban'
}) => {
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    onChangeStatus(task.id, e.target.value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getPriorityColor = (priorityKey: string) => {
    switch (priorityKey) {
      case 'urgent':
        return 'bg-red-100 text-red-800 dark:bg-boh-surface dark:text-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text dark:bg-boh-bg dark:text-boh-text-sub';
      default:
        return 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text dark:bg-boh-bg dark:text-boh-text-sub';
    }
  };

  const showStatusDropdown = variant === 'list';

  const dueDate = formatDate(task.due_date);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && status.key !== 'done';

  const handleDragStart = (e: React.DragEvent) => {
    if (!isDragEnabled) {
      e.preventDefault();
      return;
    }
    onDragStart(task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable={isDragEnabled}
      onDragStart={handleDragStart}
      onClick={() => onClick(task)}
      className={`bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-lg p-3 mb-2 cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? 'opacity-50' : ''
      } ${isDragEnabled ? 'cursor-move' : ''}`}
    >
      <div className="mb-2">
        <h3 className="font-medium text-sm text-boh-text-light dark:text-boh-text line-clamp-2">
          {task.title}
        </h3>
        {showStatusDropdown && (
          <div className="mt-2">
            <select
              value={status.id}
              onChange={handleStatusChange}
              onClick={(e) => e.stopPropagation()}
              className="text-xs border border-boh-border-light dark:border-boh-border rounded px-2 py-1 bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-bg text-boh-text-light dark:text-boh-text-sub focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {allStatuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {project && (
        <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mb-2">
          {project.name}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(priority.key)}`}>
            {priority.label}
          </span>
        </div>
        {dueDate && (
          <span className={`text-xs ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-boh-text-sub-light dark:text-boh-text-sub'}`}>
            {dueDate}
          </span>
        )}
      </div>
    </div>
  );
};

export default TaskCard;

