import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import {
  fetchStories,
  fetchStoryById,
  createStory,
  updateStory,
  deleteStory,
  getMaxSortOrder
} from '../lib/api/product/stories';
import type {
  UserStory,
  CreateUserStoryInput,
  UpdateUserStoryInput,
  ApiResponse
} from '../types/product';

// Query keys for React Query
export const storyQueryKeys = {
  all: ['stories'] as const,
  forInitiative: (initiativeId: string) => [...storyQueryKeys.all, initiativeId] as const,
  detail: (id: string) => [...storyQueryKeys.all, 'detail', id] as const,
  maxSortOrder: (initiativeId: string) => [...storyQueryKeys.all, 'maxSortOrder', initiativeId] as const,
};

// Query options for better reusability
export const storyQueryOptions = {
  // All stories for an initiative
  forInitiative: (initiativeId: string) => ({
    queryKey: storyQueryKeys.forInitiative(initiativeId),
    queryFn: () => fetchStories(initiativeId).then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!initiativeId,
  }),
  
  // Single story by ID
  detail: (id: string) => ({
    queryKey: storyQueryKeys.detail(id),
    queryFn: () => fetchStoryById(id).then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!id,
  }),
  
  // Max sort order for initiative
  maxSortOrder: (initiativeId: string) => ({
    queryKey: storyQueryKeys.maxSortOrder(initiativeId),
    queryFn: () => getMaxSortOrder(initiativeId).then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!initiativeId,
  }),
};

// Hooks

/**
 * Hook to fetch all stories for an initiative
 * @param initiativeId - The UUID of the initiative
 * @param options - Additional React Query options
 * @returns Query result with stories data
 */
export const useStories = (
  initiativeId: string,
  options?: Omit<UseQueryOptions<UserStory[], Error>, 'queryKey' | 'queryFn' | 'enabled'>
) => {
  return useQuery({
    ...storyQueryOptions.forInitiative(initiativeId),
    ...options,
  });
};

/**
 * Hook to fetch a single story by ID
 * @param id - The UUID of the story
 * @param options - Additional React Query options
 * @returns Query result with story data
 */
export const useStory = (
  id: string,
  options?: Omit<UseQueryOptions<UserStory, Error>, 'queryKey' | 'queryFn' | 'enabled'>
) => {
  return useQuery({
    ...storyQueryOptions.detail(id),
    ...options,
  });
};

/**
 * Hook to get maximum sort order for stories in an initiative
 * @param initiativeId - The UUID of the initiative
 * @param options - Additional React Query options
 * @returns Query result with max sort order data
 */
export const useMaxStorySortOrder = (
  initiativeId: string,
  options?: Omit<UseQueryOptions<number, Error>, 'queryKey' | 'queryFn' | 'enabled'>
) => {
  return useQuery({
    ...storyQueryOptions.maxSortOrder(initiativeId),
    ...options,
  });
};

// Mutations

/**
 * Hook to create a new story
 * @param options - Additional mutation options
 * @returns Mutation object for creating stories
 */
export const useCreateStory = (options?: {
  onSuccess?: (data: UserStory, variables: CreateUserStoryInput) => void;
  onError?: (error: Error, variables: CreateUserStoryInput) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateUserStoryInput): Promise<UserStory> => {
      console.log('[useCreateStory] Creating story:', data.title);
      
      const result = await createStory(data);
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data;
    },
    onSuccess: (data, variables) => {
      console.log('[useCreateStory] Successfully created story:', data.title);
      
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: storyQueryKeys.forInitiative(variables.initiative_id)
      });
      
      // Invalidate max sort order
      queryClient.invalidateQueries({
        queryKey: storyQueryKeys.maxSortOrder(variables.initiative_id)
      });
      
      // Call user-provided onSuccess
      options?.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      console.error('[useCreateStory] Error creating story:', error.message);
      options?.onError?.(error, variables);
    },
  });
};

/**
 * Hook to update an existing story
 * @param options - Additional mutation options
 * @returns Mutation object for updating stories
 */
export const useUpdateStory = (options?: {
  onSuccess?: (data: UserStory, variables: { id: string; data: UpdateUserStoryInput }) => void;
  onError?: (error: Error, variables: { id: string; data: UpdateUserStoryInput }) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserStoryInput }): Promise<UserStory> => {
      console.log('[useUpdateStory] Updating story:', id);
      
      const result = await updateStory(id, data);
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data;
    },
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: storyQueryKeys.detail(id)
      });
      
      // Snapshot the previous value
      const previousStory = queryClient.getQueryData<UserStory>(
        storyQueryKeys.detail(id)
      );
      
      // Optimistically update to the new value
      if (previousStory) {
        queryClient.setQueryData<UserStory>(
          storyQueryKeys.detail(id),
          (old) => old ? { ...old, ...data, updated_at: new Date().toISOString() } : undefined
        );
      }
      
      return { previousStory };
    },
    onError: (error, variables, context) => {
      console.error('[useUpdateStory] Error updating story:', error.message);
      
      // Rollback on error
      if (context?.previousStory) {
        queryClient.setQueryData(
          storyQueryKeys.detail(variables.id),
          context.previousStory
        );
      }
      
      options?.onError?.(error, variables);
    },
    onSuccess: (data, variables) => {
      console.log('[useUpdateStory] Successfully updated story:', data.title);
      
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: storyQueryKeys.forInitiative(data.initiative_id)
      });
      
      // Update the detail query with fresh data
      queryClient.setQueryData(
        storyQueryKeys.detail(variables.id),
        data
      );
      
      options?.onSuccess?.(data, variables);
    },
  });
};

