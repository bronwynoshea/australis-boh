import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { productApi } from '../lib/api/product';
import type {
  Initiative,
  Release,
  ProductOverview,
  CreateInitiativeInput,
  UpdateInitiativeInput,
  CreateReleaseInput,
  UpdateReleaseInput,
  ProductFilters,
  QuarterlyReportData,
  PlanningStage,
  ProductAppSummary,
  ProductAppModule,
  ProductAppInput,
  ProductAppModuleInput,
  PriorityOption,
  ApiResponse
} from '../types/product';

// Export ProductFilters for use in components
export type { ProductFilters };

// Menu metadata hooks
export const useProductApps = (
  options?: Omit<UseQueryOptions<ProductAppSummary[], Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productQueryKeys.apps(),
    queryFn: () => productApi.getProductApps().then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};

export const useAppModules = (
  appId?: string,
  includeInactive = false,
  options?: Omit<UseQueryOptions<ProductAppModule[], Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productQueryKeys.appModules(appId, includeInactive),
    queryFn: () => productApi.getAppModules(appId, includeInactive).then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    enabled: appId !== undefined,
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};

export const usePlanningStages = (
  options?: Omit<UseQueryOptions<PlanningStage[], Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productQueryKeys.planningStages(),
    queryFn: () => productApi.getPlanningStages().then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    staleTime: 30 * 60 * 1000,
    ...options,
  });
};

export const useForgeStatuses = (
  options?: Omit<UseQueryOptions<Array<{ id: string; key: string; label: string; description?: string; color_token?: string; sort_order: number; is_active: boolean }>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productQueryKeys.forgeStatuses(),
    queryFn: () => productApi.getForgeStatuses().then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};

export const usePriorityOptions = (
  options?: Omit<UseQueryOptions<PriorityOption[], Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productQueryKeys.priorities(),
    queryFn: () => productApi.getPriorityOptions().then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    staleTime: 30 * 60 * 1000,
    ...options,
  });
};

export const useInitiativeStatuses = (
  options?: Omit<UseQueryOptions<Array<{ id: string; key: string; label: string; description?: string; color_token?: string; sort_order: number; is_active: boolean }>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productQueryKeys.initiativeStatuses(),
    queryFn: () => productApi.getInitiativeStatuses().then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    staleTime: 30 * 60 * 1000,
    ...options,
  });
};

export const useQuarterCalendar = (
  options?: Omit<UseQueryOptions<Array<{ id: string; year: number; quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'; start_date: string; end_date: string; label: string; is_active: boolean }>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productQueryKeys.quarterCalendar(),
    queryFn: () => productApi.getQuarterCalendar().then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    staleTime: 30 * 60 * 1000,
    ...options,
  });
};

// Query keys for React Query
export const productQueryKeys = {
  all: ['product'] as const,
  overview: () => ['productOverview'] as const,
  initiatives: (filters?: ProductFilters) => ['initiatives', filters] as const,
  initiative: (id: string) => ['initiative', id] as const,
  apps: () => ['productApps'] as const,
  appModules: (appId?: string, includeInactive = false) => ['appModules', appId, includeInactive] as const,
  planningStages: () => ['planningStages'] as const,
  forgeStatuses: () => ['forgeStatuses'] as const,
  priorityOptions: () => ['priorityOptions'] as const,
  priorities: () => ['priorityOptions'] as const,
  quarterCalendar: () => ['quarterCalendar'] as const,
  initiativeStatuses: () => ['initiativeStatuses'] as const,
  workstreamStatuses: () => ['workstreamStatuses'] as const,
  releases: () => ['releases'] as const,
  release: (id: string) => ['release', id] as const,
  filteredReleases: (filters?: ProductFilters) => ['filteredReleases', filters] as const,
  quarterlyReport: (quarter: string, year: number) => ['quarterlyReport', quarter, year] as const,
  filteredInitiatives: (filters?: ProductFilters) => ['filteredInitiatives', filters] as const,
};

// Overview hook
export const useProductOverview = (options?: Omit<UseQueryOptions<ProductOverview, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: productQueryKeys.overview(),
    queryFn: () => productApi.getOverview().then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

// Initiatives hooks
export const useInitiatives = (
  filters?: ProductFilters,
  options?: Omit<UseQueryOptions<Initiative[], Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: filters ? productQueryKeys.filteredInitiatives(filters) : productQueryKeys.initiatives(),
    queryFn: () => productApi.getInitiatives(filters).then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

export const useInitiative = (
  id: string,
  options?: Omit<UseQueryOptions<Initiative, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productQueryKeys.initiative(id),
    queryFn: () => productApi.getInitiative(id).then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

export const useCreateInitiative = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateInitiativeInput) => 
      productApi.createInitiative(input).then(res => {
        if (res.error) throw new Error(res.error);
        return res.data;
      }),
    onSuccess: (newInitiative) => {
      // Invalidate and refetch initiatives list
      queryClient.invalidateQueries({ queryKey: productQueryKeys.initiatives() });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.overview() });
      
      // Add the new initiative to the cache
      queryClient.setQueryData(
        productQueryKeys.initiative(newInitiative.id),
        newInitiative
      );
    },
    onError: (error) => {
      console.error('Failed to create initiative:', error);
    },
  });
};

