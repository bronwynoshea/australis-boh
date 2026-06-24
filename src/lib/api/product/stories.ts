import { getCurrentBohUserContext } from '../../../boh/api/bohApi';
import { supabase } from '../../supabase';
import type {
  UserStory,
  CreateUserStoryInput,
  UpdateUserStoryInput,
  ApiResponse
} from '../../../types/product';

/**
 * Stories API - CRUD operations for User Stories
 * Provides database operations for the boh_user_story table
 */

// Helper function to handle API responses
const handleResponse = async <T>(promise: Promise<any>): Promise<ApiResponse<T>> => {
  try {
    const { data, error } = await promise;
    if (error) {
      console.error('[StoriesAPI] Database error:', error);
      return { data: null as any, error: error.message };
    }
    return { data };
  } catch (err) {
    console.error('[StoriesAPI] Unexpected error:', err);
    return { 
      data: null as any, 
      error: err instanceof Error ? err.message : 'Unknown error occurred' 
    };
  }
};

const getCurrentTenantId = async (): Promise<string | null> => {
  const context = await getCurrentBohUserContext();
  return context?.tenant_id ?? null;
};

const missingTenantResponse = <T>(): ApiResponse<T> => ({
  data: null as any,
  error: 'No BOH tenant matched the current session.',
});

const validateInitiativeInTenant = async (initiativeId: string, tenantId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('boh_initiative')
    .select('id')
    .eq('id', initiativeId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) return error.message;
  if (!data) return 'Selected initiative is not part of the current BOH tenant.';
  return null;
};

const validateBohUserInTenant = async (
  userId: string | null | undefined,
  tenantId: string,
  label = 'Selected user'
): Promise<string | null> => {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('boh_user')
    .select('id')
    .eq('id', userId)
    .eq('tenant_id', tenantId)
    .eq('app_context', 'boh')
    .maybeSingle();

  if (error) return error.message;
  if (!data) return `${label} is not part of the current BOH tenant.`;
  return null;
};

/**
 * Fetch all stories for a specific initiative
 * @param initiativeId - The UUID of the initiative
 * @returns Promise resolving to array of UserStory objects
 */
export const fetchStories = async (initiativeId: string): Promise<ApiResponse<UserStory[]>> => {
  console.log('[StoriesAPI] Fetching stories for initiative:', initiativeId);
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return missingTenantResponse<UserStory[]>();
  
  const { data, error } = await supabase
    .from('boh_user_story')
    .select(`
      *,
      priority:counter_ticket_priority(
        id,
        key,
        label,
        weight,
        color_token
      ),
      owner_user:boh_user(
        id,
        full_name,
        email,
        status
      ),
      target_release:boh_release_version(
        id,
        version_label,
        status,
        release_date
      ),
      tasks:boh_task(
        id,
        status,
        sort_order
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('initiative_id', initiativeId)
    .eq('is_archived', false)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[StoriesAPI] Error fetching stories:', error);
    return { data: null as any, error: error.message };
  }

  // Process the data to add computed fields
  const processedData = (data || []).map((story: any) => {
    const tasks = story.tasks || [];
    const completedTasks = tasks.filter((task: any) => task.status === 'done');
    
    return {
      ...story,
      task_count: tasks.length,
      completed_task_count: completedTasks.length,
    };
  });

  console.log('[StoriesAPI] Successfully fetched', processedData.length, 'stories');
  return { data: processedData };
};

/**
 * Fetch a single story by ID
 * @param id - The UUID of the story
 * @returns Promise resolving to UserStory object or null
 */
export const fetchStoryById = async (id: string): Promise<ApiResponse<UserStory>> => {
  console.log('[StoriesAPI] Fetching story by ID:', id);
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return missingTenantResponse<UserStory>();
  
  const { data, error } = await supabase
    .from('boh_user_story')
    .select(`
      *,
      priority:counter_ticket_priority(
        id,
        key,
        label,
        weight,
        color_token
      ),
      owner_user:boh_user(
        id,
        full_name,
        email,
        status
      ),
      target_release:boh_release_version(
        id,
        version_label,
        status,
        release_date
      ),
      tasks:boh_task(
        id,
        title,
        status,
        sort_order,
        assigned_to,
        created_at,
        completed_at
      )
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    console.error('[StoriesAPI] Error fetching story:', error);
    return { data: null as any, error: error.message };
  }

  // Process the data to add computed fields
  const tasks = data.tasks || [];
  const completedTasks = tasks.filter((task: any) => task.status === 'done');
  
  const processedData = {
    ...data,
    task_count: tasks.length,
    completed_task_count: completedTasks.length,
  };

  console.log('[StoriesAPI] Successfully fetched story:', processedData.title);
  return { data: processedData };
};

/**
 * Create a new user story
 * @param data - The story data to create
 * @returns Promise resolving to the created UserStory object
 */