/**
 * Hook to delete (archive) a story
 * @param options - Additional mutation options
 * @returns Mutation object for deleting stories
 */
export const useDeleteStory = (options?: {
  onSuccess?: (variables: { id: string; initiativeId: string }) => void;
  onError?: (error: Error, variables: { id: string; initiativeId: string }) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, initiativeId }: { id: string; initiativeId: string }): Promise<void> => {
      console.log('[useDeleteStory] Deleting story:', id);
      
      const result = await deleteStory(id);
      if (result.error) {
        throw new Error(result.error);
      }
      
      return undefined;
    },
    onMutate: async ({ id, initiativeId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: storyQueryKeys.forInitiative(initiativeId)
      });
      
      // Snapshot the previous value
      const previousStories = queryClient.getQueryData<UserStory[]>(
        storyQueryKeys.forInitiative(initiativeId)
      );
      
      // Optimistically remove the story from the list
      if (previousStories) {
        queryClient.setQueryData<UserStory[]>(
          storyQueryKeys.forInitiative(initiativeId),
          (old) => old?.filter(story => story.id !== id)
        );
      }
      
      return { previousStories };
    },
    onError: (error, variables, context) => {
      console.error('[useDeleteStory] Error deleting story:', error.message);
      
      // Rollback on error
      if (context?.previousStories) {
        queryClient.setQueryData(
          storyQueryKeys.forInitiative(variables.initiativeId),
          context.previousStories
        );
      }
      
      options?.onError?.(error, variables);
    },
    onSuccess: (_, variables) => {
      console.log('[useDeleteStory] Successfully deleted story:', variables.id);
      
      // Invalidate related queries to ensure consistency
      queryClient.invalidateQueries({
        queryKey: storyQueryKeys.forInitiative(variables.initiativeId)
      });
      
      // Remove the detail query
      queryClient.removeQueries({
        queryKey: storyQueryKeys.detail(variables.id)
      });
      
      options?.onSuccess?.(variables);
    },
  });
};

/**
 * Hook to reorder stories (update sort orders)
 * @param options - Additional mutation options
 * @returns Mutation object for reordering stories
 */
export const useReorderStories = (options?: {
  onSuccess?: (variables: { initiativeId: string; stories: Array<{ id: string; sort_order: number }> }) => void;
  onError?: (error: Error, variables: { initiativeId: string; stories: Array<{ id: string; sort_order: number }> }) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      initiativeId, 
      stories 
    }: { 
      initiativeId: string; 
      stories: Array<{ id: string; sort_order: number }>;
    }): Promise<UserStory[]> => {
      console.log('[useReorderStories] Reordering stories for initiative:', initiativeId);
      
      // Update all stories in parallel
      const updatePromises = stories.map(({ id, sort_order }) =>
        updateStory(id, { sort_order })
      );
      
      const results = await Promise.all(updatePromises);
      
      // Check for errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} stories`);
      }
      
      return results.map(result => result.data!);
    },
    onMutate: async ({ initiativeId, stories }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: storyQueryKeys.forInitiative(initiativeId)
      });
      
      // Snapshot the previous value
      const previousStories = queryClient.getQueryData<UserStory[]>(
        storyQueryKeys.forInitiative(initiativeId)
      );
      
      // Optimistically update the sort orders
      if (previousStories) {
        const updatedStories = previousStories.map(story => {
          const updatedStory = stories.find(s => s.id === story.id);
          return updatedStory 
            ? { ...story, sort_order: updatedStory.sort_order }
            : story;
        }).sort((a, b) => a.sort_order - b.sort_order);
        
        queryClient.setQueryData(
          storyQueryKeys.forInitiative(initiativeId),
          updatedStories
        );
      }
      
      return { previousStories };
    },
    onError: (error, variables, context) => {
      console.error('[useReorderStories] Error reordering stories:', error.message);
      
      // Rollback on error
      if (context?.previousStories) {
        queryClient.setQueryData(
          storyQueryKeys.forInitiative(variables.initiativeId),
          context.previousStories
        );
      }
      
      options?.onError?.(error, variables);
    },
    onSuccess: (data, variables) => {
      console.log('[useReorderStories] Successfully reordered stories');
      
      // Update the cache with the new order
      queryClient.setQueryData(
        storyQueryKeys.forInitiative(variables.initiativeId),
        data
      );
      
      // Invalidate max sort order
      queryClient.invalidateQueries({
        queryKey: storyQueryKeys.maxSortOrder(variables.initiativeId)
      });
      
      options?.onSuccess?.(variables);
    },
  });
};