export const useCreateProductApp = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ProductAppInput) =>
      productApi.createProductApp(input).then(res => {
        if (res.error) throw new Error(res.error);
        return res.data;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.apps() });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.overview() });
    },
  });
};

export const useUpdateProductApp = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ProductAppInput> }) =>
      productApi.updateProductApp(id, input).then(res => {
        if (res.error) throw new Error(res.error);
        return res.data;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.apps() });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.overview() });
    },
  });
};

export const useCreateAppModule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ProductAppModuleInput) =>
      productApi.createAppModule(input).then(res => {
        if (res.error) throw new Error(res.error);
        return res.data;
      }),
    onSuccess: (module) => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.appModules(module.app_id, true) });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.appModules(module.app_id, false) });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.overview() });
    },
  });
};

export const useUpdateAppModule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ProductAppModuleInput> }) =>
      productApi.updateAppModule(id, input).then(res => {
        if (res.error) throw new Error(res.error);
        return res.data;
      }),
    onSuccess: (module) => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.appModules(module.app_id, true) });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.appModules(module.app_id, false) });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.overview() });
    },
  });
};

export const useUpdateInitiative = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInitiativeInput }) =>
      productApi.updateInitiative(id, input).then(res => {
        if (res.error) throw new Error(res.error);
        return res.data;
      }),
    onMutate: async ({ id, input }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: productQueryKeys.initiative(id) });

      // Snapshot the previous value
      const previousInitiative = queryClient.getQueryData(productQueryKeys.initiative(id));

      // Optimistically update to the new value
      if (previousInitiative) {
        queryClient.setQueryData(productQueryKeys.initiative(id), {
          ...previousInitiative as Initiative,
          ...input,
        });
      }

      // Return a context object with the snapshotted value
      return { previousInitiative };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousInitiative) {
        queryClient.setQueryData(
          productQueryKeys.initiative(variables.id),
          context.previousInitiative
        );
      }
      console.error('Failed to update initiative:', error);
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: productQueryKeys.initiative(variables.id) });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.initiatives() });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.overview() });
    },
  });
};

export const useDeleteInitiative = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => 
      productApi.deleteInitiative(id).then(res => {
        if (res.error) throw new Error(res.error);
        return res.data;
      }),
    onSuccess: (_, id) => {
      // Remove the initiative from the cache
      queryClient.removeQueries({ queryKey: productQueryKeys.initiative(id) });
      
      // Invalidate and refetch initiatives list
      queryClient.invalidateQueries({ queryKey: productQueryKeys.initiatives() });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.overview() });
    },
    onError: (error) => {
      console.error('Failed to delete initiative:', error);
    },
  });
};

// Releases hooks
export const useReleases = (
  filters?: ProductFilters,
  options?: Omit<UseQueryOptions<Release[], Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: filters ? productQueryKeys.filteredReleases(filters) : productQueryKeys.releases(),
    queryFn: () => productApi.getReleases(filters).then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

export const useRelease = (
  id: string,
  options?: Omit<UseQueryOptions<Release, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productQueryKeys.release(id),
    queryFn: () => productApi.getRelease(id).then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

export const useCreateRelease = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateReleaseInput) => 
      productApi.createRelease(input).then(res => {
        if (res.error) throw new Error(res.error);
        return res.data;
      }),
    onSuccess: (newRelease) => {
      // Invalidate and refetch releases list
      queryClient.invalidateQueries({ queryKey: productQueryKeys.releases() });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.overview() });
      
      // Add the new release to the cache
      queryClient.setQueryData(
        productQueryKeys.release(newRelease.id),
        newRelease
      );
    },
    onError: (error) => {
      console.error('Failed to create release:', error);
    },
  });
};