export const createStory = async (data: CreateUserStoryInput): Promise<ApiResponse<UserStory>> => {
  console.log('[StoriesAPI] Creating story:', data.title);
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return missingTenantResponse<UserStory>();
  
  // Validate input
  if (!data.title || data.title.trim().length === 0) {
    return { data: null as any, error: 'Story title is required' };
  }
  
  if (data.title.length > 255) {
    return { data: null as any, error: 'Story title must be 255 characters or less' };
  }
  
  if (!data.initiative_id) {
    return { data: null as any, error: 'Initiative ID is required' };
  }

  const initiativeError = await validateInitiativeInTenant(data.initiative_id, tenantId);
  if (initiativeError) return { data: null as any, error: initiativeError };

  const ownerError = await validateBohUserInTenant(data.owner_user_id, tenantId, 'Selected owner');
  if (ownerError) return { data: null as any, error: ownerError };

  // Validate status if provided
  const validStatuses = ['not_started', 'in_progress', 'blocked', 'review', 'done', 'cancelled'];
  if (data.status && !validStatuses.includes(data.status)) {
    return { data: null as any, error: 'Invalid story status' };
  }

  // Validate estimated hours if provided
  if (data.estimated_hours !== undefined && (data.estimated_hours < 0 || !isFinite(data.estimated_hours))) {
    return { data: null as any, error: 'Estimated hours must be a positive number' };
  }

  // Validate story points if provided
  if (data.story_points !== undefined && (data.story_points < 0 || !Number.isInteger(data.story_points))) {
    return { data: null as any, error: 'Story points must be a non-negative integer' };
  }

  const storyData = {
    ...data,
    tenant_id: tenantId,
    title: data.title.trim(),
    sort_order: data.sort_order || 0,
    status: data.status || 'not_started',
    is_archived: false,
    progress: 0,
  };

  const result = await supabase
    .from('boh_user_story')
    .insert(storyData)
    .select(`
      *,
      priority:counter_ticket_priority(
        id,
        key,
        label,
        weight,
        color_token
      ),
      owner_user:boh_user(
        id,
        full_name,
        email,
        status
      ),
      target_release:boh_release_version(
        id,
        version_label,
        status,
        release_date
      )
    `)
    .single();

  if (result.error) {
    console.error('[StoriesAPI] Error creating story:', result.error);
    return { data: null as any, error: result.error.message };
  }

  console.log('[StoriesAPI] Successfully created story:', result.data.title);
  return { data: result.data };
};

/**
 * Update an existing user story
 * @param id - The UUID of the story to update
 * @param data - The updated story data
 * @returns Promise resolving to the updated UserStory object
 */
export const updateStory = async (id: string, data: UpdateUserStoryInput): Promise<ApiResponse<UserStory>> => {
  console.log('[StoriesAPI] Updating story:', id);
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return missingTenantResponse<UserStory>();
  
  // Validate title if provided
  if (data.title !== undefined) {
    if (!data.title || data.title.trim().length === 0) {
      return { data: null as any, error: 'Story title is required' };
    }
    
    if (data.title.length > 255) {
      return { data: null as any, error: 'Story title must be 255 characters or less' };
    }
  }

  // Validate status if provided
  const validStatuses = ['not_started', 'in_progress', 'blocked', 'review', 'done', 'cancelled'];
  if (data.status && !validStatuses.includes(data.status)) {
    return { data: null as any, error: 'Invalid story status' };
  }

  // Validate estimated hours if provided
  if (data.estimated_hours !== undefined && (data.estimated_hours < 0 || !isFinite(data.estimated_hours))) {
    return { data: null as any, error: 'Estimated hours must be a positive number' };
  }

  // Validate story points if provided
  if (data.story_points !== undefined && (data.story_points < 0 || !Number.isInteger(data.story_points))) {
    return { data: null as any, error: 'Story points must be a non-negative integer' };
  }

  // Validate progress if provided
  if (data.progress !== undefined && (data.progress < 0 || data.progress > 100)) {
    return { data: null as any, error: 'Progress must be between 0 and 100' };
  }

  const ownerError = await validateBohUserInTenant(data.owner_user_id, tenantId, 'Selected owner');
  if (ownerError) return { data: null as any, error: ownerError };

  // Clean up the data
  const updateData = {
    ...data,
    ...(data.title && { title: data.title.trim() }),
    updated_at: new Date().toISOString(),
  };

  const result = await supabase
    .from('boh_user_story')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select(`
      *,
      priority:counter_ticket_priority(
        id,
        key,
        label,
        weight,
        color_token
      ),
      owner_user:boh_user(
        id,
        full_name,
        email,
        status
      ),
      target_release:boh_release_version(
        id,
        version_label,
        status,
        release_date
      )
    `)
    .single();

  if (result.error) {
    console.error('[StoriesAPI] Error updating story:', result.error);
    return { data: null as any, error: result.error.message };
  }

  console.log('[StoriesAPI] Successfully updated story:', result.data.title);
  return { data: result.data };
};

/**
 * Delete (archive) a user story
 * @param id - The UUID of the story to delete
 * @returns Promise resolving to void
 */
export const deleteStory = async (id: string): Promise<ApiResponse<void>> => {
  console.log('[StoriesAPI] Deleting story:', id);
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return missingTenantResponse<void>();
  
  const result = await supabase
    .from('boh_user_story')
    .update({ 
      is_archived: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (result.error) {
    console.error('[StoriesAPI] Error deleting story:', result.error);
    return { data: null as any, error: result.error.message };
  }

  console.log('[StoriesAPI] Successfully deleted story:', id);
  return { data: undefined };
};

/**
 * Get the maximum sort order for stories in an initiative
 * @param initiativeId - The UUID of the initiative
 * @returns Promise resolving to the maximum sort order
 */
export const getMaxSortOrder = async (initiativeId: string): Promise<ApiResponse<number>> => {
  console.log('[StoriesAPI] Getting max sort order for initiative:', initiativeId);
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return missingTenantResponse<number>();
  
  const { data, error } = await supabase
    .from('boh_user_story')
    .select('sort_order')
    .eq('tenant_id', tenantId)
    .eq('initiative_id', initiativeId)
    .eq('is_archived', false)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
    console.error('[StoriesAPI] Error getting max sort order:', error);
    return { data: null as any, error: error.message };
  }

  const maxSortOrder = data?.sort_order || 0;
  console.log('[StoriesAPI] Max sort order:', maxSortOrder);
  
  return { data: maxSortOrder };
};
