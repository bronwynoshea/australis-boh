import React, { useState, useEffect } from 'react';
import type { TablezTask, TablezTaskStatus, TablezTaskPriority, TablezProject } from '../types';
import { supabase } from '../../../lib/supabase';
import Alert from './Alert';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<TablezTask>) => Promise<void>;
  task?: TablezTask | null;
  statuses: TablezTaskStatus[];
  priorities: TablezTaskPriority[];
  projects: TablezProject[];
  defaultStatusId?: string;
  defaultPriorityId?: string;
  currentUserId: string;
  chairId?: string | null;
}

const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  task,
  statuses,
  priorities,
  projects,
  defaultStatusId,
  defaultPriorityId,
  currentUserId,
  chairId,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [statusId, setStatusId] = useState<string>('');
  const [priorityId, setPriorityId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [scheduledStartAt, setScheduledStartAt] = useState<string>('');
  const [scheduledEndAt, setScheduledEndAt] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setProjectId(task.tablez_project_id || '');
      setStatusId(task.status_id);
      setPriorityId(task.priority_id);
      setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
      setScheduledStartAt(task.scheduled_start_at ? new Date(task.scheduled_start_at).toISOString().slice(0, 16) : '');
      setScheduledEndAt(task.scheduled_end_at ? new Date(task.scheduled_end_at).toISOString().slice(0, 16) : '');
    } else {
      setTitle('');
      setDescription('');
      setProjectId('');
      setStatusId(defaultStatusId || statuses[0]?.id || '');
      setPriorityId(defaultPriorityId || priorities.find(p => p.key === 'medium')?.id || priorities[0]?.id || '');
      setDueDate('');
      setScheduledStartAt('');
      setScheduledEndAt('');
    }
    setError('');
  }, [task, statuses, priorities, defaultStatusId, defaultPriorityId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!statusId || !priorityId) {
      setError('Status and priority are required');
      return;
    }

    setIsLoading(true);

    try {
      const taskData: Partial<TablezTask> = {
        title: title.trim(),
        description: description.trim() || null,
        tablez_project_id: projectId || null,
        status_id: statusId,
        priority_id: priorityId,
        due_date: dueDate || null,
        scheduled_start_at: scheduledStartAt || null,
        scheduled_end_at: scheduledEndAt || null,
        assigned_to: currentUserId,
        created_by: task ? task.created_by : currentUserId,
      };

      await onSave(taskData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`modal-backdrop ${isOpen ? 'visible' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content mx-4" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            <div className="modal-header" style={{ textAlign: 'left' }}>
              <h3>{task ? 'Edit Task' : 'New Task'}</h3>
              <p>{task ? 'Update task details' : 'Create a new task'}</p>
            </div>

            <div className="modal-body" style={{ gap: 0 }}>
              {error && <Alert variant="error" className="mb-4">{error}</Alert>}

              {/* TODO: Re-enable table/chair assignment after PostgREST schema/API issue is resolved. */}

              <div className="form-group">
                <label htmlFor="task-title">Title *</label>
                <input
                  type="text"
                  id="task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full"
                />
              </div>

              <div className="form-group">
                <label htmlFor="task-description">Description</label>
                <textarea
                  id="task-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full p-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text"
                />
              </div>

              <div className="form-group">
                <label htmlFor="task-project">Project</label>
                <select
                  id="task-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full p-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text"
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="task-status">Status *</label>
                  <select
                    id="task-status"
                    value={statusId}
                    onChange={(e) => setStatusId(e.target.value)}
                    required
                    className="w-full p-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text"
                  >
                    {statuses.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="task-priority">Priority *</label>
                  <select
                    id="task-priority"
                    value={priorityId}
                    onChange={(e) => setPriorityId(e.target.value)}
                    required
                    className="w-full p-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text"
                  >
                    {priorities.map((priority) => (
                      <option key={priority.id} value={priority.id}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="task-due-date">Due Date</label>
                <input
                  type="date"
                  id="task-due-date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full p-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="task-scheduled-start">Scheduled Start</label>
                  <input
                    type="datetime-local"
                    id="task-scheduled-start"
                    value={scheduledStartAt}
                    onChange={(e) => setScheduledStartAt(e.target.value)}
                    className="w-full p-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="task-scheduled-end">Scheduled End</label>
                  <input
                    type="datetime-local"
                    id="task-scheduled-end"
                    value={scheduledEndAt}
                    onChange={(e) => setScheduledEndAt(e.target.value)}
                    className="w-full p-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
                style={{ backgroundColor: 'var(--boh-primary)' }}
              >
                {isLoading ? 'Saving...' : task ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