export const useUpdateRelease = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateReleaseInput }) =>
      productApi.updateRelease(id, input).then(res => {
        if (res.error) throw new Error(res.error);
        return res.data;
      }),
    onMutate: async ({ id, input }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: productQueryKeys.release(id) });

      // Snapshot the previous value
      const previousRelease = queryClient.getQueryData(productQueryKeys.release(id));

      // Optimistically update to the new value
      if (previousRelease) {
        queryClient.setQueryData(productQueryKeys.release(id), {
          ...previousRelease as Release,
          ...input,
        });
      }

      // Return a context object with the snapshotted value
      return { previousRelease };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousRelease) {
        queryClient.setQueryData(
          productQueryKeys.release(variables.id),
          context.previousRelease
        );
      }
      console.error('Failed to update release:', error);
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: productQueryKeys.release(variables.id) });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.releases() });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.overview() });
    },
  });
};

export const useDeleteRelease = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => 
      productApi.deleteRelease(id).then(res => {
        if (res.error) throw new Error(res.error);
        return res.data;
      }),
    onSuccess: (_, id) => {
      // Remove the release from the cache
      queryClient.removeQueries({ queryKey: productQueryKeys.release(id) });
      
      // Invalidate and refetch releases list
      queryClient.invalidateQueries({ queryKey: productQueryKeys.releases() });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.overview() });
    },
    onError: (error) => {
      console.error('Failed to delete release:', error);
    },
  });
};

// Quarterly Report hook
export const useQuarterlyReport = (
  quarter: string,
  year: number,
  options?: Omit<UseQueryOptions<QuarterlyReportData, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productQueryKeys.quarterlyReport(quarter, year),
    queryFn: () => productApi.getQuarterlyReport(quarter, year).then(res => {
      if (res.error) throw new Error(res.error);
      return res.data;
    }),
    enabled: !!quarter && !!year,
    staleTime: 15 * 60 * 1000, // 15 minutes
    ...options,
  });
};

// Link/Unlink hooks
export const useLinkInitiativeToRelease = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ initiativeId, releaseId }: { initiativeId: string; releaseId: string }) =>
      productApi.linkInitiativeToRelease(initiativeId, releaseId).then(res => {
        if (res.error) throw new Error(res.error);
        return res.data;
      }),
    onSuccess: (_, { initiativeId, releaseId }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: productQueryKeys.initiative(initiativeId) });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.release(releaseId) });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.initiatives() });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.releases() });
    },
    onError: (error) => {
      console.error('Failed to link initiative to release:', error);
    },
  });
};

export const useUnlinkInitiativeFromRelease = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ initiativeId, releaseId }: { initiativeId: string; releaseId: string }) =>
      productApi.unlinkInitiativeFromRelease(initiativeId, releaseId).then(res => {
        if (res.error) throw new Error(res.error);
        return res.data;
      }),
    onSuccess: (_, { initiativeId, releaseId }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: productQueryKeys.initiative(initiativeId) });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.release(releaseId) });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.initiatives() });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.releases() });
    },
    onError: (error) => {
      console.error('Failed to unlink initiative from release:', error);
    },
  });
};

// Utility hooks for common operations
export const useProductMetrics = () => {
  const { data: overview, ...rest } = useProductOverview();
  
  return {
    ...rest,
    data: overview?.metrics,
  };
};

export const useRecentInitiatives = (limit = 5) => {
  const { data: initiatives, ...rest } = useInitiatives();
  
  return {
    ...rest,
    data: initiatives?.slice(0, limit),
  };
};

export const useRecentReleases = (limit = 10) => {
  const { data: releases, ...rest } = useReleases();
  
  return {
    ...rest,
    data: releases?.slice(0, limit),
  };
};

export const useUpcomingReleases = () => {
  const { data: releases, ...rest } = useReleases();
  
  const upcomingReleases = releases?.filter(release => 
    release.status === 'planned' && 
    new Date(release.release_date || '') > new Date()
  );

  return {
    ...rest,
    data: upcomingReleases,
  };
};

// Main product data hook for ProductManagement component
export const useProductData = () => {
  const queryClient = useQueryClient();

  // Get product overview
  const { data: overview, isLoading: overviewLoading, error: overviewError } = useQuery({
    queryKey: ['product-overview'],
    queryFn: () => productApi.getOverview(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get initiatives
  const { data: initiatives, isLoading: initiativesLoading } = useQuery({
    queryKey: ['product-initiatives'],
    queryFn: () => productApi.getInitiatives(),
    staleTime: 5 * 60 * 1000,
  });

  // Get releases
  const { data: releases, isLoading: releasesLoading } = useQuery({
    queryKey: ['product-releases'],
    queryFn: () => productApi.getReleases(),
    staleTime: 5 * 60 * 1000,
  });

  return {
    overview,
    initiatives,
    releases,
    isLoading: overviewLoading || initiativesLoading || releasesLoading,
    overviewError,
  };
};
