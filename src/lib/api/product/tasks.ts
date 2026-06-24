import { getCurrentBohUserContext } from '../../../boh/api/bohApi';
import { supabase } from '../../supabase';
import type {
  Task,
  TaskComment,
  CreateTaskInput,
  UpdateTaskInput,
  CreateTaskCommentInput,
  UpdateTaskCommentInput,
  ApiResponse
} from '../../../types/product';

/**
 * Tasks API - CRUD operations for Tasks and Task Comments
 * Provides database operations for the boh_task and boh_task_comment tables
 */

// Helper function to handle API responses
const handleResponse = async <T>(promise: Promise<any>): Promise<ApiResponse<T>> => {
  try {
    const { data, error } = await promise;
    if (error) {
      console.error('[TasksAPI] Database error:', error);
      return { data: null as any, error: error.message };
    }
    return { data };
  } catch (err) {
    console.error('[TasksAPI] Unexpected error:', err);
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

const validateStoryInTenant = async (storyId: string, tenantId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('boh_user_story')
    .select('id')
    .eq('id', storyId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) return error.message;
  if (!data) return 'Selected story is not part of the current BOH tenant.';
  return null;
};

const validateTaskInTenant = async (taskId: string, tenantId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('boh_task')
    .select('id')
    .eq('id', taskId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) return error.message;
  if (!data) return 'Selected task is not part of the current BOH tenant.';
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
 * Fetch all tasks for a specific user story
 * @param storyId - The UUID of the user story
 * @returns Promise resolving to array of Task objects
 */
export const fetchTasks = async (storyId: string): Promise<ApiResponse<Task[]>> => {
  console.log('[TasksAPI] Fetching tasks for story:', storyId);
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return missingTenantResponse<Task[]>();
  
  const { data, error } = await supabase
    .from('boh_task')
    .select(`
      *,
      assigned_user:boh_user!assigned_to(
        id,
        full_name,
        email,
        status
      ),
      created_user:boh_user!created_by(
        id,
        full_name,
        email,
        status
      ),
      agent_engagement_type:forge_agent_engagement_type(
        id,
        key,
        label,
        description,
        sort_order,
        is_active
      ),
      agent_engagement_status:forge_agent_engagement_status(
        id,
        key,
        label,
        description,
        sort_order,
        is_active
      ),
      agent_capability:forge_agent_capability(
        id,
        key,
        label,
        description,
        sort_order,
        is_active
      ),
      comments:boh_task_comment(
        id,
        body,
        created_at,
        author_id,
        author:boh_user(
          id,
          full_name,
          email,
          status
        )
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('user_story_id', storyId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[TasksAPI] Error fetching tasks:', error);
    return { data: null as any, error: error.message };
  }

  // Process the data to add computed fields
  const processedData = (data || []).map((task: any) => {
    const comments = task.comments || [];
    
    return {
      ...task,
      comment_count: comments.length,
    };
  });

  console.log('[TasksAPI] Successfully fetched', processedData.length, 'tasks');
  return { data: processedData };
};

/**
 * Fetch a single task by ID
 * @param id - The UUID of the task
 * @returns Promise resolving to Task object or null
 */
export const fetchTaskById = async (id: string): Promise<ApiResponse<Task>> => {
  console.log('[TasksAPI] Fetching task by ID:', id);
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return missingTenantResponse<Task>();
  
  const { data, error } = await supabase
    .from('boh_task')
    .select(`
      *,
      assigned_user:boh_user!assigned_to(
        id,
        full_name,
        email,
        status
      ),
      created_user:boh_user!created_by(
        id,
        full_name,
        email,
        status
      ),
      agent_engagement_type:forge_agent_engagement_type(
        id,
        key,
        label,
        description,
        sort_order,
        is_active
      ),
      agent_engagement_status:forge_agent_engagement_status(
        id,
        key,
        label,
        description,
        sort_order,
        is_active
      ),
      agent_capability:forge_agent_capability(
        id,
        key,
        label,
        description,
        sort_order,
        is_active
      ),
      comments:boh_task_comment(
        id,
        body,
        created_at,
        updated_at,
        author_id,
        author:boh_user(
          id,
          full_name,
          email,
          status
        )
      )
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    console.error('[TasksAPI] Error fetching task:', error);
    return { data: null as any, error: error.message };
  }

  // Process the data to add computed fields
  const comments = data.comments || [];
  
  const processedData = {
    ...data,
    comment_count: comments.length,
  };

  console.log('[TasksAPI] Successfully fetched task:', processedData.title);
  return { data: processedData };
};

/**
 * Create a new task
 * @param data - The task data to create
 * @returns Promise resolving to the created Task object
 */
export const createTask = async (data: CreateTaskInput): Promise<ApiResponse<Task>> => {
  console.log('[TasksAPI] Creating task:', data.title);
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return missingTenantResponse<Task>();
  
  // Validate input
  if (!data.title || data.title.trim().length === 0) {
    return { data: null as any, error: 'Task title is required' };
  }
  
  if (data.title.length > 255) {
    return { data: null as any, error: 'Task title must be 255 characters or less' };
  }
  
  if (!data.user_story_id) {
    return { data: null as any, error: 'User story ID is required' };
  }

  const storyError = await validateStoryInTenant(data.user_story_id, tenantId);
  if (storyError) return { data: null as any, error: storyError };

  const assigneeError = await validateBohUserInTenant(data.assigned_to, tenantId, 'Selected assignee');
  if (assigneeError) return { data: null as any, error: assigneeError };

  const creatorError = await validateBohUserInTenant(data.created_by, tenantId, 'Selected creator');
  if (creatorError) return { data: null as any, error: creatorError };

  // Validate status if provided
  const validStatuses = ['not_started', 'in_progress', 'blocked', 'review', 'done'];
  if (data.status && !validStatuses.includes(data.status)) {
    return { data: null as any, error: 'Invalid task status' };
  }

  // Validate estimated hours if provided
  if (data.estimated_hours !== undefined && (data.estimated_hours < 0 || !isFinite(data.estimated_hours))) {
    return { data: null as any, error: 'Estimated hours must be a positive number' };
  }

  const taskData = {
    ...data,
    tenant_id: tenantId,
    title: data.title.trim(),
    sort_order: data.sort_order || 0,
    status: data.status || 'not_started',
  };

  const result = await supabase
    .from('boh_task')
    .insert(taskData)
    .select(`
      *,
      assigned_user:boh_user!boh_task_assigned_to_fkey(
        id,
        full_name,
        email,
        status
      ),
      created_user:boh_user!boh_task_created_by_fkey(
        id,
        full_name,
        email,
        status
      ),
      agent_engagement_type:forge_agent_engagement_type(
        id,
        key,
        label,
        description,
        sort_order,
        is_active
      ),
      agent_engagement_status:forge_agent_engagement_status(
        id,
        key,
        label,
        description,
        sort_order,
        is_active
      ),
      agent_capability:forge_agent_capability(
        id,
        key,
        label,
        description,
        sort_order,
        is_active
      )
    `)
    .single();

  if (result.error) {
    console.error('[TasksAPI] Error creating task:', result.error);
    return { data: null as any, error: result.error.message };
  }

  console.log('[TasksAPI] Successfully created task:', result.data.title);
  return { data: { ...result.data, comment_count: 0 } };
};

/**
 * Update an existing task
 * @param id - The UUID of the task to update
 * @param data - The updated task data
 * @returns Promise resolving to the updated Task object
 */
export const updateTask = async (id: string, data: UpdateTaskInput): Promise<ApiResponse<Task>> => {
  console.log('[TasksAPI] Updating task:', id);
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return missingTenantResponse<Task>();
  
  // Validate title if provided
  if (data.title !== undefined) {
    if (!data.title || data.title.trim().length === 0) {
      return { data: null as any, error: 'Task title is required' };
    }
    
    if (data.title.length > 255) {
      return { data: null as any, error: 'Task title must be 255 characters or less' };
    }
  }

  // Validate status if provided
  const validStatuses = ['not_started', 'in_progress', 'blocked', 'review', 'done'];
  if (data.status && !validStatuses.includes(data.status)) {
    return { data: null as any, error: 'Invalid task status' };
  }

  // Validate estimated hours if provided
  if (data.estimated_hours !== undefined && (data.estimated_hours < 0 || !isFinite(data.estimated_hours))) {
    return { data: null as any, error: 'Estimated hours must be a positive number' };
  }

  // Validate actual hours if provided
  if (data.actual_hours !== undefined && (data.actual_hours < 0 || !isFinite(data.actual_hours))) {
    return { data: null as any, error: 'Actual hours must be a positive number' };
  }

  const assigneeError = await validateBohUserInTenant(data.assigned_to, tenantId, 'Selected assignee');
  if (assigneeError) return { data: null as any, error: assigneeError };

  // Clean up the data
  const updateData = {
    ...data,
    ...(data.title && { title: data.title.trim() }),
    updated_at: new Date().toISOString(),
  };

  const result = await supabase
    .from('boh_task')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select(`
      *,
      assigned_user:boh_user!boh_task_assigned_to_fkey(
        id,
        full_name,
        email,
        status
      ),
      created_user:boh_user!boh_task_created_by_fkey(
        id,
        full_name,
        email,
        status
      ),
      agent_engagement_type:forge_agent_engagement_type(
        id,
        key,
        label,
        description,
        sort_order,
        is_active
      ),
      agent_engagement_status:forge_agent_engagement_status(
        id,
        key,
        label,
        description,
        sort_order,
        is_active
      ),
      agent_capability:forge_agent_capability(
        id,
        key,
        label,
        description,
        sort_order,
        is_active
      )
    `)
    .single();

  if (result.error) {
    console.error('[TasksAPI] Error updating task:', result.error);
    return { data: null as any, error: result.error.message };
  }

  console.log('[TasksAPI] Successfully updated task:', result.data.title);
  return { data: { ...result.data, comment_count: 0 } };
};

/**
 * Delete a task
 * @param id - The UUID of the task to delete
 * @returns Promise resolving to void
 */
export const deleteTask = async (id: string): Promise<ApiResponse<void>> => {
  console.log('[TasksAPI] Deleting task:', id);
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return missingTenantResponse<void>();
  
  const result = await supabase
    .from('boh_task')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (result.error) {
    console.error('[TasksAPI] Error deleting task:', result.error);
    return { data: null as any, error: result.error.message };
  }

  console.log('[TasksAPI] Successfully deleted task:', id);
  return { data: undefined };
};

/**
 * Get the maximum sort order for tasks in a story
 * @param storyId - The UUID of the user story
 * @returns Promise resolving to the maximum sort order
 */
export const getMaxTaskSortOrder = async (storyId: string): Promise<ApiResponse<number>> => {
  console.log('[TasksAPI] Getting max sort order for story:', storyId);
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return missingTenantResponse<number>();
  
  const { data, error } = await supabase
    .from('boh_task')
    .select('sort_order')
    .eq('tenant_id', tenantId)
    .eq('user_story_id', storyId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
    console.error('[TasksAPI] Error getting max sort order:', error);
    return { data: null as any, error: error.message };
  }

  const maxSortOrder = data?.sort_order || 0;
  console.log('[TasksAPI] Max sort order:', maxSortOrder);
  
  return { data: maxSortOrder };
};

// Task Comments API

/**
 * Fetch comments for a specific task
 * @param taskId - The UUID of the task
 * @returns Promise resolving to array of TaskComment objects
 */
export const fetchTaskComments = async (taskId: string): Promise<ApiResponse<TaskComment[]>> => {
  console.log('[TasksAPI] Fetching comments for task:', taskId);
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return missingTenantResponse<TaskComment[]>();
  
  const { data, error } = await supabase
    .from('boh_task_comment')
    .select(`
      *,
      author:boh_user(
        id,
        full_name,
        email,
        status
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[TasksAPI] Error fetching comments:', error);
    return { data: null as any, error: error.message };
  }

  console.log('[TasksAPI] Successfully fetched', data?.length || 0, 'comments');
  return { data: data || [] };
};

/**
 * Create a new task comment
 * @param data - The comment data to create
 * @returns Promise resolving to the created TaskComment object
 */
export const createTaskComment = async (data: CreateTaskCommentInput): Promise<ApiResponse<TaskComment>> => {
  console.log('[TasksAPI] Creating comment for task:', data.task_id);
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return missingTenantResponse<TaskComment>();
  
  // Validate input
  if (!data.task_id) {
    return { data: null as any, error: 'Task ID is required' };
  }
  
  if (!data.body || data.body.trim().length === 0) {
    return { data: null as any, error: 'Comment body is required' };
  }

  const taskError = await validateTaskInTenant(data.task_id, tenantId);
  if (taskError) return { data: null as any, error: taskError };

  const commentData = {
    task_id: data.task_id,
    tenant_id: tenantId,
    body: data.body.trim(),
  };

  const result = await supabase
    .from('boh_task_comment')
    .insert(commentData)
    .select(`
      *,
      author:boh_user(
        id,
        full_name,
        email,
        status
      )
    `)
    .single();

  if (result.error) {
    console.error('[TasksAPI] Error creating comment:', result.error);
    return { data: null as any, error: result.error.message };
  }

  console.log('[TasksAPI] Successfully created comment');
  return { data: result.data };
};

/**
 * Update a task comment
 * @param id - The UUID of the comment to update
 * @param data - The updated comment data
 * @returns Promise resolving to the updated TaskComment object
 */
export const updateTaskComment = async (id: string, data: UpdateTaskCommentInput): Promise<ApiResponse<TaskComment>> => {
  console.log('[TasksAPI] Updating comment:', id);
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return missingTenantResponse<TaskComment>();
  
  // Validate body if provided
  if (data.body !== undefined) {
    if (!data.body || data.body.trim().length === 0) {
      return { data: null as any, error: 'Comment body is required' };
    }
  }

  // Clean up the data
  const updateData = {
    ...data,
    ...(data.body && { body: data.body.trim() }),
    updated_at: new Date().toISOString(),
  };

  const result = await supabase
    .from('boh_task_comment')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select(`
      *,
      author:boh_user(
        id,
        full_name,
        email,
        status
      )
    `)
    .single();

  if (result.error) {
    console.error('[TasksAPI] Error updating comment:', result.error);
    return { data: null as any, error: result.error.message };
  }

  console.log('[TasksAPI] Successfully updated comment');
  return { data: result.data };
};

/**
 * Delete a task comment
 * @param id - The UUID of the comment to delete
 * @returns Promise resolving to void
 */
export const deleteTaskComment = async (id: string): Promise<ApiResponse<void>> => {
  console.log('[TasksAPI] Deleting comment:', id);
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return missingTenantResponse<void>();
  
  const result = await supabase
    .from('boh_task_comment')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (result.error) {
    console.error('[TasksAPI] Error deleting comment:', result.error);
    return { data: null as any, error: result.error.message };
  }

  console.log('[TasksAPI] Successfully deleted comment:', id);
  return { data: undefined };
};
