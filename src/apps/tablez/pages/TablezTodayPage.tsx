import React, { useState, useEffect } from 'react';
import type { TablezTask, TablezTaskStatus, TablezTaskPriority, TablezProject } from '../types';
import {
  fetchTaskStatuses,
  fetchTaskPriorities,
  fetchTodayTasks,
  fetchProjects,
  updateTaskStatus,
  updateTask,
  createTask,
  getCurrentUserId
} from '../api/tablezTasksApi';
import TablezTodayList from '../components/TablezTodayList';
import TaskModal from '../components/TaskModal';
import Alert from '../components/Alert';

const TablezTodayPage: React.FC = () => {
  const [statuses, setStatuses] = useState<TablezTaskStatus[]>([]);
  const [priorities, setPriorities] = useState<TablezTaskPriority[]>([]);
  const [projects, setProjects] = useState<TablezProject[]>([]);
  const [tasks, setTasks] = useState<TablezTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TablezTask | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string>('');
  const [tableId, setTableId] = useState<string>('');

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

        // For now, use placeholder UUIDs for section_id and table_id
        const placeholderId = '00000000-0000-0000-0000-000000000000';
        setSectionId(placeholderId);
        setTableId(placeholderId);

        // Fetch all data in parallel
        const [statusesData, prioritiesData, projectsData, tasksData] = await Promise.all([
          fetchTaskStatuses(),
          fetchTaskPriorities(),
          fetchProjects(),
          fetchTodayTasks(userId)
        ]);

        setStatuses(statusesData);
        setPriorities(prioritiesData);
        setProjects(projectsData);
        setTasks(tasksData);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleTaskClick = (task: TablezTask) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleMarkDone = async (taskId: string) => {
    // Find the "done" status
    const doneStatus = statuses.find(s => s.key === 'done' || s.key === 'completed' || s.label.toLowerCase().includes('done'));
    if (!doneStatus) {
      console.error('No "done" status found');
      return;
    }

    try {
      await updateTaskStatus(taskId, doneStatus.id);
      // Remove task from list (or refresh)
      setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Error marking task as done:', err);
      // Reload tasks on error
      if (currentUserId) {
        const refreshedTasks = await fetchTodayTasks(currentUserId);
        setTasks(refreshedTasks);
      }
    }
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
      await updateTask(selectedTask.id, taskData);
    } else {
      // Create new task
      await createTask({
        ...taskData,
        assigned_to: currentUserId,
        created_by: currentUserId,
        section_id: taskData.section_id,
        table_id: taskData.table_id,
        status_id: taskData.status_id!,
        priority_id: taskData.priority_id!,
      } as any);
    }

    // Reload today's tasks after save
    if (currentUserId) {
      const refreshedTasks = await fetchTodayTasks(currentUserId);
      setTasks(refreshedTasks);
    }
    setIsTaskModalOpen(false);
    setSelectedTask(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading today's tasks...</div>
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
    <div className="flex-1 overflow-y-auto w-full">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <header className="mb-6">
          <div>
            <div className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wide mb-1">Tablez</div>
            <h2 className="text-2xl font-bold text-boh-text-light dark:text-boh-text mb-1">Today</h2>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Your tasks due today, across all statuses.</p>
          </div>
        </header>

        {/* Today's Tasks List */}
        <div>
          <TablezTodayList
            tasks={tasks}
            statuses={statuses}
            priorities={priorities}
            projects={projects}
            onTaskClick={handleTaskClick}
            onMarkDone={handleMarkDone}
          />
        </div>
      </div>

      {/* Task Modal */}
      {currentUserId && (
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
          }}
          onSave={handleSaveTask}
          task={selectedTask}
          statuses={statuses}
          priorities={priorities}
          projects={projects}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
};

export default TablezTodayPage;

