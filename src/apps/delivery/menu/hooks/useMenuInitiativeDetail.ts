import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../../lib/supabase';
import type { Initiative, UserStory, Task } from '../../../../types/product';

interface InitiativeWithStories extends Initiative {
  stories: (UserStory & { tasks: Task[] })[];
}

interface UseMenuInitiativeDetailReturn {
  initiative: InitiativeWithStories | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  updateInitiative: (updates: Partial<Initiative>) => Promise<boolean>;
  addUserStory: (story: Omit<UserStory, 'id' | 'created_at' | 'updated_at'>) => Promise<UserStory | null>;
  updateUserStory: (storyId: string, updates: Partial<UserStory>) => Promise<boolean>;
  addTask: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => Promise<Task | null>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<boolean>;
  submitToForge: () => Promise<{ success: boolean; error?: string }>;
  isReadyToSubmit: boolean;
}

export function useMenuInitiativeDetail(initiativeId: string | undefined): UseMenuInitiativeDetailReturn {
  const [initiative, setInitiative] = useState<InitiativeWithStories | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInitiative = useCallback(async () => {
    if (!initiativeId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch initiative with related data
      const { data: initiativeData, error: initiativeError } = await supabase
        .from('boh_initiative')
        .select(`
          *,
          app:app_id (id, slug, name, description, type, is_active),
          module:module_id (id, app_id, key, label, description, route, icon_key, group_label, sort_order, is_primary, is_active),
          planning_stage:planning_stage_id (id, key, label, description, color_token, sort_order, is_active),
          priority:priority_id (id, key, label, description, weight, color_token, is_active),
          owner_user:owner_user_id (id, full_name, email, status),
          forge_status:forge_status_id (id, key, label, description, color_token, sort_order, is_active)
        `)
        .eq('id', initiativeId)
        .single();

      if (initiativeError) throw initiativeError;
      if (!initiativeData) throw new Error('Initiative not found');

      // Fetch user stories for this initiative
      const { data: storiesData, error: storiesError } = await supabase
        .from('boh_user_story')
        .select(`
          *,
          priority:priority_id (id, key, label, weight, color_token),
          owner_user:owner_user_id (id, full_name, email, status),
          target_release:target_release_id (id, version_label, status, release_date)
        `)
        .eq('initiative_id', initiativeId)
        .eq('is_archived', false)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (storiesError) throw storiesError;

      // Fetch tasks for all stories
      const storyIds = storiesData?.map(s => s.id) || [];
      let tasksData: Task[] = [];

      if (storyIds.length > 0) {
        const { data: tasks, error: tasksError } = await supabase
          .from('boh_task')
          .select(`
            *,
            assigned_user:assigned_to (id, full_name, email, status),
            created_user:created_by (id, full_name, email, status)
          `)
          .in('user_story_id', storyIds)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false });

        if (tasksError) throw tasksError;
        tasksData = tasks || [];
      }

      // Nest tasks within stories
      const storiesWithTasks = (storiesData || []).map(story => ({
        ...story,
        tasks: tasksData.filter(t => t.user_story_id === story.id)
      }));

      setInitiative({
        ...initiativeData,
        stories: storiesWithTasks
      });
    } catch (err: any) {
      console.error('Error fetching initiative detail:', err);
      setError(err.message || 'Failed to load initiative');
    } finally {
      setIsLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    fetchInitiative();
  }, [fetchInitiative]);

  const updateInitiative = useCallback(async (updates: Partial<Initiative>): Promise<boolean> => {
    if (!initiativeId) return false;

    try {
      const { error } = await supabase
        .from('boh_initiative')
        .update(updates)
        .eq('id', initiativeId);

      if (error) throw error;
      await fetchInitiative();
      return true;
    } catch (err) {
      console.error('Error updating initiative:', err);
      return false;
    }
  }, [initiativeId, fetchInitiative]);

  const addUserStory = useCallback(async (
    story: Omit<UserStory, 'id' | 'created_at' | 'updated_at'>
  ): Promise<UserStory | null> => {
    if (!initiativeId) return null;

    try {
      const { data, error } = await supabase
        .from('boh_user_story')
        .insert(story)
        .select()
        .single();

      if (error) throw error;
      await fetchInitiative();
      return data;
    } catch (err) {
      console.error('Error adding user story:', err);
      return null;
    }
  }, [initiativeId, fetchInitiative]);

  const updateUserStory = useCallback(async (
    storyId: string,
    updates: Partial<UserStory>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('boh_user_story')
        .update(updates)
        .eq('id', storyId);

      if (error) throw error;
      await fetchInitiative();
      return true;
    } catch (err) {
      console.error('Error updating user story:', err);
      return false;
    }
  }, [fetchInitiative]);

  const addTask = useCallback(async (
    task: Omit<Task, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Task | null> => {
    try {
      const { data, error } = await supabase
        .from('boh_task')
        .insert(task)
        .select()
        .single();

      if (error) throw error;
      await fetchInitiative();
      return data;
    } catch (err) {
      console.error('Error adding task:', err);
      return null;
    }
  }, [fetchInitiative]);

  const updateTask = useCallback(async (
    taskId: string,
    updates: Partial<Task>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('boh_task')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;
      await fetchInitiative();
      return true;
    } catch (err) {
      console.error('Error updating task:', err);
      return false;
    }
  }, [fetchInitiative]);

  // Check if initiative is ready to submit to Forge
  const isReadyToSubmit = useMemo(() => {
    if (!initiative) return false;
    
    // Must have owner
    if (!initiative.owner_user_id) return false;
    
    // Must have target quarter and year
    if (!initiative.target_quarter || !initiative.target_year) return false;
    
    // Must have at least one user story
    if (!initiative.stories || initiative.stories.length === 0) return false;
    
    // Must not already be submitted/accepted/deferred/rejected
    const currentStatus = initiative.forge_status?.key;
    if (currentStatus && ['submitted', 'accepted', 'deferred', 'rejected'].includes(currentStatus)) {
      return false;
    }
    
    return true;
  }, [initiative]);

  // Submit initiative to Forge
  const submitToForge = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!initiativeId) return { success: false, error: 'No initiative ID' };
    if (!isReadyToSubmit) return { success: false, error: 'Initiative is not ready to submit' };

    try {
      // Fetch the 'submitted' status from lookup table
      const { data: submittedStatus, error: statusError } = await supabase
        .from('boh_initiative_forge_status')
        .select('id')
        .eq('key', 'submitted')
        .eq('is_active', true)
        .single();

      if (statusError || !submittedStatus) {
        throw new Error('Could not find submitted status in lookup table');
      }

      // Update initiative with submitted status and timestamp
      const { error: updateError } = await supabase
        .from('boh_initiative')
        .update({
          forge_status_id: submittedStatus.id,
          submitted_to_forge_at: new Date().toISOString()
        })
        .eq('id', initiativeId);

      if (updateError) throw updateError;

      // Refresh initiative data
      await fetchInitiative();

      return { success: true };
    } catch (err: any) {
      console.error('Error submitting to Forge:', err);
      return { success: false, error: err.message || 'Failed to submit to Forge' };
    }
  }, [initiativeId, isReadyToSubmit, fetchInitiative]);

  return {
    initiative,
    isLoading,
    error,
    refresh: fetchInitiative,
    updateInitiative,
    addUserStory,
    updateUserStory,
    addTask,
    updateTask,
    submitToForge,
    isReadyToSubmit
  };
}
