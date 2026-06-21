import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMenuInitiativeDetail } from '../hooks/useMenuInitiativeDetail';
import { useBohAccess } from '../../../../shared/hooks/useBohAccess';
import { useProductApps, useAppModules, useForgeStatuses, usePriorityOptions, useQuarterCalendar, usePlanningStages } from '../../../../hooks/useProductData';
import { useBohUsers } from '../../../../hooks/useBohUsers';
import type { UserStory, Task } from '../../../../types/product';

// Custom Dropdown Component
interface CustomDropdownOption<T = string> {
  label: string;
  value: T;
}

interface CustomDropdownProps<T = string> {
  label: string;
  value: T;
  options: CustomDropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  currentLabel?: string; // Label to show when value not in options (e.g., while loading)
}

function CustomDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  currentLabel,
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  // Show currentLabel if provided and value exists but not in options yet (loading state)
  const displayValue = selectedOption 
    ? selectedOption.label 
    : (value && currentLabel) 
      ? currentLabel 
      : placeholder;

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1 uppercase tracking-wide">
        {label}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={`w-full h-10 px-3 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface flex items-center justify-between gap-2 text-left shadow-sm transition-all ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-boh-primary cursor-pointer'
        } ${isOpen ? 'ring-2 ring-boh-primary border-boh-primary' : ''}`}
      >
        <span className="text-sm font-medium text-boh-text-light dark:text-boh-text truncate">
          {displayValue}
        </span>
        <svg
          className={`w-4 h-4 text-boh-text-sub-light dark:text-boh-text-sub transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface shadow-xl max-h-60 overflow-y-auto boh-dropdown-scrollbar">
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                option.value === value
                  ? 'bg-boh-primary/10 text-boh-primary font-medium'
                  : 'text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg'
              }`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Status options for dropdowns
const STORY_STATUS_OPTIONS: { value: UserStory['status']; label: string; color: string }[] = [
  { value: 'not_started', label: 'Not Started', color: 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-sub-light dark:text-boh-text-sub' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-boh-primary/10 dark:bg-boh-primary/10 text-boh-primary dark:text-boh-primary' },
  { value: 'blocked', label: 'Blocked', color: 'bg-boh-primary/10 dark:bg-boh-primary/10 text-boh-primary dark:text-boh-primary' },
  { value: 'review', label: 'Review', color: 'bg-boh-primary/10 dark:bg-boh-primary/10 text-boh-primary dark:text-boh-primary' },
  { value: 'done', label: 'Done', color: 'bg-boh-primary/20 dark:bg-boh-primary/20 text-boh-primary dark:text-boh-primary' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-sub-light dark:text-boh-text-sub' },
];

const TASK_STATUS_OPTIONS: { value: Task['status']; label: string; color: string }[] = [
  { value: 'not_started', label: 'Not Started', color: 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-sub-light dark:text-boh-text-sub' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-boh-primary/10 dark:bg-boh-primary/10 text-boh-primary dark:text-boh-primary' },
  { value: 'blocked', label: 'Blocked', color: 'bg-boh-primary/10 dark:bg-boh-primary/10 text-boh-primary dark:text-boh-primary' },
  { value: 'review', label: 'Review', color: 'bg-boh-primary/10 dark:bg-boh-primary/10 text-boh-primary dark:text-boh-primary' },
  { value: 'done', label: 'Done', color: 'bg-boh-primary/20 dark:bg-boh-primary/20 text-boh-primary dark:text-boh-primary' },
];

const MenuInitiativeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    initiative,
    isLoading,
    error,
    refresh,
    updateInitiative,
    addUserStory,
    updateUserStory,
    submitToForge,
    isReadyToSubmit
  } = useMenuInitiativeDetail(id);

  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showAddStory, setShowAddStory] = useState(false);
  const [newStoryTitle, setNewStoryTitle] = useState('');

  // Editable header state
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [isSavingHeader, setIsSavingHeader] = useState(false);
  const [headerFormData, setHeaderFormData] = useState({
    title: '',
    description: '',
    owner_user_id: '',
    app_id: '',
    module_id: '',
    target_quarter: '',
    target_year: '',
    planning_stage_id: '',
    priority_id: '',
    governance_notes: ''
  });

  // DB-backed lookup data
  const { data: apps } = useProductApps();
  const { data: forgeStatuses } = useForgeStatuses();
  const { data: priorities } = usePriorityOptions();
  const { data: planningStages } = usePlanningStages();
  const { data: quarterCalendar } = useQuarterCalendar();
  const { data: modules } = useAppModules(headerFormData.app_id || undefined);
  const { users: bohUsers } = useBohUsers();

  // Determine if initiative is submitted to Forge
  const isSubmittedToForge = useMemo(() => {
    return !!initiative?.submitted_to_forge_at;
  }, [initiative?.submitted_to_forge_at]);

  // Check if user is super admin using the actual auth system
  const { isSuperAdmin } = useBohAccess();

  // Determine if header is editable
  const isHeaderEditable = useMemo(() => {
    if (!initiative) return false;
    // Editable if not submitted, or if super admin
    return !isSubmittedToForge || isSuperAdmin;
  }, [initiative, isSubmittedToForge, isSuperAdmin]);

  // Select first story by default when data loads
  useEffect(() => {
    if (initiative?.stories.length && !selectedStoryId) {
      setSelectedStoryId(initiative.stories[0].id);
    }
  }, [initiative, selectedStoryId]);

  // Clear task selection when story changes
  useEffect(() => {
    setSelectedTaskId(null);
  }, [selectedStoryId]);

  // Initialize header form data when entering edit mode
  useEffect(() => {
    if (initiative && isEditingHeader) {
      setHeaderFormData({
        title: initiative.title || '',
        description: initiative.description || '',
        owner_user_id: initiative.owner_user_id || '',
        app_id: initiative.app_id || '',
        module_id: initiative.module_id || '',
        target_quarter: initiative.target_quarter || '',
        target_year: initiative.target_year ? String(initiative.target_year) : '',
        planning_stage_id: initiative.planning_stage_id || '',
        priority_id: initiative.priority_id || '',
        governance_notes: initiative.governance_notes || ''
      });
    }
  }, [initiative, isEditingHeader]);

  // Handle header save
  const handleSaveHeader = async () => {
    if (!initiative || !isHeaderEditable) return;

    setIsSavingHeader(true);
    const updates = {
      title: headerFormData.title,
      description: headerFormData.description,
      owner_user_id: headerFormData.owner_user_id || null,
      app_id: headerFormData.app_id || null,
      module_id: headerFormData.module_id || null,
      target_quarter: headerFormData.target_quarter || null,
      target_year: headerFormData.target_year ? parseInt(headerFormData.target_year) : null,
      planning_stage_id: headerFormData.planning_stage_id || null,
      priority_id: headerFormData.priority_id || null,
      governance_notes: headerFormData.governance_notes || null
    };

    const success = await updateInitiative(updates);
    setIsSavingHeader(false);

    if (success) {
      setIsEditingHeader(false);
    } else {
      alert('Failed to save initiative changes');
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditingHeader(false);
    setHeaderFormData({
      title: '',
      description: '',
      owner_user_id: '',
      app_id: '',
      module_id: '',
      target_quarter: '',
      target_year: '',
      planning_stage_id: '',
      priority_id: '',
      governance_notes: ''
    });
  };

  const selectedStory = initiative?.stories.find(s => s.id === selectedStoryId) || null;
  const selectedTask = selectedStory?.tasks.find(t => t.id === selectedTaskId) || null;

  // Handle submit to Forge
  const handleSubmitToForge = async () => {
    if (!isReadyToSubmit || isSubmitting) return;
    
    setIsSubmitting(true);
    const result = await submitToForge();
    setIsSubmitting(false);
    
    if (result.success) {
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } else {
      alert(result.error || 'Failed to submit to Forge');
    }
  };

  // Handle add story
  const handleAddStory = async () => {
    if (!newStoryTitle.trim() || !id) return;
    
    const story = await addUserStory({
      initiative_id: id,
      title: newStoryTitle.trim(),
      description: '',
      status: 'not_started',
      sort_order: (initiative?.stories.length || 0) + 1,
      is_archived: false,
      progress: 0
    });
    
    if (story) {
      setSelectedStoryId(story.id);
      setNewStoryTitle('');
      setShowAddStory(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-boh-bg-light dark:bg-boh-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-boh-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Loading initiative...</span>
        </div>
      </div>
    );
  }

  if (error || !initiative) {
    return (
      <div className="h-full flex items-center justify-center bg-boh-bg-light dark:bg-boh-bg p-6">
        <div className="text-center max-w-md">
          <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-2">Failed to load initiative</h3>
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-4">{error || 'Initiative not found'}</p>
          <button
            onClick={() => navigate('/menu/board')}
            className="px-4 py-2 rounded-lg bg-boh-primary text-white text-sm font-medium hover:bg-boh-primary-dark transition-colors"
          >
            Back to Board
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-boh-bg-light dark:bg-boh-bg">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
        <div className="px-4 sm:px-6 py-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm mb-3">
            <button
              onClick={() => navigate('/menu')}
              className="text-boh-text-light dark:text-boh-text font-medium hover:text-boh-primary transition-colors"
            >
              Menu
            </button>
            <span className="text-boh-text-sub-light dark:text-boh-text-sub">/</span>
            <button
              onClick={() => navigate('/menu/overview')}
              className="text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-primary transition-colors"
            >
              Overview
            </button>
            <span className="text-boh-text-sub-light dark:text-boh-text-sub">/</span>
            <span className="text-boh-text-sub-light dark:text-boh-text-sub truncate max-w-[200px]" title={initiative?.title || 'Initiative'}>
              {initiative?.title || 'Initiative'}
            </span>
          </nav>

          {/* Title - Editable or Display */}
          {isEditingHeader ? (
            <div className="mb-4">
              <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1">
                Initiative Title
              </label>
              <input
                type="text"
                value={headerFormData.title}
                onChange={(e) => setHeaderFormData({ ...headerFormData, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary"
                placeholder="Enter initiative title..."
              />
            </div>
          ) : (
            <h1 className="text-xl sm:text-2xl font-semibold text-boh-text-light dark:text-boh-text mb-2">
              {initiative.title}
            </h1>
          )}

          {/* Description - Editable or Display */}
          {isEditingHeader ? (
            <div className="mb-4">
              <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1">
                Description
              </label>
              <textarea
                value={headerFormData.description}
                onChange={(e) => setHeaderFormData({ ...headerFormData, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary resize-none"
                placeholder="Enter initiative description..."
              />
            </div>
          ) : initiative.description ? (
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-3">
              {initiative.description}
            </p>
          ) : null}

          {/* Editable Metadata Grid */}
          {isEditingHeader ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
              {/* Initiative Owner */}
              <div>
                <CustomDropdown
                  label="Initiative Owner"
                  value={headerFormData.owner_user_id}
                  currentLabel={initiative?.owner_user?.full_name || initiative?.owner_user?.email || undefined}
                  options={[
                    { label: 'Select owner...', value: '' },
                    ...(bohUsers?.map((user) => ({ label: user.full_name || user.email || 'Unknown', value: user.id })) || [])
                  ]}
                  onChange={(value) => setHeaderFormData({ ...headerFormData, owner_user_id: value })}
                  placeholder="Select owner..."
                />
              </div>

              {/* App */}
              <div>
                <CustomDropdown
                  label="App"
                  value={headerFormData.app_id}
                  currentLabel={initiative?.app?.name || undefined}
                  options={[
                    { label: 'Select app...', value: '' },
                    ...(apps?.map((app) => ({ label: app.name, value: app.id })) || [])
                  ]}
                  onChange={(value) => setHeaderFormData({ ...headerFormData, app_id: value, module_id: '' })}
                  placeholder="Select app..."
                />
              </div>

              {/* Module */}
              <div>
                <CustomDropdown
                  label="Module"
                  value={headerFormData.module_id}
                  currentLabel={initiative?.module?.label || undefined}
                  options={[
                    { label: headerFormData.app_id ? 'Select module...' : 'Select app first...', value: '' },
                    ...(modules?.map((module) => ({ label: module.label, value: module.id })) || [])
                  ]}
                  onChange={(value) => setHeaderFormData({ ...headerFormData, module_id: value })}
                  placeholder={headerFormData.app_id ? 'Select module...' : 'Select app first...'}
                  disabled={!headerFormData.app_id}
                />
              </div>

              {/* Priority */}
              <div>
                <CustomDropdown
                  label="Priority"
                  value={headerFormData.priority_id}
                  currentLabel={initiative?.priority?.label || undefined}
                  options={[
                    { label: 'Select priority...', value: '' },
                    ...(priorities?.map((priority) => ({ label: priority.label, value: priority.id })) || [])
                  ]}
                  onChange={(value) => setHeaderFormData({ ...headerFormData, priority_id: value })}
                  placeholder="Select priority..."
                />
              </div>

              {/* Planning Stage */}
              <div>
                <CustomDropdown
                  label="Planning Stage"
                  value={headerFormData.planning_stage_id}
                  currentLabel={initiative?.planning_stage?.label || undefined}
                  options={[
                    { label: 'Select stage...', value: '' },
                    ...(planningStages?.map((stage) => ({ label: stage.label, value: stage.id })) || [])
                  ]}
                  onChange={(value) => setHeaderFormData({ ...headerFormData, planning_stage_id: value })}
                  placeholder="Select stage..."
                />
              </div>

              {/* Target Quarter */}
              <div>
                <CustomDropdown
                  label="Target Quarter"
                  value={headerFormData.target_quarter && headerFormData.target_year ? `${headerFormData.target_quarter}-${headerFormData.target_year}` : '-'}
                  currentLabel={initiative?.target_quarter && initiative?.target_year ? `${initiative.target_quarter} ${initiative.target_year}` : undefined}
                  options={[
                    { label: 'Select quarter...', value: '-' },
                    ...(quarterCalendar?.map((q) => ({ 
                      label: `${q.quarter} ${q.year}`, 
                      value: `${q.quarter}-${q.year}` 
                    })) || [])
                  ]}
                  onChange={(value) => {
                    if (value === '-') {
                      setHeaderFormData({ ...headerFormData, target_quarter: '', target_year: '' });
                    } else {
                      const [quarter, year] = value.split('-');
                      setHeaderFormData({ ...headerFormData, target_quarter: quarter || '', target_year: year || '' });
                    }
                  }}
                  placeholder="Select quarter..."
                />
              </div>

              {/* Governance Notes */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1">
                  Governance Notes
                </label>
                <input
                  type="text"
                  value={headerFormData.governance_notes}
                  onChange={(e) => setHeaderFormData({ ...headerFormData, governance_notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary text-sm"
                  placeholder="Enter governance notes..."
                />
              </div>

              {/* Forge Status - Read Only */}
              <div className="col-span-2 p-3 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg">
                <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1">
                  Forge Status
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-boh-text-light dark:text-boh-text">
                    {initiative?.forge_status?.label || 'Draft'}
                  </span>
                  {initiative?.submitted_to_forge_at && (
                    <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                      (Submitted: {new Date(initiative.submitted_to_forge_at).toLocaleDateString()})
                    </span>
                  )}
                </div>
                <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
                  Forge Status is managed through submit-to-Forge action and Forge decisions.
                </p>
              </div>
            </div>
          ) : (
            /* Display Mode - Clean labeled metadata */
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm mb-3 text-boh-text-sub-light dark:text-boh-text-sub">
              {initiative.owner_user?.full_name && (
                <span>
                  <span className="opacity-60">Owner:</span>{' '}
                  <span className="text-boh-text-light dark:text-boh-text">{initiative.owner_user.full_name}</span>
                </span>
              )}
              {initiative.app?.name && (
                <span>
                  <span className="opacity-60">App:</span>{' '}
                  <span className="text-boh-text-light dark:text-boh-text">{initiative.app.name}</span>
                  {initiative.module?.label && (
                    <span className="text-boh-text-sub-light dark:text-boh-text-sub"> / {initiative.module.label}</span>
                  )}
                </span>
              )}
              {initiative.priority?.label && (
                <span>
                  <span className="opacity-60">Priority:</span>{' '}
                  <span className="text-boh-text-light dark:text-boh-text">{initiative.priority.label}</span>
                </span>
              )}
              {initiative.planning_stage?.label && (
                <span>
                  <span className="opacity-60">Planning:</span>{' '}
                  <span className="text-boh-text-light dark:text-boh-text">{initiative.planning_stage.label}</span>
                </span>
              )}
              {initiative.target_quarter && initiative.target_year && (
                <span>
                  <span className="opacity-60">Target:</span>{' '}
                  <span className="text-boh-text-light dark:text-boh-text">{initiative.target_quarter} {initiative.target_year}</span>
                </span>
              )}
              {initiative.forge_status && (
                <span>
                  <span className="opacity-60">Forge:</span>{' '}
                  <span className="text-boh-primary dark:text-boh-primary">{initiative.forge_status.label}</span>
                  {initiative.submitted_to_forge_at && (
                    <span className="opacity-60 ml-1">
                      ({new Date(initiative.submitted_to_forge_at).toLocaleDateString()})
                    </span>
                  )}
                </span>
              )}
            </div>
          )}

          {/* Lock Banner */}
          {isSubmittedToForge && (
            <div className="mb-3 px-4 py-2 rounded-lg bg-boh-primary/10 dark:bg-boh-primary/10 border border-boh-primary/20 dark:border-boh-primary/20 flex items-center gap-2">
              <svg className="w-4 h-4 text-boh-primary dark:text-boh-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-sm text-boh-primary dark:text-boh-primary font-medium">
                This initiative has been submitted to Forge. Initiative changes are locked.
              </span>
            </div>
          )}

          {/* Super Admin Override Indicator */}
          {isSuperAdmin && isSubmittedToForge && (
            <div className="mb-3 px-4 py-2 rounded-lg bg-boh-success/10 dark:bg-boh-success/10 border border-boh-success/20 dark:border-boh-success/20 flex items-center gap-2">
              <svg className="w-4 h-4 text-boh-success dark:text-boh-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm text-boh-success dark:text-boh-success font-medium">
                Super Admin Override
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Edit/Save/Cancel Buttons */}
            {isHeaderEditable && (
              <>
                {isEditingHeader ? (
                  <>
                    <button
                      onClick={handleSaveHeader}
                      disabled={isSavingHeader}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-boh-success text-white text-sm font-medium hover:bg-boh-success-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingHeader ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Save
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={isSavingHeader}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-boh-border-light dark:border-boh-border text-sm text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditingHeader(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-boh-primary text-white text-sm font-medium hover:bg-boh-primary-dark transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Initiative
                  </button>
                )}
              </>
            )}

            {/* Submit to Forge */}
            {!isSubmittedToForge && isReadyToSubmit && !isEditingHeader && (
              <button
                onClick={handleSubmitToForge}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-boh-success text-white text-sm font-medium hover:bg-boh-success-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Submit to Forge
                  </>
                )}
              </button>
            )}
            {submitSuccess && (
              <span className="px-3 py-1.5 rounded-lg bg-boh-success/10 text-boh-success text-sm font-medium flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Submitted successfully!
              </span>
            )}

            {/* Add Story */}
            {!isSubmittedToForge && !isEditingHeader && (
              <button
                onClick={() => setShowAddStory(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-boh-primary text-white text-sm font-medium hover:bg-boh-primary-dark transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Story
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-boh-border-light dark:border-boh-border text-sm text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column (25%) - User Stories */}
        <div className="w-[25%] min-w-[280px] flex flex-col border-r border-boh-border-light dark:border-boh-border">
          <div className="flex-shrink-0 px-4 py-3 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light/50 dark:bg-boh-surface/50 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wide">
              User Stories ({initiative.stories.length})
            </h3>
            {isSubmittedToForge && (
              <span className="text-xs text-boh-primary dark:text-boh-primary flex items-center gap-1" title="Locked after submission to Forge">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Locked
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {initiative.stories.length === 0 ? (
              <div className="text-center py-8 text-boh-text-sub-light dark:text-boh-text-sub text-sm">
                No user stories yet
              </div>
            ) : (
              initiative.stories.map(story => (
                <StoryListItem
                  key={story.id}
                  story={story}
                  isSelected={selectedStoryId === story.id}
                  onClick={() => {
                    setSelectedStoryId(story.id);
                    setSelectedTaskId(null);
                  }}
                  isLocked={isSubmittedToForge}
                />
              ))
            )}
          </div>
        </div>

        {/* Middle Column (25%) - Tasks */}
        <div className="w-[25%] min-w-[280px] flex flex-col border-r border-boh-border-light dark:border-boh-border">
          <div className="flex-shrink-0 px-4 py-3 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light/50 dark:bg-boh-surface/50">
            <h3 className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wide flex items-center gap-2">
              Tasks
              {isSubmittedToForge && (
                <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub font-normal">
                  (Managed by Forge)
                </span>
              )}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {!isSubmittedToForge ? (
              <div className="text-center py-8 text-boh-text-sub-light dark:text-boh-text-sub text-sm">
                <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Tasks will appear after submission to Forge
              </div>
            ) : !selectedStory ? (
              <div className="text-center py-8 text-boh-text-sub-light dark:text-boh-text-sub text-sm">
                Select a story to view tasks
              </div>
            ) : selectedStory.tasks.length === 0 ? (
              <div className="text-center py-8 text-boh-text-sub-light dark:text-boh-text-sub text-sm">
                No tasks assigned by Forge yet
              </div>
            ) : (
              <div className="space-y-2">
                {selectedStory.tasks.map(task => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    isSelected={selectedTaskId === task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (50%) - Detail Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedTask ? (
            <TaskDetailPanel task={selectedTask} />
          ) : selectedStory ? (
            <StoryDetailPanel
              story={selectedStory}
              onUpdate={(updates) => updateUserStory(selectedStory.id, updates)}
              isLocked={isSubmittedToForge}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-boh-text-sub-light dark:text-boh-text-sub">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">Select a user story to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Story Modal */}
      {showAddStory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-2xl border border-boh-border-light dark:border-boh-border p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-4">Add User Story</h3>
            <input
              type="text"
              value={newStoryTitle}
              onChange={(e) => setNewStoryTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddStory()}
              placeholder="Enter story title..."
              className="w-full px-4 py-3 rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowAddStory(false);
                  setNewStoryTitle('');
                }}
                className="px-4 py-2 rounded-lg border border-boh-border-light dark:border-boh-border text-sm text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStory}
                disabled={!newStoryTitle.trim()}
                className="px-4 py-2 rounded-lg bg-boh-primary text-white text-sm font-medium hover:bg-boh-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Story
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Story List Item Component
interface StoryListItemProps {
  story: UserStory & { tasks: Task[] };
  isSelected: boolean;
  onClick: () => void;
  isLocked: boolean;
}

const StoryListItem: React.FC<StoryListItemProps> = ({ story, isSelected, onClick, isLocked }) => {
  const completedTasks = story.tasks.filter(t => t.status === 'done').length;
  const totalTasks = story.tasks.length;
  const statusOption = STORY_STATUS_OPTIONS.find(s => s.value === story.status);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border transition-all p-3 ${
        isSelected
          ? 'border-boh-primary bg-boh-bg-light dark:bg-boh-surface shadow-sm'
          : 'border-transparent bg-transparent hover:border-boh-border-light/50 dark:hover:border-boh-border/50'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className={`text-sm font-medium leading-tight ${
          isSelected ? 'text-boh-primary dark:text-boh-primary' : 'text-boh-text-light dark:text-boh-text'
        }`}>
          {story.title}
        </h4>
        {isLocked && (
          <svg className="w-3 h-3 text-boh-primary dark:text-boh-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" title="Locked after submission to Forge">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        )}
      </div>
      
      <div className="flex items-center justify-between text-xs text-boh-text-sub-light dark:text-boh-text-sub">
        <div className="flex items-center gap-2">
          <span className={`px-1.5 py-0.5 rounded-full font-medium ${statusOption?.color || ''}`}>
            {statusOption?.label}
          </span>
          <span>• {story.progress}%</span>
        </div>
        {totalTasks > 0 && (
          <span>{completedTasks}/{totalTasks} tasks</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-2 w-full h-1 rounded-full bg-boh-border-light/60 dark:bg-boh-border">
        <div
          className="h-1 rounded-full bg-boh-primary"
          style={{ width: `${Math.min(Math.max(story.progress, 0), 100)}%` }}
        />
      </div>
    </button>
  );
};

// Task List Item Component
interface TaskListItemProps {
  task: Task;
  isSelected: boolean;
  onClick: () => void;
}

const TaskListItem: React.FC<TaskListItemProps> = ({ task, isSelected, onClick }) => {
  const statusOption = TASK_STATUS_OPTIONS.find(s => s.value === task.status);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border transition-all p-3 ${
        isSelected
          ? 'border-boh-primary bg-boh-bg-light dark:bg-boh-surface shadow-sm'
          : 'border-transparent bg-transparent hover:border-boh-border-light/50 dark:hover:border-boh-border/50'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className={`text-sm font-medium leading-tight ${
          isSelected ? 'text-boh-primary dark:text-boh-primary' : 'text-boh-text-light dark:text-boh-text'
        }`}>
          {task.title}
        </h4>
      </div>
      
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`px-1.5 py-0.5 rounded font-medium ${statusOption?.color || ''}`}>
          {statusOption?.label}
        </span>
        {task.assigned_user?.full_name && (
          <span className="text-boh-text-sub-light dark:text-boh-text-sub">
            {task.assigned_user.full_name}
          </span>
        )}
        {task.estimated_hours && (
          <span className="text-boh-text-sub-light dark:text-boh-text-sub">
            {task.estimated_hours}h
          </span>
        )}
      </div>
    </button>
  );
};

// Story Detail Panel Component
interface StoryDetailPanelProps {
  story: UserStory & { tasks: Task[] };
  onUpdate: (updates: Partial<UserStory>) => void;
  isLocked: boolean;
}

const StoryDetailPanel: React.FC<StoryDetailPanelProps> = ({ story, onUpdate, isLocked }) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(story.title);
  const [description, setDescription] = useState(story.description || '');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(story.acceptance_criteria || '');

  const handleSave = () => {
    onUpdate({
      title: title.trim(),
      description: description.trim(),
      acceptance_criteria: acceptanceCriteria.trim()
    });
    setEditing(false);
  };

  const handleStatusChange = (newStatus: UserStory['status']) => {
    onUpdate({ status: newStatus });
  };

  const statusOption = STORY_STATUS_OPTIONS.find(s => s.value === story.status);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light/50 dark:bg-boh-surface/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Story Details</h2>
          {!isLocked && (
            <button
              onClick={() => editing ? setEditing(false) : setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-boh-border-light dark:border-boh-border text-sm text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              {editing ? 'Cancel' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLocked && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-boh-primary/10 dark:bg-boh-primary/10 border border-boh-primary/20 dark:border-boh-primary/20 flex items-center gap-2">
            <svg className="w-4 h-4 text-boh-primary dark:text-boh-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-sm text-boh-primary dark:text-boh-primary">
              Story is locked after submission to Forge
            </span>
          </div>
        )}

        {/* Title */}
        <div className="mb-6">
          {editing ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xl font-semibold bg-transparent border-b-2 border-boh-primary focus:outline-none text-boh-text-light dark:text-boh-text px-0 py-1"
            />
          ) : (
            <h1 className="text-xl font-semibold text-boh-text-light dark:text-boh-text">
              {story.title}
            </h1>
          )}
        </div>

        {/* Status */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wide mb-2">
            Status
          </h3>
          {editing ? (
            <select
              value={story.status}
              onChange={(e) => handleStatusChange(e.target.value as UserStory['status'])}
              className="text-sm px-3 py-2 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary"
            >
              {STORY_STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          ) : (
            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${statusOption?.color || ''}`}>
              {statusOption?.label}
            </span>
          )}
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-boh-text-sub-light dark:text-boh-text-sub">Progress</span>
            <span className="font-medium text-boh-text-light dark:text-boh-text">{story.progress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-boh-border-light/60 dark:bg-boh-border">
            <div
              className="h-2 rounded-full bg-boh-primary transition-all"
              style={{ width: `${Math.min(Math.max(story.progress, 0), 100)}%` }}
            />
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wide mb-2">
            Description
          </h3>
          {editing ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full min-h-[120px] p-3 rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-sm text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary resize-none"
              placeholder="Enter description..."
            />
          ) : (
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub leading-relaxed">
              {story.description || 'No description'}
            </p>
          )}
        </div>

        {/* Acceptance Criteria */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wide mb-2">
            Acceptance Criteria
          </h3>
          {editing ? (
            <textarea
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              className="w-full min-h-[120px] p-3 rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-sm text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary resize-none"
              placeholder="Enter acceptance criteria..."
            />
          ) : (
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub leading-relaxed">
              {story.acceptance_criteria || 'No acceptance criteria'}
            </p>
          )}
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap gap-4 pt-4 border-t border-boh-border-light dark:border-boh-border">
          {story.story_points && (
            <div className="text-sm">
              <span className="text-boh-text-sub-light dark:text-boh-text-sub">Story Points: </span>
              <span className="font-medium text-boh-text-light dark:text-boh-text">{story.story_points}</span>
            </div>
          )}
          {story.estimated_hours && (
            <div className="text-sm">
              <span className="text-boh-text-sub-light dark:text-boh-text-sub">Est. Hours: </span>
              <span className="font-medium text-boh-text-light dark:text-boh-text">{story.estimated_hours}h</span>
            </div>
          )}
          {story.owner_user?.full_name && (
            <div className="text-sm">
              <span className="text-boh-text-sub-light dark:text-boh-text-sub">Story Owner: </span>
              <span className="font-medium text-boh-text-light dark:text-boh-text">{story.owner_user.full_name}</span>
            </div>
          )}
        </div>

        {/* Save button */}
        {editing && (
          <div className="mt-6 flex gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-boh-primary text-white text-sm font-medium hover:bg-boh-primary-dark"
            >
              Save Changes
            </button>
            <button
              onClick={() => {
                setTitle(story.title);
                setDescription(story.description || '');
                setAcceptanceCriteria(story.acceptance_criteria || '');
                setEditing(false);
              }}
              className="px-4 py-2 rounded-lg border border-boh-border-light dark:border-boh-border text-sm text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Task Detail Panel Component
interface TaskDetailPanelProps {
  task: Task;
}

const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({ task }) => {
  const statusOption = TASK_STATUS_OPTIONS.find(s => s.value === task.status);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light/50 dark:bg-boh-surface/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Task Details</h2>
          <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub bg-boh-bg-light dark:bg-boh-bg px-2 py-1 rounded-lg">
            Managed by Forge
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Read-only notice */}
        <div className="mb-6 px-4 py-3 rounded-lg bg-boh-primary/10 dark:bg-boh-primary/10 border border-boh-primary/20 dark:border-boh-primary/20 flex items-center gap-2">
          <svg className="w-4 h-4 text-boh-primary dark:text-boh-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-boh-primary dark:text-boh-primary">
            Tasks are managed by Forge and cannot be edited in Menu
          </span>
        </div>

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-boh-text-light dark:text-boh-text">
            {task.title}
          </h1>
        </div>

        {/* Status */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wide mb-2">
            Status
          </h3>
          <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${statusOption?.color || ''}`}>
            {statusOption?.label}
          </span>
        </div>

        {/* Description */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wide mb-2">
            Description
          </h3>
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub leading-relaxed">
            {task.description || 'No description'}
          </p>
        </div>

        {/* Blocked Reason */}
        {task.blocked_reason && (
          <div className="mb-6 p-4 rounded-lg bg-boh-primary/10 dark:bg-boh-primary/10 border border-boh-primary/20 dark:border-boh-primary/20">
            <h3 className="text-xs font-semibold text-boh-primary dark:text-boh-primary uppercase tracking-wide mb-2">
              Blocked Reason
            </h3>
            <p className="text-sm text-boh-primary dark:text-boh-primary leading-relaxed">
              {task.blocked_reason}
            </p>
          </div>
        )}

        {/* Meta info */}
        <div className="flex flex-wrap gap-4 pt-4 border-t border-boh-border-light dark:border-boh-border">
          {task.estimated_hours && (
            <div className="text-sm">
              <span className="text-boh-text-sub-light dark:text-boh-text-sub">Est. Hours: </span>
              <span className="font-medium text-boh-text-light dark:text-boh-text">{task.estimated_hours}h</span>
            </div>
          )}
          {task.assigned_user?.full_name && (
            <div className="text-sm">
              <span className="text-boh-text-sub-light dark:text-boh-text-sub">Task Assignee: </span>
              <span className="font-medium text-boh-text-light dark:text-boh-text">{task.assigned_user.full_name}</span>
            </div>
          )}
          {task.actual_hours && (
            <div className="text-sm">
              <span className="text-boh-text-sub-light dark:text-boh-text-sub">Actual Hours: </span>
              <span className="font-medium text-boh-text-light dark:text-boh-text">{task.actual_hours}h</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MenuInitiativeDetail;
