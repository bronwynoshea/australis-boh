import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import {
  fetchTasks,
  fetchTaskById,
  createTask,
  updateTask,
  deleteTask,
  getMaxTaskSortOrder,
  fetchTaskComments,
  createTaskComment,
  updateTaskComment,
  deleteTaskComment
} from '../lib/api/product/tasks';
import type {
  Task,
  TaskComment,
  CreateTaskInput,
  UpdateTaskInput,
  CreateTaskCommentInput,
  UpdateTaskCommentInput,
  ApiResponse
} from '../types/product';

// Query keys for React Query
export const taskQueryKeys = {
  all: ['tasks'] as const,
  forStory: (storyId: string) => [...taskQueryKeys.all, storyId] as const,
  detail: (id: string) => [...taskQueryKeys.all, 'detail', id] as const,
  maxSortOrder: (storyId: string) => [...taskQueryKeys.all, 'maxSortOrder', storyId] as const,
  comments: (taskId: string) => [...taskQueryKeys.all, 'comments', taskId] as const,
};

// Query options for better reusability
export const taskQueryOptions = {
  // All tasks for a story
  forStory: (storyId: string) => ({
    queryKey: taskQueryKeys.forStory(storyId),
    queryFn: () => fetchTasks(storyId).then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!storyId,
  }),
  
  // Single task by ID
  detail: (id: string) => ({
    queryKey: taskQueryKeys.detail(id),
    queryFn: () => fetchTaskById(id).then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!id,
  }),
  
  // Max sort order for story
  maxSortOrder: (storyId: string) => ({
    queryKey: taskQueryKeys.maxSortOrder(storyId),
    queryFn: () => getMaxTaskSortOrder(storyId).then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!storyId,
  }),
  
  // Comments for a task
  comments: (taskId: string) => ({
    queryKey: taskQueryKeys.comments(taskId),
    queryFn: () => fetchTaskComments(taskId).then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!taskId,
  }),
};

// Hooks

/**
 * Hook to fetch all tasks for a user story
 * @param storyId - The UUID of the user story
 * @param options - Additional React Query options
 * @returns Query result with tasks data
 */
export const useTasks = (
  storyId: string,
  options?: Omit<UseQueryOptions<Task[], Error>, 'queryKey' | 'queryFn' | 'enabled'>
) => {
  return useQuery({
    ...taskQueryOptions.forStory(storyId),
    ...options,
  });
};

/**
 * Hook to fetch a single task by ID
 * @param id - The UUID of the task
 * @param options - Additional React Query options
 * @returns Query result with task data
 */
export const useTask = (
  id: string,
  options?: Omit<UseQueryOptions<Task, Error>, 'queryKey' | 'queryFn' | 'enabled'>
) => {
  return useQuery({
    ...taskQueryOptions.detail(id),
    ...options,
  });
};

/**
 * Hook to get maximum sort order for tasks in a story
 * @param storyId - The UUID of the user story
 * @param options - Additional React Query options
 * @returns Query result with max sort order data
 */
export const useMaxTaskSortOrder = (
  storyId: string,
  options?: Omit<UseQueryOptions<number, Error>, 'queryKey' | 'queryFn' | 'enabled'>
) => {
  return useQuery({
    ...taskQueryOptions.maxSortOrder(storyId),
    ...options,
  });
};

/**
 * Hook to fetch comments for a task
 * @param taskId - The UUID of the task
 * @param options - Additional React Query options
 * @returns Query result with comments data
 */
export const useTaskComments = (
  taskId: string,
  options?: Omit<UseQueryOptions<TaskComment[], Error>, 'queryKey' | 'queryFn' | 'enabled'>
) => {
  return useQuery({
    ...taskQueryOptions.comments(taskId),
    ...options,
  });
};

// Mutations

/**
 * Hook to create a new task
 * @param options - Additional mutation options
 * @returns Mutation object for creating tasks
 */
export const useCreateTask = (options?: {
  onSuccess?: (data: Task, variables: CreateTaskInput) => void;
  onError?: (error: Error, variables: CreateTaskInput) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTaskInput): Promise<Task> => {
      console.log('[useCreateTask] Creating task:', data.title);
      
      const result = await createTask(data);
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data;
    },
    onSuccess: (data, variables) => {
      console.log('[useCreateTask] Successfully created task:', data.title);
      
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: taskQueryKeys.forStory(variables.user_story_id)
      });
      
      // Invalidate max sort order
      queryClient.invalidateQueries({
        queryKey: taskQueryKeys.maxSortOrder(variables.user_story_id)
      });
      
      // Call user-provided onSuccess
      options?.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      console.error('[useCreateTask] Error creating task:', error.message);
      options?.onError?.(error, variables);
    },
  });
};

/**
 * Hook to update an existing task
 * @param options - Additional mutation options
 * @returns Mutation object for updating tasks
 */
