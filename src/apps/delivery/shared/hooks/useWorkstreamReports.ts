import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../../lib/supabase';

export interface WorkstreamHealth {
  workstream_id: string;
  workstream_title: string;
  app_id: string;
  app_name: string;
  owner_id: string | null;
  owner_name: string | null;
  progress: number;
  status: string;
  story_count: number;
  completed_story_count: number;
  task_count: number;
  completed_task_count: number;
  linked_releases_count: number;
  risk_level: 'high' | 'medium' | 'low';
  risk_factors: string[];
  target_quarter: string | null;
  target_year: number | null;
}

export interface ExecutiveSummaryMetrics {
  total_workstreams: number;
  percent_with_owner: number;
  percent_with_release: number;
  percent_completed: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  total_stories: number;
  completed_stories: number;
  total_tasks: number;
  completed_tasks: number;
  at_risk_workstreams: WorkstreamHealth[];
  releases_needing_attention: Array<{
    release_id: string;
    version_label: string;
    incomplete_stories: number;
    unresolved_tasks: number;
  }>;
  generated_at: string;
}

interface UseWorkstreamExecutiveSummaryOptions {
  quarter?: string;
  year?: number;
  app_id?: string;
  enabled?: boolean;
}

interface UseWorkstreamHealthOptions {
  quarter?: string;
  year?: number;
  app_id?: string;
  status?: string;
  risk_level?: string;
  enabled?: boolean;
}

// Calculate risk level for a workstream
function calculateRiskLevel(
  hasOwner: boolean,
  hasRelease: boolean,
  status: string,
  progress: number,
  incompleteStories: number
): { level: 'high' | 'medium' | 'low'; factors: string[] } {
  let score = 0;
  const factors: string[] = [];

  if (!hasOwner) {
    score += 2;
    factors.push('No owner assigned');
  }
  if (!hasRelease) {
    score += 2;
    factors.push('No linked release');
  }
  if (status === 'blocked') {
    score += 3;
    factors.push('Status: blocked');
  }
  if (progress < 25) {
    score += 1;
    factors.push('Low progress (< 25%)');
  }
  if (incompleteStories > 0) {
    score += 1;
    factors.push('Incomplete stories');
  }

  if (score >= 4) return { level: 'high', factors };
  if (score >= 2) return { level: 'medium', factors };
  return { level: 'low', factors };
}

