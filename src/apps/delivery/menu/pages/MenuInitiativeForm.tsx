import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../../lib/supabase';
import type { PlanningStage, PriorityOption, ProductAppSummary, ProductAppModule } from '../../../../types/product';
import { useProductApps, useAppModules, useForgeStatuses } from '../../../../hooks/useProductData';
import { useBohUsers } from '../../../../hooks/useBohUsers';
import MenuNewInitiativeWorkspace from './MenuNewInitiativeWorkspace';

interface MenuInitiativeFormProps {
  mode: 'create' | 'edit';
}

// Unified field order:
// 1. Title
// 2. Description
// 3. Initiative Owner
// 4. App
// 5. Module (dependent on App)
// 6. Target Quarter
// 7. Planning Stage
// 8. Priority
// 9. Governance Notes
// 10. Forge Status (read-only, defaults to Draft on create)

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
const YEARS = [2025, 2026, 2027, 2028, 2029];

// Default Forge Status for new initiatives
const DEFAULT_FORGE_STATUS_ID = 'draft'; // Will be resolved from database

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
      <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
        {label}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={`w-full h-12 px-4 rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface flex items-center justify-between gap-3 text-left shadow-sm transition-all ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-boh-primary cursor-pointer'
        } ${isOpen ? 'ring-2 ring-boh-primary border-boh-primary' : ''}`}
      >
        <span className="text-sm font-medium text-boh-text-light dark:text-boh-text truncate">
          {displayValue}
        </span>
        <svg
          className={`w-5 h-5 text-boh-text-sub-light dark:text-boh-text-sub transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
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
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface shadow-xl max-h-60 overflow-y-auto boh-dropdown-scrollbar">
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              className={`w-full px-4 py-3 text-left text-sm transition-colors ${
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

const MenuInitiativeForm: React.FC<MenuInitiativeFormProps> = ({ mode }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state - unified field structure
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
  const [forgeStatusId, setForgeStatusId] = useState('');
  const [submittedToForgeAt, setSubmittedToForgeAt] = useState<string | null>(null);
  // User stories state for create mode
  const [stories, setStories] = useState<string[]>(['']);
  
  // Reference data state
  const [stages, setStages] = useState<PlanningStage[]>([]);
  const [priorities, setPriorities] = useState<PriorityOption[]>([]);
  const [defaultForgeStatusId, setDefaultForgeStatusId] = useState<string>('');
  
  // Use hooks for reference data (after appId is declared)
  const { data: apps } = useProductApps();
  const { data: modules, refetch: refetchModules } = useAppModules(appId || undefined);
  const { data: forgeStatuses } = useForgeStatuses();
  const { users: bohUsers } = useBohUsers();

  // Fetch stages, priorities, and default forge status
  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        // Fetch planning stages
        const { data: stagesData } = await supabase
          .from('boh_planning_stage')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');
        setStages(stagesData || []);
        
        // Fetch priorities
        const { data: prioritiesData } = await supabase
          .from('boh_priority')
          .select('*')
          .eq('is_active', true)
          .order('weight', { ascending: false });
        setPriorities(prioritiesData || []);
        
        // Fetch default forge status (draft)
        const { data: draftStatus } = await supabase
          .from('boh_initiative_forge_status')
          .select('id')
          .eq('key', 'draft')
          .single();
        if (draftStatus) {
          setDefaultForgeStatusId(draftStatus.id);
          if (mode === 'create') {
            setForgeStatusId(draftStatus.id);
          }
        }
      } catch (err) {
        console.error('Error fetching reference data:', err);
      }
    };
    
    fetchReferenceData();
  }, [mode]);

  // Load existing initiative for edit mode
  useEffect(() => {
    if (mode === 'edit' && id) {
      const loadInitiative = async () => {
        setIsLoading(true);
        try {
          const { data, error } = await supabase
            .from('boh_initiative')
            .select('*')
            .eq('id', id)
            .single();
          
          if (error) throw error;
          if (data) {
            setTitle(data.title || '');
            setDescription(data.description || '');
            setOwnerUserId(data.owner_user_id || '');
            setAppId(data.app_id || '');
            setModuleId(data.module_id || '');
            setTargetQuarter(data.target_quarter || 'Q1');
            setTargetYear(data.target_year || 2026);
            setPlanningStageId(data.planning_stage_id || '');
            setPriorityId(data.priority_id || '');
            setGovernanceNotes(data.governance_notes || '');
            setForgeStatusId(data.forge_status_id || '');
            setSubmittedToForgeAt(data.submitted_to_forge_at || null);
          }
        } catch (err: any) {
          setError(err.message || 'Failed to load initiative');
        } finally {
          setIsLoading(false);
        }
      };
      
      loadInitiative();
    }
  }, [mode, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
        forge_status_id: mode === 'create' ? defaultForgeStatusId || null : forgeStatusId || null,
        progress: 0,
        is_archived: false
      };
      
      if (mode === 'create') {
        const { data, error } = await supabase
          .from('boh_initiative')
          .insert(initiativeData)
          .select()
          .single();
        
        if (error) throw error;
        
        // Navigate to the newly created initiative detail
        if (data) {
          navigate(`/menu/initiatives/${data.id}`);
        }
      } else if (mode === 'edit' && id) {
        const { error } = await supabase
          .from('boh_initiative')
          .update(initiativeData)
          .eq('id', id);
        
        if (error) throw error;
        
        // Navigate to the updated initiative detail
        navigate(`/menu/initiatives/${id}`);
      }
    } catch (err: any) {
      console.error('Error saving initiative:', err);
      setError(err.message || 'Failed to save initiative');
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-boh-bg-light dark:bg-boh-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-boh-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Loading...</span>
        </div>
      </div>
    );
  }

  // CREATE MODE - Use new two-panel workspace
  if (mode === 'create') {
    return <MenuNewInitiativeWorkspace />;
  }

  // EDIT MODE - Keep original single-column layout

  return (
    <div className="h-full overflow-y-auto bg-boh-bg-light dark:bg-boh-bg">
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(mode === 'edit' && id ? `/menu/initiatives/${id}` : '/menu')}
            className="flex items-center gap-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-primary transition-colors mb-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          
          <h1 className="text-2xl font-semibold text-boh-text-light dark:text-boh-text">
            {mode === 'create' ? 'New Initiative' : 'Edit Initiative'}
          </h1>
          <p className="text-boh-text-sub-light dark:text-boh-text-sub mt-1">
            {mode === 'create' 
              ? 'Create a new initiative for strategic planning' 
              : 'Update initiative details'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-boh-primary-tint dark:bg-boh-surface/30 border border-boh-border-light dark:border-boh-border text-boh-primary dark:text-boh-text-sub text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter initiative title"
              className="w-full px-4 py-3 rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the initiative..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary resize-none"
            />
          </div>

          {/* App */}
          <CustomDropdown
            label="App *"
            value={appId}
            options={[
              { label: 'Select an app', value: '' },
              ...(apps || []).map(app => ({ label: app.name, value: app.id }))
            ]}
            onChange={(value) => {
              setAppId(value);
              setModuleId(''); // Reset module when app changes
            }}
            placeholder="Select an app"
          />

          {/* Module - dependent on App */}
          <CustomDropdown
            label="Module"
            value={moduleId}
            options={[
              { label: appId ? 'Select a module' : 'Select app first', value: '' },
              ...(modules || []).map((module: ProductAppModule) => ({ label: module.label, value: module.id }))
            ]}
            onChange={(value) => setModuleId(value)}
            placeholder={appId ? 'Select a module' : 'Select app first'}
            disabled={!appId}
          />

          {/* Quarter & Year */}
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

          {/* Planning Stage */}
          <CustomDropdown
            label="Planning Stage"
            value={planningStageId}
            options={[
              { label: 'Select a stage', value: '' },
              ...stages.map(stage => ({ label: stage.label, value: stage.id }))
            ]}
            onChange={(value) => setPlanningStageId(value)}
            placeholder="Select a stage"
          />

          {/* Priority */}
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
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
              Governance Notes
            </label>
            <textarea
              value={governanceNotes}
              onChange={(e) => setGovernanceNotes(e.target.value)}
              placeholder="Enter governance notes..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary resize-none"
            />
          </div>

          {/* Forge Status - Read Only */}
          <div className="p-4 rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg">
            <label className="block text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-2">
              Forge Status
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-boh-text-light dark:text-boh-text">
                {mode === 'create' 
                  ? 'Draft (will be set on create)'
                  : forgeStatuses?.find(s => s.id === forgeStatusId)?.label || 'Draft'
                }
              </span>
              {submittedToForgeAt && (
                <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                  (Submitted: {new Date(submittedToForgeAt).toLocaleDateString()})
                </span>
              )}
            </div>
            <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
              Forge Status is managed through the submit-to-Forge action and Forge decisions.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-boh-border-light dark:border-boh-border">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-boh-primary text-white font-medium hover:bg-boh-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {mode === 'create' ? 'Create Initiative' : 'Save Changes'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate(mode === 'edit' && id ? `/menu/initiatives/${id}` : '/menu')}
              className="px-6 py-3 rounded-xl border border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text font-medium hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MenuInitiativeForm;