export const useUpdateTask = (options?: {
  onSuccess?: (data: Task, variables: { id: string; data: UpdateTaskInput }) => void;
  onError?: (error: Error, variables: { id: string; data: UpdateTaskInput }) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTaskInput }): Promise<Task> => {
      console.log('[useUpdateTask] Updating task:', id);
      
      const result = await updateTask(id, data);
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data;
    },
    onMutate: async ({ id, data }) => {
      // Get the current task to find its story ID for cache invalidation
      const currentTask = queryClient.getQueryData<Task>(taskQueryKeys.detail(id));
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: taskQueryKeys.detail(id)
      });
      
      // Snapshot the previous value
      const previousTask = queryClient.getQueryData<Task>(
        taskQueryKeys.detail(id)
      );
      
      // Optimistically update to the new value
      if (previousTask) {
        queryClient.setQueryData<Task>(
          taskQueryKeys.detail(id),
          (old) => old ? { ...old, ...data, updated_at: new Date().toISOString() } : undefined
        );
      }
      
      return { previousTask, storyId: currentTask?.user_story_id };
    },
    onError: (error, variables, context) => {
      console.error('[useUpdateTask] Error updating task:', error.message);
      
      // Rollback on error
      if (context?.previousTask) {
        queryClient.setQueryData(
          taskQueryKeys.detail(variables.id),
          context.previousTask
        );
      }
      
      options?.onError?.(error, variables);
    },
    onSuccess: (data, variables) => {
      console.log('[useUpdateTask] Successfully updated task:', data.title);
      
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: taskQueryKeys.forStory(data.user_story_id)
      });
      
      // Update the detail query with fresh data
      queryClient.setQueryData(
        taskQueryKeys.detail(variables.id),
        data
      );
      
      options?.onSuccess?.(data, variables);
    },
  });
};

/**
 * Hook to delete a task
 * @param options - Additional mutation options
 * @returns Mutation object for deleting tasks
 */
export const useDeleteTask = (options?: {
  onSuccess?: (variables: { id: string; storyId: string }) => void;
  onError?: (error: Error, variables: { id: string; storyId: string }) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, storyId }: { id: string; storyId: string }): Promise<void> => {
      console.log('[useDeleteTask] Deleting task:', id);
      
      const result = await deleteTask(id);
      if (result.error) {
        throw new Error(result.error);
      }
      
      return undefined;
    },
    onMutate: async ({ id, storyId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: taskQueryKeys.forStory(storyId)
      });
      
      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>(
        taskQueryKeys.forStory(storyId)
      );
      
      // Optimistically remove the task from the list
      if (previousTasks) {
        queryClient.setQueryData<Task[]>(
          taskQueryKeys.forStory(storyId),
          (old) => old?.filter(task => task.id !== id)
        );
      }
      
      return { previousTasks };
    },
    onError: (error, variables, context) => {
      console.error('[useDeleteTask] Error deleting task:', error.message);
      
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(
          taskQueryKeys.forStory(variables.storyId),
          context.previousTasks
        );
      }
      
      options?.onError?.(error, variables);
    },
    onSuccess: (_, variables) => {
      console.log('[useDeleteTask] Successfully deleted task:', variables.id);
      
      // Invalidate related queries to ensure consistency
      queryClient.invalidateQueries({
        queryKey: taskQueryKeys.forStory(variables.storyId)
      });
      
      // Remove the detail query
      queryClient.removeQueries({
        queryKey: taskQueryKeys.detail(variables.id)
      });
      
      // Remove comments query
      queryClient.removeQueries({
        queryKey: taskQueryKeys.comments(variables.id)
      });
      
      options?.onSuccess?.(variables);
    },
  });
};

/**
 * Hook to reorder tasks (update sort orders)
 * @param options - Additional mutation options
 * @returns Mutation object for reordering tasks
 */
export const useReorderTasks = (options?: {
  onSuccess?: (variables: { storyId: string; tasks: Array<{ id: string; sort_order: number }> }) => void;
  onError?: (error: Error, variables: { storyId: string; tasks: Array<{ id: string; sort_order: number }> }) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      storyId, 
      tasks 
    }: { 
      storyId: string; 
      tasks: Array<{ id: string; sort_order: number }>;
    }): Promise<Task[]> => {
      console.log('[useReorderTasks] Reordering tasks for story:', storyId);
      
      // Update all tasks in parallel
      const updatePromises = tasks.map(({ id, sort_order }) =>
        updateTask(id, { sort_order })
      );
      
      const results = await Promise.all(updatePromises);
      
      // Check for errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} tasks`);
      }
      
      return results.map(result => result.data!);
    },
    onMutate: async ({ storyId, tasks }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: taskQueryKeys.forStory(storyId)
      });
      
      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>(
        taskQueryKeys.forStory(storyId)
      );
      
      // Optimistically update the sort orders
      if (previousTasks) {
        const updatedTasks = previousTasks.map(task => {
          const updatedTask = tasks.find(t => t.id === task.id);
          return updatedTask 
            ? { ...task, sort_order: updatedTask.sort_order }
            : task;
        }).sort((a, b) => a.sort_order - b.sort_order);
        
        queryClient.setQueryData(
          taskQueryKeys.forStory(storyId),
          updatedTasks
        );
      }
      
      return { previousTasks };
    },
    onError: (error, variables, context) => {
      console.error('[useReorderTasks] Error reordering tasks:', error.message);
      
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(
          taskQueryKeys.forStory(variables.storyId),
          context.previousTasks
        );
      }
      
      options?.onError?.(error, variables);
    },
    onSuccess: (data, variables) => {
      console.log('[useReorderTasks] Successfully reordered tasks');
      
      // Update the cache with the new order
      queryClient.setQueryData(
        taskQueryKeys.forStory(variables.storyId),
        data
      );
      
      // Invalidate max sort order
      queryClient.invalidateQueries({
        queryKey: taskQueryKeys.maxSortOrder(variables.storyId)
      });
      
      options?.onSuccess?.(variables);
    },
  });
};

