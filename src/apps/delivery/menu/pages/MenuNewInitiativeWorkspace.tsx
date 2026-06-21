import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../../lib/supabase';
import type { PlanningStage, PriorityOption, ProductAppModule } from '../../../../types/product';
import { useProductApps, useAppModules, useForgeStatuses } from '../../../../hooks/useProductData';
import { useBohUsers } from '../../../../hooks/useBohUsers';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
const YEARS = [2025, 2026, 2027, 2028, 2029];

// Custom Dropdown Component
interface DropdownOption<T = string | number> {
  label: string;
  value: T;
}

interface CustomDropdownProps<T = string | number> {
  label: string;
  value: T | null | undefined;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  displayFormatter?: (value: T) => string;
}

function CustomDropdown<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  displayFormatter
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
  const displayValue = selectedOption 
    ? (displayFormatter ? displayFormatter(selectedOption.value) : selectedOption.label)
    : placeholder;

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1.5 uppercase tracking-wide">
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

// Inline input for user stories
interface StoryInputRowProps {
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  placeholder?: string;
}

const StoryInputRow: React.FC<StoryInputRowProps> = ({ value, onChange, onRemove, placeholder = "Enter story title..." }) => {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border group hover:border-boh-primary/50 transition-colors">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-boh-text-light dark:text-boh-text focus:outline-none"
      />
      <button
        type="button"
        onClick={onRemove}
        className="p-1.5 rounded-md text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-primary hover:bg-boh-primary-tint transition-colors opacity-0 group-hover:opacity-100"
        title="Remove story"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

const MenuNewInitiativeWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [appId, setAppId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [targetQuarter, setTargetQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [targetYear, setTargetYear] = useState<number>(2026);
  const [planningStageId, setPlanningStageId] = useState('');
  const [priorityId, setPriorityId] = useState('');
  const [governanceNotes, setGovernanceNotes] = useState('');
  const [defaultForgeStatusId, setDefaultForgeStatusId] = useState<string>('');
  
  // User stories state
  const [stories, setStories] = useState<string[]>(['']);
  
  // Reference data
  const [stages, setStages] = useState<PlanningStage[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  
  // Hooks
  const { data: apps } = useProductApps();
  const { data: modules } = useAppModules(appId || undefined);
  const { users: bohUsers } = useBohUsers();

  // Fetch reference data
  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        const { data: stagesData } = await supabase
          .from('boh_planning_stage')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');
        setStages(stagesData || []);
        
        const { data: prioritiesData } = await supabase
          .from('boh_priority')
          .select('*')
          .eq('is_active', true)
          .order('weight', { ascending: false });
        setPriorities(prioritiesData || []);
        
        const { data: draftStatus } = await supabase
          .from('boh_initiative_forge_status')
          .select('id')
          .eq('key', 'draft')
          .single();
        if (draftStatus) {
          setDefaultForgeStatusId(draftStatus.id);
        }
      } catch (err) {
        console.error('Error fetching reference data:', err);
      }
    };
    
    fetchReferenceData();
  }, []);

  // Story management helpers
  const addStory = () => {
    setStories([...stories, '']);
  };

  const updateStory = (index: number, value: string) => {
    const newStories = [...stories];
    newStories[index] = value;
    setStories(newStories);
  };

  const removeStory = (index: number) => {
    if (stories.length === 1) {
      setStories(['']);
      return;
    }
    const newStories = stories.filter((_, i) => i !== index);
    setStories(newStories);
  };

  const getValidStories = () => {
    return stories.filter(s => s.trim().length > 0);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !appId) {
      setError('Title and App are required');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const initiativeData = {
        title: title.trim(),
        description: description.trim(),
        app_id: appId,
        module_id: moduleId || null,
        target_quarter: targetQuarter,
        target_year: targetYear,
        planning_stage_id: planningStageId || null,
        priority_id: priorityId || null,
        owner_user_id: ownerUserId || null,
        governance_notes: governanceNotes || null,
        forge_status_id: defaultForgeStatusId || null,
        progress: 0,
        is_archived: false
      };
      
      const { data, error: insertError } = await supabase
        .from('boh_initiative')
        .insert(initiativeData)
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Create user stories if any valid ones exist
      const validStories = getValidStories();
      if (data && validStories.length > 0) {
        const storyRecords = validStories.map((storyTitle, index) => ({
          initiative_id: data.id,
          title: storyTitle.trim(),
          description: '',
          status: 'not_started',
          sort_order: index + 1,
          is_archived: false,
          progress: 0
        }));
        
        const { error: storiesError } = await supabase
          .from('boh_user_story')
          .insert(storyRecords);
        
        if (storiesError) {
          console.error('Error creating stories:', storiesError);
        }
      }
      
      // Navigate to the newly created initiative detail
      if (data) {
        navigate(`/menu/initiatives/${data.id}`);
      }
    } catch (err: any) {
      console.error('Error saving initiative:', err);
      setError(err.message || 'Failed to save initiative');
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-boh-bg-light dark:bg-boh-bg overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/menu')}
              className="flex items-center gap-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Menu
            </button>
            <div className="h-6 w-px bg-boh-border-light dark:bg-boh-border" />
            <div>
              <h1 className="text-xl font-semibold text-boh-text-light dark:text-boh-text">
                New Initiative
              </h1>
              <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                Create a new initiative with user stories
              </p>
            </div>
          </div>
          
          {/* Actions in header */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/menu')}
              className="px-4 py-2 rounded-lg border border-boh-border-light dark:border-boh-border text-sm text-boh-text-light dark:text-boh-text font-medium hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || !title.trim() || !appId}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-boh-primary text-white text-sm font-medium hover:bg-boh-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Create Initiative
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex-shrink-0 px-6 py-3 bg-boh-primary-tint dark:bg-boh-surface/30 border-b border-boh-border-light dark:border-boh-border">
          <p className="text-sm text-boh-primary dark:text-boh-text-sub">{error}</p>
        </div>
      )}

      {/* Two-Panel Workspace */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Panel - Initiative Details (45%) */}
        <div className="w-[45%] flex flex-col border-r border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
          {/* Panel Header */}
          <div className="flex-shrink-0 px-6 py-3 border-b border-boh-border-light dark:border-boh-border">
            <h2 className="text-sm font-semibold text-boh-text-light dark:text-boh-text uppercase tracking-wide">
              Initiative Details
            </h2>
          </div>
          
          {/* Scrollable Form Content */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1.5 uppercase tracking-wide">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter initiative title"
                className="w-full px-3 py-2.5 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary text-sm"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1.5 uppercase tracking-wide">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the initiative purpose and goals..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary resize-none text-sm"
              />
            </div>

            {/* App & Module Row */}
            <div className="grid grid-cols-2 gap-4">
              <CustomDropdown
                label="App *"
                value={appId}
                options={[
                  { label: 'Select app', value: '' },
                  ...(apps || []).map(app => ({ label: app.name, value: app.id }))
                ]}
                onChange={(value) => {
                  setAppId(value);
                  setModuleId('');
                }}
                placeholder="Select app"
              />
              <CustomDropdown
                label="Module"
                value={moduleId}
                options={[
                  { label: appId ? 'Select module' : 'Select app first', value: '' },
                  ...(modules || []).map((module: ProductAppModule) => ({ label: module.label, value: module.id }))
                ]}
                onChange={(value) => setModuleId(value)}
                placeholder={appId ? 'Select module' : 'Select app first'}
                disabled={!appId}
              />
            </div>

            {/* Target Quarter & Year Row */}
            <div className="grid grid-cols-2 gap-4">
              <CustomDropdown
                label="Target Quarter"
                value={targetQuarter}
                options={QUARTERS.map(q => ({ label: q, value: q }))}
                onChange={(value) => setTargetQuarter(value as typeof targetQuarter)}
                placeholder="Select quarter"
              />
              <CustomDropdown
                label="Target Year"
                value={targetYear}
                options={YEARS.map(y => ({ label: String(y), value: y }))}
                onChange={(value) => setTargetYear(value)}
                displayFormatter={(val) => String(val)}
                placeholder="Select year"
              />
            </div>

            {/* Planning Stage & Priority Row */}
            <div className="grid grid-cols-2 gap-4">
              <CustomDropdown
                label="Planning Stage"
                value={planningStageId}
                options={[
                  { label: 'Select stage', value: '' },
                  ...stages.map(stage => ({ label: stage.label, value: stage.id }))
                ]}
                onChange={(value) => setPlanningStageId(value)}
                placeholder="Select stage"
              />
              <CustomDropdown
                label="Priority"
                value={priorityId}
                options={[
                  { label: 'Select priority', value: '' },
                  ...priorities.map(priority => ({ label: priority.label, value: priority.id }))
                ]}
                onChange={(value) => setPriorityId(value)}
                placeholder="Select priority"
              />
            </div>

            {/* Owner */}
            <CustomDropdown
              label="Owner"
              value={ownerUserId}
              options={[
                { label: 'Select owner', value: '' },
                ...(bohUsers || []).map(user => ({ label: user.full_name || 'Unnamed', value: user.id }))
              ]}
              onChange={(value) => setOwnerUserId(value)}
              placeholder="Select owner"
            />

            {/* Governance Notes */}
            <div>
              <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1.5 uppercase tracking-wide">
                Governance Notes
              </label>
              <textarea
                value={governanceNotes}
                onChange={(e) => setGovernanceNotes(e.target.value)}
                placeholder="Enter governance or compliance notes..."
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary resize-none text-sm"
              />
            </div>

            {/* Forge Status - Read Only */}
            <div className="p-3 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg">
              <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1 uppercase tracking-wide">
                Forge Status
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-boh-text-light dark:text-boh-text">
                  Draft
                </span>
              </div>
              <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
                Will be set automatically on creation
              </p>
            </div>
          </div>
        </div>

        {/* Right Panel - User Stories (55%) */}
        <div className="w-[55%] flex flex-col bg-boh-bg-light dark:bg-boh-bg">
          {/* Panel Header */}
          <div className="flex-shrink-0 px-6 py-3 border-b border-boh-border-light dark:border-boh-border flex items-center justify-between bg-boh-surface-light dark:bg-boh-surface">
            <h2 className="text-sm font-semibold text-boh-text-light dark:text-boh-text uppercase tracking-wide">
              User Stories
            </h2>
            <button
              type="button"
              onClick={addStory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-boh-primary text-white text-xs font-medium hover:bg-boh-primary-dark transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Story
            </button>
          </div>
          
          {/* Scrollable Stories List */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6">
            {stories.length === 0 || (stories.length === 1 && stories[0] === '') ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <div className="w-12 h-12 rounded-full bg-boh-surface-light dark:bg-boh-surface flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-boh-text-sub-light dark:text-boh-text-sub" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-2">
                  No user stories yet
                </p>
                <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub opacity-70 mb-3">
                  Add stories to define what this initiative will deliver
                </p>
                <button
                  type="button"
                  onClick={addStory}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-boh-primary text-white text-xs font-medium hover:bg-boh-primary-dark transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add First Story
                </button>
              </div>
            ) : (
              /* Stories List */
              <div className="space-y-2">
                {stories.map((story, index) => (
                  <StoryInputRow
                    key={index}
                    value={story}
                    onChange={(value) => updateStory(index, value)}
                    onRemove={() => removeStory(index)}
                    placeholder={`Story ${index + 1} title...`}
                  />
                ))}
                
                {/* Add Another Button at bottom */}
                <button
                  type="button"
                  onClick={addStory}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-boh-border-light dark:border-boh-border text-sm text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-primary hover:border-boh-primary/50 transition-colors mt-4"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Another Story
                </button>
              </div>
            )}
          </div>
          
          {/* Story Count Footer */}
          <div className="flex-shrink-0 px-6 py-2 border-t border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
            <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
              {getValidStories().length} story{getValidStories().length !== 1 ? 'ies' : ''} will be created
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuNewInitiativeWorkspace;
