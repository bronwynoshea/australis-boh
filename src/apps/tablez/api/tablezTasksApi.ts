import { supabase } from '../../../lib/supabase';
import type { TablezTask, TablezTaskStatus, TablezTaskPriority, TablezProject } from '../types';

// API Functions

export async function fetchTaskStatuses(): Promise<TablezTaskStatus[]> {
  const { data, error } = await supabase
    .from('tablez_task_status')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching task statuses:', error);
    throw error;
  }

  return (data || []) as TablezTaskStatus[];
}

export async function fetchTaskPriorities(): Promise<TablezTaskPriority[]> {
  const { data, error } = await supabase
    .from('tablez_task_priority')
    .select('*')
    .eq('is_active', true)
    .order('weight', { ascending: false });

  if (error) {
    console.error('Error fetching task priorities:', error);
    throw error;
  }

  return (data || []) as TablezTaskPriority[];
}

export async function fetchMyTasksForBoard(userId: string): Promise<TablezTask[]> {
  const { data, error } = await supabase
    .from('tablez_task')
    .select(`
      id, title, description, due_date, tags, section_id, table_id, chair_id, tablez_project_id,
      assigned_to, created_by, related_contact_id, related_org_id, related_ticket_id, source,
      is_archived, app_context, created_at, updated_at, search_vector, status_id, priority_id,
      scheduled_start_at, scheduled_end_at, is_all_day, timezone, calendar_provider,
      calendar_external_id, calendar_sync_status, calendar_last_synced_at,
      assigned_to_user:boh_user!tablez_task_assigned_to_fkey(id, full_name, email),
      created_by_user:boh_user!tablez_task_created_by_fkey(id, full_name, email),
      status:tablez_task_status(id, key, label, description, sort_order, color_token, is_active),
      priority:tablez_task_priority(id, key, label, description, weight, color_token, is_active),
      project:tablez_project(id, name, description, section_id, table_id, color, app_context, status_id)
    `)
    .eq('app_context', 'tablez')
    .eq('is_archived', false)
    .eq('assigned_to', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }

  return (data || []) as unknown as TablezTask[];
}

export async function fetchAllTasksForBoard(): Promise<TablezTask[]> {
  const { data, error } = await supabase
    .from('tablez_task')
    .select(`
      id, title, description, due_date, tags, section_id, table_id, chair_id, tablez_project_id,
      assigned_to, created_by, related_contact_id, related_org_id, related_ticket_id, source,
      is_archived, app_context, created_at, updated_at, search_vector, status_id, priority_id,
      scheduled_start_at, scheduled_end_at, is_all_day, timezone, calendar_provider,
      calendar_external_id, calendar_sync_status, calendar_last_synced_at,
      assigned_to_user:boh_user!tablez_task_assigned_to_fkey(id, full_name, email),
      created_by_user:boh_user!tablez_task_created_by_fkey(id, full_name, email),
      status:tablez_task_status(id, key, label, description, sort_order, color_token, is_active),
      priority:tablez_task_priority(id, key, label, description, weight, color_token, is_active),
      project:tablez_project(id, name, description, section_id, table_id, color, app_context, status_id)
    `)
    .eq('app_context', 'tablez')
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching all tasks:', error);
    throw error;
  }

  return (data || []) as unknown as TablezTask[];
}

export async function fetchProjects(): Promise<TablezProject[]> {
  // WORKAROUND: PostgREST auto-expands owner_id FK using wrong table name from constraint metadata
  // Exclude owner_id from select to prevent auto-expansion that triggers incorrect table requests
  // Database FK constraint metadata needs update to reference boh_user (singular)
  const { data, error } = await supabase
    .from('tablez_project')
    .select('id, name, description, section_id, table_id, color, app_context, status_id')
    .eq('app_context', 'tablez')
    .order('name', { ascending: true });
  
  if (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }

  // Add owner_id as null since selecting it triggers PostgREST to query wrong table
  // TODO: Database FK constraint metadata must reference boh_user (singular)
  return (data || []).map(project => ({
    ...project,
    owner_id: null as string | null
  })) as TablezProject[];
}

export async function updateTaskStatus(taskId: string, statusId: string): Promise<void> {
  const { error } = await supabase
    .from('tablez_task')
    .update({ 
      status_id: statusId,
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId);

  if (error) {
    console.error('Error updating task status:', error);
    throw error;
  }
}

export async function createTask(payload: {
  title: string;
  description?: string;
  tablez_project_id?: string;
  status_id: string;
  priority_id: string;
  due_date?: string;
  scheduled_start_at?: string;
  scheduled_end_at?: string;
  assigned_to: string;
  created_by: string;
  section_id: string;
  table_id: string;
}): Promise<TablezTask> {
  const { data, error } = await supabase
    .from('tablez_task')
    .insert({
      ...payload,
      app_context: 'tablez',
      source: 'manual',
      is_archived: false,
      is_all_day: false,
    })
    .select(`
      id, title, description, due_date, tags, section_id, table_id, chair_id, tablez_project_id,
      assigned_to, created_by, related_contact_id, related_org_id, related_ticket_id, source,
      is_archived, app_context, created_at, updated_at, search_vector, status_id, priority_id,
      scheduled_start_at, scheduled_end_at, is_all_day, timezone, calendar_provider,
      calendar_external_id, calendar_sync_status, calendar_last_synced_at,
      assigned_to_user:boh_user!tablez_task_assigned_to_fkey(id, full_name, email),
      created_by_user:boh_user!tablez_task_created_by_fkey(id, full_name, email),
      status:tablez_task_status(id, key, label, description, sort_order, color_token, is_active),
      priority:tablez_task_priority(id, key, label, description, weight, color_token, is_active),
      project:tablez_project(id, name, description, section_id, table_id, color, app_context, status_id)
    `)
    .single();

  if (error) {
    console.error('Error creating task:', error);
    throw error;
  }

  return data as unknown as TablezTask;
}

export async function updateTask(taskId: string, updates: Partial<TablezTask>): Promise<TablezTask> {
  const { data, error } = await supabase
    .from('tablez_task')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId)
    .select(`
      id, title, description, due_date, tags, section_id, table_id, chair_id, tablez_project_id,
      assigned_to, created_by, related_contact_id, related_org_id, related_ticket_id, source,
      is_archived, app_context, created_at, updated_at, search_vector, status_id, priority_id,
      scheduled_start_at, scheduled_end_at, is_all_day, timezone, calendar_provider,
      calendar_external_id, calendar_sync_status, calendar_last_synced_at,
      assigned_to_user:boh_user!tablez_task_assigned_to_fkey(id, full_name, email),
      created_by_user:boh_user!tablez_task_created_by_fkey(id, full_name, email),
      status:tablez_task_status(id, key, label, description, sort_order, color_token, is_active),
      priority:tablez_task_priority(id, key, label, description, weight, color_token, is_active),
      project:tablez_project(id, name, description, section_id, table_id, color, app_context, status_id)
    `)
    .single();

  if (error) {
    console.error('Error updating task:', error);
    throw error;
  }

  return data as unknown as TablezTask;
}

// Helper to get current user ID from Supabase auth
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('boh_user')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('app_context', 'boh')
    .single();

  if (error) {
    console.error('Error looking up boh_user for current auth user:', error);
    return null;
  }

  return data?.id ?? null;
}

/**
 * Fetch tasks due today for a specific user
 * Filters by: app_context='tablez', is_archived=false, due_date=today
 * Orders by: priority weight (desc), due_date, title
 */
export async function fetchTodayTasks(userId: string): Promise<TablezTask[]> {
  // Get today's date range (start and end of day in UTC)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStart = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

  const { data, error } = await supabase
    .from('tablez_task')
    .select(`
      id, title, description, due_date, tags, section_id, table_id, chair_id, tablez_project_id,
      assigned_to, created_by, related_contact_id, related_org_id, related_ticket_id, source,
      is_archived, app_context, created_at, updated_at, search_vector, status_id, priority_id,
      scheduled_start_at, scheduled_end_at, is_all_day, timezone, calendar_provider,
      calendar_external_id, calendar_sync_status, calendar_last_synced_at,
      assigned_to_user:boh_user!tablez_task_assigned_to_fkey(id, full_name, email),
      created_by_user:boh_user!tablez_task_created_by_fkey(id, full_name, email),
      status:tablez_task_status(id, key, label, description, sort_order, color_token, is_active),
      priority:tablez_task_priority(id, key, label, description, weight, color_token, is_active),
      project:tablez_project(id, name, description, section_id, table_id, color, app_context, status_id)
    `)
    .eq('app_context', 'tablez')
    .eq('is_archived', false)
    .eq('assigned_to', userId)
    .gte('due_date', todayStart)
    .lt('due_date', tomorrowStart);

  if (error) {
    console.error('Error fetching today tasks:', error);
    throw error;
  }

  // Sort by priority weight manually since PostgREST ordering with foreign tables is complex
  const tasks = (data || []) as unknown as TablezTask[];
  
  // Get priorities for sorting
  const priorities = await fetchTaskPriorities();
  const priorityMap = new Map(priorities.map(p => [p.id, p.weight]));
  
  // Sort: priority weight (desc), then due_date, then title
  tasks.sort((a, b) => {
    const aWeight = priorityMap.get(a.priority_id) || 0;
    const bWeight = priorityMap.get(b.priority_id) || 0;
    if (bWeight !== aWeight) {
      return bWeight - aWeight; // Descending
    }
    
    // Then by due_date
    if (a.due_date && b.due_date) {
      const dateCompare = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      if (dateCompare !== 0) return dateCompare;
    } else if (a.due_date) return -1;
    else if (b.due_date) return 1;
    
    // Finally by title
    return (a.title || '').localeCompare(b.title || '');
  });

  return tasks;
}