// Task Comments Mutations

/**
 * Hook to create a new task comment
 * @param options - Additional mutation options
 * @returns Mutation object for creating task comments
 */
export const useCreateTaskComment = (options?: {
  onSuccess?: (data: TaskComment, variables: CreateTaskCommentInput) => void;
  onError?: (error: Error, variables: CreateTaskCommentInput) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTaskCommentInput): Promise<TaskComment> => {
      console.log('[useCreateTaskComment] Creating comment for task:', data.task_id);
      
      const result = await createTaskComment(data);
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data;
    },
    onSuccess: (data, variables) => {
      console.log('[useCreateTaskComment] Successfully created comment');
      
      // Invalidate comments query
      queryClient.invalidateQueries({
        queryKey: taskQueryKeys.comments(variables.task_id)
      });
      
      // Update task detail to reflect new comment count
      queryClient.invalidateQueries({
        queryKey: taskQueryKeys.detail(variables.task_id)
      });
      
      // Invalidate tasks for story to update comment counts
      const currentTask = queryClient.getQueryData<Task>(taskQueryKeys.detail(variables.task_id));
      if (currentTask?.user_story_id) {
        queryClient.invalidateQueries({
          queryKey: taskQueryKeys.forStory(currentTask.user_story_id)
        });
      }
      
      options?.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      console.error('[useCreateTaskComment] Error creating comment:', error.message);
      options?.onError?.(error, variables);
    },
  });
};

/**
 * Hook to update a task comment
 * @param options - Additional mutation options
 * @returns Mutation object for updating task comments
 */
export const useUpdateTaskComment = (options?: {
  onSuccess?: (data: TaskComment, variables: { id: string; data: UpdateTaskCommentInput }) => void;
  onError?: (error: Error, variables: { id: string; data: UpdateTaskCommentInput }) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTaskCommentInput }): Promise<TaskComment> => {
      console.log('[useUpdateTaskComment] Updating comment:', id);
      
      const result = await updateTaskComment(id, data);
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data;
    },
    onSuccess: (data, variables) => {
      console.log('[useUpdateTaskComment] Successfully updated comment');
      
      // Find the task ID for this comment
      const commentsQuery = queryClient.getQueryData<TaskComment[]>(
        taskQueryKeys.comments(data.task_id)
      );
      
      // Invalidate comments query
      queryClient.invalidateQueries({
        queryKey: taskQueryKeys.comments(data.task_id)
      });
      
      options?.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      console.error('[useUpdateTaskComment] Error updating comment:', error.message);
      options?.onError?.(error, variables);
    },
  });
};

/**
 * Hook to delete a task comment
 * @param options - Additional mutation options
 * @returns Mutation object for deleting task comments
 */
export const useDeleteTaskComment = (options?: {
  onSuccess?: (variables: { id: string; taskId: string }) => void;
  onError?: (error: Error, variables: { id: string; taskId: string }) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, taskId }: { id: string; taskId: string }): Promise<void> => {
      console.log('[useDeleteTaskComment] Deleting comment:', id);
      
      const result = await deleteTaskComment(id);
      if (result.error) {
        throw new Error(result.error);
      }
      
      return undefined;
    },
    onSuccess: (_, variables) => {
      console.log('[useDeleteTaskComment] Successfully deleted comment');
      
      // Invalidate comments query
      queryClient.invalidateQueries({
        queryKey: taskQueryKeys.comments(variables.taskId)
      });
      
      // Update task detail to reflect new comment count
      queryClient.invalidateQueries({
        queryKey: taskQueryKeys.detail(variables.taskId)
      });
      
      // Invalidate tasks for story to update comment counts
      const currentTask = queryClient.getQueryData<Task>(taskQueryKeys.detail(variables.taskId));
      if (currentTask?.user_story_id) {
        queryClient.invalidateQueries({
          queryKey: taskQueryKeys.forStory(currentTask.user_story_id)
        });
      }
      
      options?.onSuccess?.(variables);
    },
    onError: (error, variables) => {
      console.error('[useDeleteTaskComment] Error deleting comment:', error.message);
      options?.onError?.(error, variables);
    },
  });
};