// Fetch workstream executive summary
export function useWorkstreamExecutiveSummary(options: UseWorkstreamExecutiveSummaryOptions) {
  const [data, setData] = useState<ExecutiveSummaryMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Authentication required');
        return;
      }

      // Fetch workstreams with related data
      // Note: boh_workstream has multiple FKs to boh_user (assigned_to, created_by)
      // so we must use explicit relationship names to avoid ambiguity
      let query = supabase
        .from('boh_workstream')
        .select(`
          *,
          initiative:boh_initiative(
            id,
            target_quarter,
            target_year,
            boh_app(id, name)
          ),
          assigned_user:boh_user!boh_workstream_assigned_to_fkey(id, full_name),
          workstream_approval:boh_workstream_approval(status),
          boh_user_story!workstream_id(id, status, progress)
        `)
        .order('created_at', { ascending: false });

      if (options.quarter && options.year) {
        query = query.eq('initiative.target_quarter', options.quarter)
                     .eq('initiative.target_year', options.year);
      }

      if (options.app_id) {
        query = query.eq('initiative.app_id', options.app_id);
      }

      const { data: workstreams, error: wsError } = await query;

      if (wsError) {
        throw new Error(`Failed to load workstreams: ${wsError.message}`);
      }

      if (!workstreams || workstreams.length === 0) {
        setData({
          total_workstreams: 0,
          percent_with_owner: 0,
          percent_with_release: 0,
          percent_completed: 0,
          high_risk_count: 0,
          medium_risk_count: 0,
          low_risk_count: 0,
          total_stories: 0,
          completed_stories: 0,
          total_tasks: 0,
          completed_tasks: 0,
          at_risk_workstreams: [],
          releases_needing_attention: [],
          generated_at: new Date().toISOString(),
        });
        return;
      }

      // Fetch all user stories for these workstreams
      const workstreamIds = workstreams.map(w => w.id);
      const { data: stories, error: storiesError } = await supabase
        .from('boh_user_story')
        .select('*, boh_task!user_story_id(id, completed_at)')
        .in('workstream_id', workstreamIds);

      if (storiesError) {
        console.error('Error fetching stories:', storiesError);
      }

      // Process data
      const storiesByWorkstream: Record<string, typeof stories> = {};
      (stories || []).forEach(story => {
        if (!storiesByWorkstream[story.workstream_id]) {
          storiesByWorkstream[story.workstream_id] = [];
        }
        storiesByWorkstream[story.workstream_id].push(story);
      });

      // Calculate metrics
      let totalStories = 0;
      let completedStories = 0;
      let totalTasks = 0;
      let completedTasks = 0;
      let withOwner = 0;
      let withRelease = 0;
      let completed = 0;
      let highRisk = 0;
      let mediumRisk = 0;
      let lowRisk = 0;

      const atRiskWorkstreams: WorkstreamHealth[] = [];

      workstreams.forEach(workstream => {
        const wsStories = storiesByWorkstream[workstream.id] || [];
        const wsCompletedStories = wsStories.filter(s => 
          s.status === 'done' || s.boh_task?.every((t: any) => t.completed_at)
        ).length;
        
        const wsTasks = wsStories.flatMap(s => s.boh_task || []);
        const wsCompletedTasks = wsTasks.filter((t: any) => t.completed_at).length;

        totalStories += wsStories.length;
        completedStories += wsCompletedStories;
        totalTasks += wsTasks.length;
        completedTasks += wsCompletedTasks;

        const hasOwner = !!workstream.assigned_to || !!workstream.assigned_user;
        const hasRelease = workstream.initiative?.boh_app?.id != null; // Simplified check
        const isCompleted = workstream.progress === 100 || wsCompletedStories === wsStories.length;

        if (hasOwner) withOwner++;
        if (hasRelease) withRelease++;
        if (isCompleted) completed++;

        const risk = calculateRiskLevel(
          hasOwner,
          hasRelease,
          workstream.status,
          workstream.progress || 0,
          wsStories.length - wsCompletedStories
        );

        if (risk.level === 'high') highRisk++;
        else if (risk.level === 'medium') mediumRisk++;
        else lowRisk++;

        if (risk.level !== 'low') {
          atRiskWorkstreams.push({
            workstream_id: workstream.id,
            workstream_title: workstream.title || 'Untitled',
            app_id: workstream.initiative?.boh_app?.id || '',
            app_name: workstream.initiative?.boh_app?.name || 'Unknown App',
            owner_id: workstream.assigned_to,
            owner_name: workstream.assigned_user?.full_name || null,
            progress: workstream.progress || 0,
            status: workstream.status || 'unknown',
            story_count: wsStories.length,
            completed_story_count: wsCompletedStories,
            task_count: wsTasks.length,
            completed_task_count: wsCompletedTasks,
            linked_releases_count: 0, // Will be fetched separately if needed
            risk_level: risk.level,
            risk_factors: risk.factors,
            target_quarter: workstream.initiative?.target_quarter || null,
            target_year: workstream.initiative?.target_year || null,
          });
        }
      });

      // Fetch releases needing attention
      const { data: releases, error: releasesError } = await supabase
        .from('boh_release_version')
        .select('id, version_label, status')
        .in('status', ['in progress', 'planned']);

      const releasesNeedingAttention: ExecutiveSummaryMetrics['releases_needing_attention'] = [];
      
      if (!releasesError && releases) {
        for (const release of releases) {
          // Count incomplete stories linked to this release
          const { count: incompleteCount } = await supabase
            .from('boh_user_story')
            .select('*', { count: 'exact', head: true })
            .eq('target_release_id', release.id)
            .neq('status', 'done');

          if (incompleteCount && incompleteCount > 0) {
            releasesNeedingAttention.push({
              release_id: release.id,
              version_label: release.version_label || 'Unknown',
              incomplete_stories: incompleteCount,
              unresolved_tasks: 0, // Can be enhanced
            });
          }
        }
      }

      setData({
        total_workstreams: workstreams.length,
        percent_with_owner: workstreams.length > 0 ? Math.round((withOwner / workstreams.length) * 100) : 0,
        percent_with_release: workstreams.length > 0 ? Math.round((withRelease / workstreams.length) * 100) : 0,
        percent_completed: workstreams.length > 0 ? Math.round((completed / workstreams.length) * 100) : 0,
        high_risk_count: highRisk,
        medium_risk_count: mediumRisk,
        low_risk_count: lowRisk,
        total_stories: totalStories,
        completed_stories: completedStories,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        at_risk_workstreams: atRiskWorkstreams.slice(0, 10), // Top 10 at risk
        releases_needing_attention: releasesNeedingAttention.slice(0, 5),
        generated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[useWorkstreamExecutiveSummary] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load executive summary');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [options.quarter, options.year, options.app_id]);

  useEffect(() => {
    if (options.enabled) {
      fetchData();
    }
  }, [fetchData, options.enabled]);

  return { data, isLoading, error, refetch: fetchData };
}

// Fetch workstream health details
export function useWorkstreamHealth(options: UseWorkstreamHealthOptions) {
  const [data, setData] = useState<WorkstreamHealth[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Authentication required');
        return;
      }

      // Fetch workstreams with full joins
      // Note: boh_workstream has multiple FKs to boh_user (assigned_to, created_by)
      // so we must use explicit relationship names to avoid ambiguity
      let query = supabase
        .from('boh_workstream')
        .select(`
          *,
          initiative:boh_initiative(
            id,
            target_quarter,
            target_year,
            boh_app(id, name)
          ),
          assigned_user:boh_user!boh_workstream_assigned_to_fkey(id, full_name),
          workstream_approval:boh_workstream_approval(status),
          boh_user_story!workstream_id(id, status, progress)
        `);

      if (options.quarter && options.year) {
        query = query.eq('initiative.target_quarter', options.quarter)
                     .eq('initiative.target_year', options.year);
      }

      if (options.app_id) {
        query = query.eq('initiative.app_id', options.app_id);
      }

      if (options.status) {
        query = query.eq('status', options.status);
      }

      query = query.order('created_at', { ascending: false });

      const { data: workstreams, error: wsError } = await query;

      if (wsError) {
        throw new Error(`Failed to load workstreams: ${wsError.message}`);
      }

      // Fetch all stories and tasks
      const workstreamIds = (workstreams || []).map(w => w.id);
      let stories: any[] = [];
      
      if (workstreamIds.length > 0) {
        const { data: storiesData } = await supabase
          .from('boh_user_story')
          .select(`
            *,
            boh_task!user_story_id(id, completed_at)
          `)
          .in('workstream_id', workstreamIds);
        
        stories = storiesData || [];
      }

      // Group stories by workstream
      const storiesByWorkstream: Record<string, typeof stories> = {};
      stories.forEach(story => {
        if (!storiesByWorkstream[story.workstream_id]) {
          storiesByWorkstream[story.workstream_id] = [];
        }
        storiesByWorkstream[story.workstream_id].push(story);
      });

      // Fetch release links via stories
      const storyIds = stories.map(s => s.id);
      let releaseLinks: Record<string, number> = {};
      
      if (storyIds.length > 0) {
        const { data: releaseStories } = await supabase
          .from('boh_user_story')
          .select('workstream_id, target_release_id')
          .in('id', storyIds)
          .not('target_release_id', 'is', null);
        
        (releaseStories || []).forEach((rs: any) => {
          releaseLinks[rs.workstream_id] = (releaseLinks[rs.workstream_id] || 0) + 1;
        });
      }

      // Process workstream health data
      const healthData: WorkstreamHealth[] = (workstreams || []).map(workstream => {
        const wsStories = storiesByWorkstream[workstream.id] || [];
        const wsCompletedStories = wsStories.filter(s => 
          s.status === 'done' || s.boh_task?.every((t: any) => t.completed_at)
        ).length;
        
        const wsTasks = wsStories.flatMap(s => s.boh_task || []);
        const wsCompletedTasks = wsTasks.filter((t: any) => t.completed_at).length;

        const hasOwner = !!workstream.assigned_to || !!workstream.assigned_user;
        const hasRelease = !!releaseLinks[workstream.id];

        const risk = calculateRiskLevel(
          hasOwner,
          hasRelease,
          workstream.status,
          workstream.progress || 0,
          wsStories.length - wsCompletedStories
        );

        // Filter by risk level if specified
        if (options.risk_level && risk.level !== options.risk_level) {
          return null;
        }

        return {
          workstream_id: workstream.id,
          workstream_title: workstream.title || 'Untitled',
          app_id: workstream.initiative?.boh_app?.id || '',
          app_name: workstream.initiative?.boh_app?.name || 'Unknown App',
          owner_id: workstream.assigned_to,
          owner_name: workstream.assigned_user?.full_name || null,
          progress: workstream.progress || 0,
          status: workstream.status || 'unknown',
          story_count: wsStories.length,
          completed_story_count: wsCompletedStories,
          task_count: wsTasks.length,
          completed_task_count: wsCompletedTasks,
          linked_releases_count: releaseLinks[workstream.id] || 0,
          risk_level: risk.level,
          risk_factors: risk.factors,
          target_quarter: workstream.initiative?.target_quarter || null,
          target_year: workstream.initiative?.target_year || null,
        };
      }).filter((w): w is WorkstreamHealth => w !== null);

      setData(healthData);
    } catch (err) {
      console.error('[useWorkstreamHealth] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workstream health data');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [options.quarter, options.year, options.app_id, options.status, options.risk_level]);

  useEffect(() => {
    if (options.enabled) {
      fetchData();
    }
  }, [fetchData, options.enabled]);

  return { data, isLoading, error, refetch: fetchData };
}
