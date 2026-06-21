import React, { useState } from 'react';
import type { TablezTask, TablezTaskStatus, TablezTaskPriority, TablezProject } from '../types';
import KanbanColumn from './KanbanColumn';

interface KanbanBoardProps {
  statuses: TablezTaskStatus[];
  tasks: TablezTask[];
  priorities: TablezTaskPriority[];
  projects: TablezProject[];
  onChangeStatus: (taskId: string, statusId: string) => void;
  onCreateTask: (statusId: string) => void;
  onTaskClick: (task: TablezTask) => void;
  isMobile?: boolean;
  effectiveViewMode?: 'kanban' | 'list';
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  statuses,
  tasks,
  priorities,
  projects,
  onChangeStatus,
  onCreateTask,
  onTaskClick,
  isMobile = false,
  effectiveViewMode = 'kanban'
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Group tasks by status
  const tasksByStatus = statuses.reduce((acc, status) => {
    acc[status.id] = tasks.filter(task => task.status_id === status.id);
    return acc;
  }, {} as Record<string, TablezTask[]>);

  const handleDragStart = (taskId: string) => {
    if (isMobile || effectiveViewMode !== 'kanban') return;
    setDraggedTaskId(taskId);
  };

  const handleDrop = async (statusId: string) => {
    if (isMobile || effectiveViewMode !== 'kanban' || !draggedTaskId) return;
    
    // Don't update if dropped in the same column
    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    if (draggedTask && draggedTask.status_id === statusId) {
      setDraggedTaskId(null);
      return;
    }

    // Optimistic UI update is handled by parent component's onChangeStatus
    // which updates the tasks state
    try {
      await onChangeStatus(draggedTaskId, statusId);
    } catch (error) {
      console.error('Error updating task status after drag-and-drop:', error);
      // The parent component should handle error state if needed
    } finally {
      setDraggedTaskId(null);
    }
  };

  const isDragEnabled = !isMobile && effectiveViewMode === 'kanban';

  return (
    <div className="w-full pb-4">
      <div className={`flex gap-4 ${isMobile ? 'overflow-x-auto min-w-max' : 'w-full'}`}>
        {statuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            tasks={tasksByStatus[status.id] || []}
            priorities={priorities}
            allStatuses={statuses}
            projects={projects}
            onChangeStatus={onChangeStatus}
            onCreateTask={onCreateTask}
            onTaskClick={onTaskClick}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            draggedTaskId={draggedTaskId}
            isDragEnabled={isDragEnabled}
          />
        ))}
      </div>
    </div>
  );
};

export default KanbanBoard;

