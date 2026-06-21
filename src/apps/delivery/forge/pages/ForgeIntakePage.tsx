import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../../lib/supabase';
import Toast from '../../../../components/Toast';
import { getCurrentBohUserId } from '../../../../boh/api/bohApi';

interface IntakeInitiative {
  id: string;
  title: string;
  description: string | null;
  target_quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' | null;
  target_year: number | null;
  owner_user_id: string | null;
  app_id: string | null;
  priority_id: string | null;
  forge_status_id: string | null;
  submitted_to_forge_at: string | null;
  user_story_count: number;
  workstream_count: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  forge_status?: {
    key: string;
    label: string;
  } | null;
  app?: {
    id: string;
    name: string;
  } | null;
  owner_user?: {
    id: string;
    full_name: string | null;
  } | null;
  priority?: {
    id: string;
    label: string;
    color_token?: string;
  } | null;
}

const ForgeIntakePage: React.FC = () => {
  const navigate = useNavigate();
  const [initiatives, setInitiatives] = useState<IntakeInitiative[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [creatingWorkstreamId, setCreatingWorkstreamId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [isToastVisible, setIsToastVisible] = useState(false);

  // Fetch submitted initiatives that don't have workstreams
  useEffect(() => {
    const fetchIntakeInitiatives = async () => {
      setIsLoading(true);
      try {
        // Get initiatives with forge_status = 'submitted' AND submitted_to_forge_at IS NOT NULL
        // that have no workstreams
        const { data: submittedInitiatives, error: initiativesError } = await supabase
          .from('boh_initiative')
          .select(`
            id,
            title,
            description,
            target_quarter,
            target_year,
            owner_user_id,
            app_id,
            priority_id,
            forge_status_id,
            submitted_to_forge_at,
            created_at,
            updated_at,
            forge_status:forge_status_id (key, label),
            app:app_id (id, name),
            owner_user:owner_user_id (id, full_name),
            priority:priority_id (id, label, color_token)
          `)
          .eq('forge_status.key', 'submitted')
          .not('submitted_to_forge_at', 'is', null)
          .eq('is_archived', false);

        if (initiativesError) {
          console.error('Error fetching initiatives:', initiativesError);
          setToastMessage('Failed to load intake initiatives');
          setIsToastVisible(true);
          return;
        }

        if (!submittedInitiatives || submittedInitiatives.length === 0) {
          setInitiatives([]);
          return;
        }

        const initiativeIds = submittedInitiatives.map(i => i.id);

        // Fetch workstream counts for these initiatives
        const { data: workstreamsData, error: workstreamsError } = await supabase
          .from('boh_workstream')
          .select('initiative_id')
          .in('initiative_id', initiativeIds);

        if (workstreamsError) {
          console.error('Error fetching workstreams:', workstreamsError);
        }

        // Fetch user story counts for these initiatives
        const { data: userStoriesData, error: userStoriesError } = await supabase
          .from('boh_user_story')
          .select('initiative_id')
          .in('initiative_id', initiativeIds);

        if (userStoriesError) {
          console.error('Error fetching user stories:', userStoriesError);
        }

        // Count workstreams and stories per initiative
        const workstreamCounts: Record<string, number> = {};
        (workstreamsData || []).forEach(ws => {
          workstreamCounts[ws.initiative_id] = (workstreamCounts[ws.initiative_id] || 0) + 1;
        });

        const userStoryCounts: Record<string, number> = {};
        (userStoriesData || []).forEach(us => {
          userStoryCounts[us.initiative_id] = (userStoryCounts[us.initiative_id] || 0) + 1;
        });

        // Filter to only initiatives with NO workstreams
        const intakeItems = submittedInitiatives
          .filter(initiative => !workstreamCounts[initiative.id])
          .map(initiative => ({
            ...initiative,
            workstream_count: workstreamCounts[initiative.id] || 0,
            user_story_count: userStoryCounts[initiative.id] || 0,
          }));

        setInitiatives(intakeItems);
      } catch (error) {
        console.error('Error in fetchIntakeInitiatives:', error);
        setToastMessage('Failed to load intake initiatives');
        setIsToastVisible(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIntakeInitiatives();
  }, []);

  const handleCreateWorkstream = async (initiative: IntakeInitiative) => {
    // Disable button if no owner or no stories
    if (!initiative.owner_user_id || initiative.user_story_count === 0) {
      setToastMessage('Cannot create workstream: initiative must have an owner and at least one user story');
      setIsToastVisible(true);
      return;
    }

    setCreatingWorkstreamId(initiative.id);

    try {
      // Step 1: Check for duplicate workstream
      const { data: existingWorkstream, error: checkError } = await supabase
        .from('boh_workstream')
        .select('id')
        .eq('initiative_id', initiative.id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking for existing workstream:', checkError);
        setToastMessage('Error checking for existing workstream');
        setIsToastVisible(true);
        setCreatingWorkstreamId(null);
        return;
      }

      if (existingWorkstream) {
        setToastMessage('Workstream already exists for this initiative');
        setIsToastVisible(true);
        setCreatingWorkstreamId(null);
        // Remove initiative from list since it now has a workstream
        setInitiatives(prev => prev.filter(i => i.id !== initiative.id));
        return;
      }

      // Step 2: Resolve BOH user for created_by. Supabase Auth users are auth only.
      const createdBy = await getCurrentBohUserId();
      if (!createdBy) {
        setToastMessage('Unable to find current BOH user. Please re-authenticate.');
        setIsToastVisible(true);
        setCreatingWorkstreamId(null);
        return;
      }

      // Step 3: Create the workstream
      const { data: newWorkstream, error: createError } = await supabase
        .from('boh_workstream')
        .insert({
          initiative_id: initiative.id,
          title: initiative.title,
          status: 'active',
          assigned_to: initiative.owner_user_id,
          created_by: createdBy,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating workstream:', createError);
        setToastMessage(`Failed to create workstream: ${createError.message}`);
        setIsToastVisible(true);
        setCreatingWorkstreamId(null);
        return;
      }

      // Step 4: Success - remove initiative from Intake list and show toast
      setInitiatives(prev => prev.filter(i => i.id !== initiative.id));
      setToastMessage('Workstream created successfully');
      setIsToastVisible(true);

    } catch (error) {
      console.error('Error in handleCreateWorkstream:', error);
      setToastMessage('An unexpected error occurred while creating the workstream');
      setIsToastVisible(true);
    } finally {
      setCreatingWorkstreamId(null);
    }
  };

  // Readiness indicators
  const getReadinessBadges = (initiative: IntakeInitiative) => {
    const badges = [];
    if (!initiative.owner_user_id) {
      badges.push({ label: 'No owner', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', type: 'blocking' });
    }
    if (initiative.user_story_count === 0) {
      badges.push({ label: 'No stories', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', type: 'blocking' });
    }
    if (!initiative.description) {
      badges.push({ label: 'No description', color: 'bg-boh-bg-light text-boh-text-sub-light dark:bg-boh-bg dark:text-boh-text-sub', type: 'warning' });
    }
    return badges;
  };

  const canCreateWorkstream = (initiative: IntakeInitiative): boolean => {
    return !!initiative.owner_user_id && initiative.user_story_count > 0;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-boh-bg-light dark:bg-boh-bg">
        <div className="border-b border-boh-border-light dark:border-boh-border px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-semibold tracking-tight text-boh-text-light dark:text-boh-text">Intake</h1>
          <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
            Submitted initiatives awaiting workstream creation
          </p>
        </div>
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-4 animate-pulse">
                <div className="h-5 w-3/4 rounded bg-boh-skeleton mb-3" />
                <div className="h-4 w-1/2 rounded bg-boh-skeleton mb-4" />
                <div className="flex gap-2 mb-4">
                  <div className="h-6 w-16 rounded bg-boh-skeleton" />
                  <div className="h-6 w-16 rounded bg-boh-skeleton" />
                </div>
                <div className="h-10 w-full rounded bg-boh-skeleton" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-boh-bg-light dark:bg-boh-bg">
      {/* Header */}
      <div className="border-b border-boh-border-light dark:border-boh-border px-4 sm:px-6 lg:px-8 py-4">
        <h1 className="text-2xl font-semibold tracking-tight text-boh-text-light dark:text-boh-text">Intake</h1>
        <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
          Submitted initiatives awaiting workstream creation
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {initiatives.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <svg className="w-16 h-16 text-boh-text-sub-light dark:text-boh-text-sub mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text mb-2">
              No initiatives awaiting intake
            </h3>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub max-w-md">
              All submitted initiatives have been assigned to workstreams.
              New initiatives will appear here when they are submitted to Forge.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {initiatives.map((initiative) => {
              const readinessBadges = getReadinessBadges(initiative);
              const isCreating = creatingWorkstreamId === initiative.id;
              const canCreate = canCreateWorkstream(initiative);

              return (
                <div
                  key={initiative.id}
                  className="rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-4 hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* Title and Priority */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-boh-text-light dark:text-boh-text leading-tight flex-1">
                      {initiative.title}
                    </h3>
                    {initiative.priority && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-boh-bg-light dark:bg-boh-bg text-boh-text-sub-light dark:text-boh-text-sub whitespace-nowrap">
                        {initiative.priority.label}
                      </span>
                    )}
                  </div>

                  {/* App and Quarter */}
                  <div className="flex items-center gap-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-2">
                    <span>{initiative.app?.name || 'Unknown app'}</span>
                    {initiative.target_quarter && initiative.target_year && (
                      <>
                        <span className="text-boh-border-light dark:text-boh-border">•</span>
                        <span>{initiative.target_quarter} {initiative.target_year}</span>
                      </>
                    )}
                  </div>

                  {/* Owner and Story Count */}
                  <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-2">
                    Owner: <span className="text-boh-text-light dark:text-boh-text">
                      {initiative.owner_user?.full_name || 'Unassigned'}
                    </span>
                    <span className="text-boh-border-light dark:text-boh-border mx-2">•</span>
                    Stories: <span className="text-boh-text-light dark:text-boh-text">
                      {initiative.user_story_count}
                    </span>
                  </div>

                  {/* Description Preview */}
                  {initiative.description && (
                    <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub line-clamp-2 mb-3">
                      {initiative.description}
                    </p>
                  )}

                  {/* Readiness Badges */}
                  {readinessBadges.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {readinessBadges.map((badge, idx) => (
                        <span
                          key={idx}
                          className={`text-[10px] px-2 py-0.5 rounded font-medium ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Create Workstream Button */}
                  <div className="mt-auto pt-3">
                    <button
                      onClick={() => handleCreateWorkstream(initiative)}
                      disabled={!canCreate || isCreating}
                      className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        canCreate && !isCreating
                          ? 'bg-boh-primary text-white hover:bg-boh-primary/90'
                          : 'bg-boh-border-light dark:bg-boh-border text-boh-text-sub-light dark:text-boh-text-sub cursor-not-allowed'
                      }`}
                    >
                      {isCreating ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Creating...
                        </span>
                      ) : (
                        'Create Workstream'
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Toast
        message={toastMessage}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
        type="info"
      />
    </div>
  );
};

export default ForgeIntakePage;
