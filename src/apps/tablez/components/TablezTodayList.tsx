import React from 'react';
import type { TablezTask, TablezTaskStatus, TablezTaskPriority, TablezProject } from '../types';

interface TablezTodayListProps {
  tasks: TablezTask[];
  statuses: TablezTaskStatus[];
  priorities: TablezTaskPriority[];
  projects: TablezProject[];
  onTaskClick: (task: TablezTask) => void;
  onMarkDone: (taskId: string) => void;
}

const TablezTodayList: React.FC<TablezTodayListProps> = ({
  tasks,
  statuses,
  priorities,
  projects,
  onTaskClick,
  onMarkDone
}) => {
  const getPriority = (task: TablezTask): TablezTaskPriority | undefined => {
    return priorities.find(p => p.id === task.priority_id);
  };

  const getProject = (task: TablezTask): TablezProject | undefined => {
    if (!task.tablez_project_id) return undefined;
    return projects.find(p => p.id === task.tablez_project_id);
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

  const getDoneStatusId = (): string | null => {
    const doneStatus = statuses.find(s => s.key === 'done' || s.key === 'completed' || s.label.toLowerCase().includes('done'));
    return doneStatus?.id || null;
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-boh-text-sub-light dark:text-boh-text-sub">No tasks due today. Great job!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const priority = getPriority(task);
        const project = getProject(task);
        const doneStatusId = getDoneStatusId();

        return (
          <div
            key={task.id}
            onClick={() => onTaskClick(task)}
            className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm text-boh-text-light dark:text-boh-text line-clamp-2 mb-2">
                  {task.title}
                </h3>
                
                <div className="flex flex-wrap items-center gap-2">
                  {project && (
                    <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub bg-boh-surface-light dark:bg-boh-bg px-2 py-0.5 rounded-full">
                      {project.name}
                    </span>
                  )}
                  
                  {priority && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(priority.key)}`}>
                      {priority.label}
                    </span>
                  )}
                </div>
              </div>
              
              {doneStatusId && task.status_id !== doneStatusId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkDone(task.id);
                  }}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                  title="Mark as done"
                >
                  ✓ Done
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TablezTodayList;


