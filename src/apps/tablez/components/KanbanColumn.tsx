import React from 'react';
import type { TablezTask, TablezTaskStatus, TablezTaskPriority, TablezProject } from '../types';
import TaskCard from './TaskCard';

interface KanbanColumnProps {
  status: TablezTaskStatus;
  tasks: TablezTask[];
  priorities: TablezTaskPriority[];
  allStatuses: TablezTaskStatus[];
  projects: TablezProject[];
  onChangeStatus: (taskId: string, statusId: string) => void;
  onCreateTask: (statusId: string) => void;
  onTaskClick: (task: TablezTask) => void;
  onDragStart: (taskId: string) => void;
  onDrop: (statusId: string) => void;
  draggedTaskId: string | null;
  isDragEnabled: boolean;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  tasks,
  priorities,
  allStatuses,
  projects,
  onChangeStatus,
  onCreateTask,
  onTaskClick,
  onDragStart,
  onDrop,
  draggedTaskId,
  isDragEnabled
}) => {
  const getTaskPriority = (task: TablezTask): TablezTaskPriority => {
    return priorities.find(p => p.id === task.priority_id) || priorities[0];
  };

  const getTaskProject = (task: TablezTask): TablezProject | undefined => {
    if (!task.tablez_project_id) return undefined;
    return projects.find(p => p.id === task.tablez_project_id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isDragEnabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isDragEnabled) return;
    e.preventDefault();
    onDrop(status.id);
  };

  return (
    <div 
      className="flex-shrink-0 md:flex-1 min-w-[220px] md:min-w-0 bg-boh-bg-light dark:bg-boh-bg rounded-lg p-3"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="mb-3 pb-2 border-b-2 border-primary">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-boh-text-light dark:text-boh-text">
            {status.label}
          </h3>
          <span className="text-xs dark:text-boh-text-sub bg-boh-surface-light dark:bg-boh-surface px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
      </div>

      <div className="space-y-2 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto">
        {tasks.map((task) => {
          const priority = getTaskPriority(task);
          const project = getTaskProject(task);
          return (
            <TaskCard
              key={task.id}
              task={task}
              status={status}
              priority={priority}
              project={project}
              allStatuses={allStatuses}
              onChangeStatus={onChangeStatus}
              onClick={onTaskClick}
              onDragStart={onDragStart}
              isDragging={draggedTaskId === task.id}
              isDragEnabled={isDragEnabled}
              variant="kanban"
            />
          );
        })}
      </div>

      <button
        onClick={() => onCreateTask(status.id)}
        className="w-full mt-3 py-2 text-sm dark:text-boh-text-sub hover:text-primary dark:hover:text-primary border border-dashed border-boh-border-light dark:border-boh-border rounded-lg hover:border-primary transition-colors"
      >
        + Add task
      </button>
    </div>
  );
};

export default KanbanColumn;

