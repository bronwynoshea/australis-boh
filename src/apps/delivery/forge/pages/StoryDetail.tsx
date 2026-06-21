import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStory, useDeleteStory } from '../../../../hooks/useStories';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '../../../../hooks/useTasks';
import { useInitiative } from '../../../../hooks/useProductData';
import { useBohUsers, BohUser } from '../../../../hooks/useBohUsers';
import { UserStory, Task, CreateTaskInput, UpdateTaskInput } from '../../../../types/product';
import BohSelect from '../../../../components/boh/BohSelect';
import { CentralCommandLookups, fetchCentralCommandLookups } from '../../../../lib/api/centralCommand';

const emptyCentralLookups: CentralCommandLookups = {
  taskStatuses: [],
  engagementTypes: [],
  engagementStatuses: [],
  capabilities: [],
};

const lookupOptions = (items: Array<{ id: string; label: string }>, emptyLabel = 'Unassigned') => [
  { value: '', label: emptyLabel },
  ...items.map((item) => ({ value: item.id, label: item.label })),
];

// Modal Components (defined outside main component)
const CreateTaskModal: React.FC<{
  onClose: () => void;
  onSubmit: (task: CreateTaskInput) => void;
  users: BohUser[];
  lookups: CentralCommandLookups;
  storyId: string;
}> = ({ onClose, onSubmit, users, lookups, storyId }) => {
  const [formData, setFormData] = useState<CreateTaskInput>({
    user_story_id: storyId,
    title: '',
    description: '',
    assigned_to: '',
    estimated_hours: 0,
    status: 'not_started',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-boh-text-light dark:text-boh-text mb-4">
          Create New Task
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-boh-border-light dark:border-boh-border rounded-lg px-3 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:ring-primary2 focus:border-primary2"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-boh-border-light dark:border-boh-border rounded-lg px-3 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:ring-primary2 focus:border-primary2"
              rows={3}
            />
          </div>
          
          <BohSelect
            label="Status"
            value={formData.status || 'not_started'}
            onChange={(status) => setFormData({ ...formData, status: status as CreateTaskInput['status'] })}
            options={lookups.taskStatuses.map((status) => ({ value: status.key, label: status.label }))}
          />

          <BohSelect
            label="Assigned To"
            value={formData.assigned_to || ''}
            onChange={(assigned_to) => setFormData({ ...formData, assigned_to })}
            options={[
              { value: '', label: 'Unassigned' },
              ...users.map((user) => ({ value: user.id, label: user.full_name || user.email || 'Unnamed user' })),
            ]}
          />

          <BohSelect
            label="Agent engagement"
            value={formData.agent_engagement_type_id || ''}
            onChange={(agent_engagement_type_id) => setFormData({ ...formData, agent_engagement_type_id })}
            options={lookupOptions(lookups.engagementTypes)}
          />

          <BohSelect
            label="Central status"
            value={formData.agent_engagement_status_id || ''}
            onChange={(agent_engagement_status_id) => setFormData({ ...formData, agent_engagement_status_id })}
            options={lookupOptions(lookups.engagementStatuses)}
          />

          <BohSelect
            label="Agent capability"
            value={formData.agent_capability_id || ''}
            onChange={(agent_capability_id) => setFormData({ ...formData, agent_capability_id })}
            options={lookupOptions(lookups.capabilities)}
          />
          
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
              Estimated Hours
            </label>
            <input
              type="number"
              value={formData.estimated_hours}
              onChange={(e) => setFormData({ ...formData, estimated_hours: Number(e.target.value) })}
              className="w-full border border-boh-border-light dark:border-boh-border rounded-lg px-3 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:ring-primary2 focus:border-primary2"
              min="0"
              step="0.5"
            />
          </div>
          
          <div className="flex space-x-2 pt-4">
            <button
              type="submit"
              className="p-3 rounded-xl bg-boh-primary text-boh-text shadow-lg"
            >
              Create Task
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-3 rounded-xl bg-boh-surface-light dark:bg-boh-surface hover:bg-boh-surface-light dark:hover:bg-boh-surface-dark text-boh-text-light dark:text-boh-text shadow-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TaskDetailModal: React.FC<{
  task: Task;
  onClose: () => void;
  onSave: (task: UpdateTaskInput) => void;
  onDelete: () => void;
  onChange: (task: Task) => void;
  users: BohUser[];
  lookups: CentralCommandLookups;
}> = ({ task, onClose, onSave, onDelete, onChange, users, lookups }) => {
  const handleSave = () => {
    onSave({
      title: task.title,
      description: task.description,
      assigned_to: task.assigned_to,
      estimated_hours: task.estimated_hours,
      actual_hours: task.actual_hours,
      status: task.status,
      blocked_reason: task.blocked_reason,
      agent_engagement_type_id: task.agent_engagement_type_id,
      agent_engagement_status_id: task.agent_engagement_status_id,
      agent_capability_id: task.agent_capability_id,
      agent_readiness_notes: task.agent_readiness_notes,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-boh-text-light dark:text-boh-text mb-4">
          Edit Task
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
              Title
            </label>
            <input
              type="text"
              value={task.title}
              onChange={(e) => onChange({ ...task, title: e.target.value })}
              className="w-full border border-boh-border-light dark:border-boh-border rounded-lg px-3 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:ring-primary2 focus:border-primary2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
              Description
            </label>
            <textarea
              value={task.description || ''}
              onChange={(e) => onChange({ ...task, description: e.target.value })}
              className="w-full border border-boh-border-light dark:border-boh-border rounded-lg px-3 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:ring-primary2 focus:border-primary2"
              rows={3}
            />
          </div>
          
          <BohSelect
            label="Status"
            value={task.status}
            onChange={(status) => onChange({ ...task, status: status as Task['status'] })}
            options={lookups.taskStatuses.map((status) => ({ value: status.key, label: status.label }))}
          />
          
          <BohSelect
            label="Assigned To"
            value={task.assigned_to || ''}
            onChange={(assigned_to) => onChange({ ...task, assigned_to })}
            options={[
              { value: '', label: 'Unassigned' },
              ...users.map((user) => ({ value: user.id, label: user.full_name || user.email || 'Unnamed user' })),
            ]}
          />

          <BohSelect
            label="Agent engagement"
            value={task.agent_engagement_type_id || ''}
            onChange={(agent_engagement_type_id) => onChange({ ...task, agent_engagement_type_id })}
            options={lookupOptions(lookups.engagementTypes)}
          />

          <BohSelect
            label="Central status"
            value={task.agent_engagement_status_id || ''}
            onChange={(agent_engagement_status_id) => onChange({ ...task, agent_engagement_status_id })}
            options={lookupOptions(lookups.engagementStatuses)}
          />

          <BohSelect
            label="Agent capability"
            value={task.agent_capability_id || ''}
            onChange={(agent_capability_id) => onChange({ ...task, agent_capability_id })}
            options={lookupOptions(lookups.capabilities)}
          />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
                Estimated Hours
              </label>
              <input
                type="number"
                value={task.estimated_hours || 0}
                onChange={(e) => onChange({ ...task, estimated_hours: Number(e.target.value) })}
                className="w-full border border-boh-border-light dark:border-boh-border rounded-lg px-3 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:ring-primary2 focus:border-primary2"
                min="0"
                step="0.5"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
                Actual Hours
              </label>
              <input
                type="number"
                value={task.actual_hours || 0}
                onChange={(e) => onChange({ ...task, actual_hours: Number(e.target.value) })}
                className="w-full border border-boh-border-light dark:border-boh-border rounded-lg px-3 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:ring-primary2 focus:border-primary2"
                min="0"
                step="0.5"
              />
            </div>
          </div>
          
          {task.status === 'blocked' && (
            <div>
              <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
                Blocked Reason
              </label>
              <textarea
                value={task.blocked_reason || ''}
                onChange={(e) => onChange({ ...task, blocked_reason: e.target.value })}
                className="w-full border border-boh-border-light dark:border-boh-border rounded-lg px-3 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:ring-primary2 focus:border-primary2"
                rows={2}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
              Agent readiness notes
            </label>
            <textarea
              value={task.agent_readiness_notes || ''}
              onChange={(e) => onChange({ ...task, agent_readiness_notes: e.target.value })}
              className="w-full border border-boh-border-light dark:border-boh-border rounded-lg px-3 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:ring-primary2 focus:border-primary2"
              rows={2}
            />
          </div>
        </div>
        
        <div className="flex space-x-2 pt-4">
          <button
            onClick={handleSave}
            className="p-3 rounded-xl bg-boh-primary text-boh-text shadow-lg"
          >
            Save Changes
          </button>
          <button
            onClick={onDelete}
            className="p-3 rounded-xl bg-boh-primary hover:bg-boh-primary/80 text-boh-text shadow-lg"
          >
            Delete Task
          </button>
          <button
            onClick={onClose}
            className="p-3 rounded-xl bg-boh-surface-light dark:bg-boh-surface hover:bg-boh-surface-light dark:hover:bg-boh-surface-dark text-boh-text-light dark:text-boh-text shadow-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const DeleteConfirmModal: React.FC<{
  onClose: () => void;
  onConfirm: () => void;
  storyTitle: string;
}> = ({ onClose, onConfirm, storyTitle }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg p-6 w-full max-w-md">
      <h2 className="text-xl font-semibold text-boh-text-light dark:text-boh-text mb-4">
        Delete Story
      </h2>
      
      <p className="text-boh-text-light dark:text-boh-text mb-6">
        Are you sure you want to delete "{storyTitle}"? This action cannot be undone and will also delete all associated tasks.
      </p>
      
      <div className="flex space-x-3">
        <button
          onClick={onConfirm}
          className="p-3 rounded-xl bg-boh-primary hover:bg-boh-primary/80 text-boh-text shadow-lg"
        >
          Delete Story
        </button>
        <button
          onClick={onClose}
          className="p-3 rounded-xl bg-boh-surface-light dark:bg-boh-surface hover:bg-boh-surface-light dark:hover:bg-boh-surface-dark text-boh-text-light dark:text-boh-text shadow-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
);

// Main Component
const StoryDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // State for modals
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [centralLookups, setCentralLookups] = useState<CentralCommandLookups>(emptyCentralLookups);

  // Data fetching
  const { data: story, isLoading: storyLoading, error: storyError } = useStory(id!);
  const { data: tasks = [], isLoading: tasksLoading, error: tasksError } = useTasks(id!);
  const { data: initiative } = useInitiative(story?.initiative_id || '');
  const { users } = useBohUsers();

  useEffect(() => {
    const loadLookups = async () => {
      try {
        setCentralLookups(await fetchCentralCommandLookups());
      } catch (error) {
        console.error('Failed to load Central Command lookups:', error);
      }
    };

    void loadLookups();
  }, []);
  
  // Mutations
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const deleteStory = useDeleteStory();

  // Group tasks by status
  const tasksByStatus = {
    not_started: tasks?.filter(t => t.status === 'not_started') || [],
    in_progress: tasks?.filter(t => t.status === 'in_progress') || [],
    blocked: tasks?.filter(t => t.status === 'blocked') || [],
    review: tasks?.filter(t => t.status === 'review') || [],
    done: tasks?.filter(t => t.status === 'done') || [],
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setEditingTask({ ...task });
    setShowTaskDetailModal(true);
  };

  const handleCreateTask = async (taskData: CreateTaskInput) => {
    try {
      await createTask.mutateAsync({ ...taskData, user_story_id: id! });
      setShowCreateTaskModal(false);
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleUpdateTask = async (taskData: UpdateTaskInput) => {
    if (!selectedTask) return;
    
    try {
      await updateTask.mutateAsync({ id: selectedTask.id, data: taskData });
      setShowTaskDetailModal(false);
      setSelectedTask(null);
      setEditingTask(null);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    
    try {
      await deleteTask.mutateAsync({ id: selectedTask.id, storyId: id! });
      setShowTaskDetailModal(false);
      setSelectedTask(null);
      setEditingTask(null);
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleEditStory = () => {
    navigate(`/forge/stories/${id}/edit`);
  };

  const handleDeleteStory = async () => {
    if (!story) return;
    
    try {
      await deleteStory.mutateAsync({ id: story.id, initiativeId: story.initiative_id });
      // After deletion, navigate to the parent initiative in Menu (Menu owns initiative CRUD)
      navigate(`/menu/initiatives/${story.initiative_id}`);
    } catch (error) {
      console.error('Failed to delete story:', error);
    }
  };

  // Task Card Component - NO DROPDOWN
  const TaskCard: React.FC<{ task: Task }> = ({ task }) => (
    <div 
      className="bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border p-4 cursor-pointer hover:border-boh-primary dark:hover:border-boh-primary transition-all"
      onClick={() => handleTaskClick(task)}
    >
      <h4 className="font-medium text-boh-text-light dark:text-boh-text mb-3">{task.title}</h4>
      
      <div className="flex items-center justify-between text-sm text-boh-text-sub-light dark:text-boh-text-sub">
        <div className="flex items-center gap-3">
          {task.assigned_user?.full_name && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {task.assigned_user.full_name}
            </div>
          )}
          {task.estimated_hours && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {task.estimated_hours}h
            </div>
          )}
        </div>
        
        {/* Status indicator */}
        <div className={`px-2 py-1 rounded text-xs font-medium capitalize ${
          task.status === 'not_started' 
            ? 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-sub-light dark:text-boh-text-sub'
            : task.status === 'in_progress'
            ? 'bg-boh-primary-tint text-boh-primary dark:bg-boh-primary/20 dark:text-boh-primary'
            : task.status === 'blocked'
            ? 'bg-boh-surface-light dark:bg-boh-surface text-boh-primary dark:text-boh-primary'
            : task.status === 'review'
            ? 'bg-boh-primary-tint text-boh-primary dark:bg-boh-primary/20 dark:text-boh-primary'
            : 'bg-boh-surface-light dark:bg-boh-surface text-boh-success dark:text-boh-success'
        }`}>
          {task.status.replace('_', ' ')}
        </div>
      </div>
    </div>
  );

  // Kanban Column Component
  const KanbanColumn: React.FC<{ title: string; status: string; tasks: Task[] }> = ({ title, status, tasks }) => (
    <div className="flex-shrink-0 w-64 lg:w-72 xl:w-80 bg-boh-bg-sub-light dark:bg-boh-bg-sub rounded-lg flex flex-col h-full">
      {/* Sticky Header */}
      <div className="p-4 border-b border-boh-border-light dark:border-boh-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-boh-text-light dark:text-boh-text">{title}</h3>
          <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub bg-boh-bg-light dark:bg-boh-bg px-2 py-1 rounded">
            {tasks.length}
          </span>
        </div>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0 scrollbar-hide">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}
        
        {tasks.length === 0 && (
          <div className="text-center text-boh-text-sub-light dark:text-boh-text-sub py-8">
            No tasks
          </div>
        )}
      </div>
    </div>
  );

  if (storyLoading) {
    return (
      <div className="min-h-screen bg-boh-bg-light dark:bg-boh-bg flex items-center justify-center">
        <div className="text-boh-text-light dark:text-boh-text">Loading story...</div>
      </div>
    );
  }

  if (storyError || !story) {
    return (
      <div className="min-h-screen bg-boh-bg-light dark:bg-boh-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Story Not Found</h1>
          <p className="text-boh-text-sub-light dark:text-boh-text-sub mb-4">
            The story you're looking for doesn't exist or you don't have access to it.
          </p>
          <Link 
            to="/forge" 
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Back to Forge
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-boh-bg-light dark:bg-boh-bg text-base flex flex-col">
      <div className="w-full px-6 py-8 flex-shrink-0">
        {/* Header */}
        <header className="mb-8">
          <nav className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-4">
            <Link to="/forge" className="hover:text-boh-text-light dark:hover:text-boh-text">
              Forge
            </Link>
            <span className="mx-2">/</span>
            {initiative && (
              <>
                <Link 
                  to={`/menu/initiatives/${initiative.id}`}
                  className="hover:text-boh-text-light dark:hover:text-boh-text"
                >
                  {initiative.title}
                </Link>
                <span className="mx-2">/</span>
              </>
            )}
            <span className="text-boh-text-light dark:text-boh-text">{story.title}</span>
          </nav>
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-boh-text-light dark:text-boh-text">
                {story.title}
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={handleEditStory}
                className="bg-boh-primary hover:bg-boh-primary/80 text-boh-text px-4 py-2 rounded-lg text-sm font-medium"
              >
                Edit Story
              </button>
              <button 
                onClick={() => setShowDeleteConfirmModal(true)}
                className="bg-boh-primary hover:bg-boh-primary/80 text-boh-text px-4 py-2 rounded-lg text-sm font-medium"
              >
                Delete Story
              </button>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Progress</span>
              <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">{story.progress || 0}%</span>
            </div>
            <div className="w-full bg-boh-border-light dark:bg-boh-border rounded-full h-2">
              <div 
                className="bg-boh-primary h-2 rounded-full"
                style={{ width: `${story.progress || 0}%` }}
              />
            </div>
          </div>
        </header>

        <div className="space-y-6 flex-shrink-0">
          {/* Story Info Section */}
          <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-lg p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Description */}
              <div className="lg:col-span-2">
                <h2 className="text-xl font-semibold text-boh-text-light dark:text-boh-text mb-4">
                  Description
                </h2>
                <p className="text-boh-text-light dark:text-boh-text whitespace-pre-wrap">
                  {story.description || 'No description provided'}
                </p>
              </div>
              
              {/* Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {story.owner_user?.full_name && (
                  <div>
                    <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Owner</div>
                    <div className="font-medium text-boh-text-light dark:text-boh-text">
                      {story.owner_user.full_name}
                    </div>
                  </div>
                )}
                
                {story.story_points && (
                  <div>
                    <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Story Points</div>
                    <div className="font-medium text-boh-text-light dark:text-boh-text">
                      {story.story_points}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board - Full Height */}
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl shadow-lg p-6 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <h2 className="text-xl font-semibold text-boh-text-light dark:text-boh-text">
              Tasks
            </h2>
            <button
              onClick={() => setShowCreateTaskModal(true)}
              className="bg-boh-primary hover:bg-boh-primary/80 text-boh-text px-4 py-2 rounded-lg text-sm font-medium"
            >
              + New Task
            </button>
          </div>

          <div className="flex-1 min-h-0">
            <div className="h-full overflow-x-auto">
              <div className="flex space-x-4 h-full min-w-max">
                <KanbanColumn title="Not Started" status="not_started" tasks={tasksByStatus.not_started} />
                <KanbanColumn title="In Progress" status="in_progress" tasks={tasksByStatus.in_progress} />
                <KanbanColumn title="Blocked" status="blocked" tasks={tasksByStatus.blocked} />
                <KanbanColumn title="Review" status="review" tasks={tasksByStatus.review} />
                <KanbanColumn title="Done" status="done" tasks={tasksByStatus.done} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateTaskModal && (
        <CreateTaskModal
          onClose={() => setShowCreateTaskModal(false)}
          onSubmit={handleCreateTask}
          users={users}
          lookups={centralLookups}
          storyId={id!}
        />
      )}

      {showTaskDetailModal && editingTask && (
        <TaskDetailModal
          task={editingTask}
          onClose={() => {
            setShowTaskDetailModal(false);
            setSelectedTask(null);
            setEditingTask(null);
          }}
          onSave={handleUpdateTask}
          onDelete={handleDeleteTask}
          onChange={setEditingTask}
          users={users}
          lookups={centralLookups}
        />
      )}

      {showDeleteConfirmModal && (
        <DeleteConfirmModal
          onClose={() => setShowDeleteConfirmModal(false)}
          onConfirm={handleDeleteStory}
          storyTitle={story.title}
        />
      )}
    </div>
  );
};

export default StoryDetail;
