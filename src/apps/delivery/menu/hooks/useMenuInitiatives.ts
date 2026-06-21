import { useEffect, useMemo } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useInitiatives, ProductFilters, useForgeStatuses } from '../../../../hooks/useProductData';
import type { Initiative } from '../../../../types/product';
import { useMenuFilters } from '../contexts/MenuFiltersContext';

// Helper to check if initiative is ready to submit
const isReadyToSubmit = (initiative: Initiative): boolean => {
  // Must have owner
  if (!initiative.owner_user_id) return false;
  // Must have target quarter and year
  if (!initiative.target_quarter || !initiative.target_year) return false;
  // Must have at least one user story
  if (!initiative.user_story_count || initiative.user_story_count < 1) return false;
  return true;
};

// Get pipeline bucket for an initiative
const getPipelineBucket = (initiative: Initiative): string => {
  const forgeKey = initiative.forge_status?.key;
  
  // Explicit forge statuses
  if (forgeKey === 'submitted') return 'submitted';
  if (forgeKey === 'accepted') return 'accepted';
  if (forgeKey === 'deferred') return 'deferred';
  if (forgeKey === 'rejected') return 'rejected';
  
  // For null or 'draft' status, compute readiness
  if (!forgeKey || forgeKey === 'draft') {
    if (isReadyToSubmit(initiative)) {
      return 'ready';
    }
    return 'draft';
  }
  
  // Fallback for any other status
  return 'draft';
};

const isCancelled = (initiative: Initiative) => initiative.status === 'cancelled';

const isArchived = (initiative: Initiative) => Boolean(initiative.is_archived);

const isDone = (initiative: Initiative) => initiative.status === 'done';

interface MenuTotals {
  active: number;
  approved: number;
  blocked: number;
}

interface MenuArchiveBuckets {
  liveOrCompleted: Initiative[];
  cancelled: Initiative[];
  archived: Initiative[];
}

export interface UseMenuInitiativesResult {
  initiatives: Initiative[];
  isLoading: UseQueryResult<Initiative[], Error>['isLoading'];
  error: UseQueryResult<Initiative[], Error>['error'];
  refetch: UseQueryResult<Initiative[], Error>['refetch'];
  mutate: () => Promise<void>;
  stageBuckets: Record<string, Initiative[]>;
  unassigned: Initiative[];
  appGroups: Record<string, { appName: string; initiatives: Initiative[] }>;
  quarterGroups: Record<string, Initiative[]>;
  recent: Initiative[];
  totals: MenuTotals;
  archiveBuckets: MenuArchiveBuckets;
}

export const useMenuInitiatives = (): UseMenuInitiativesResult => {
  const { filters } = useMenuFilters();
  const queryClient = useQueryClient();
  const { data: forgeStatuses } = useForgeStatuses();
  const queryFilters = useMemo<ProductFilters>(() => ({
    ...filters,
    has_release: filters.has_release ?? undefined,
    has_tickets: filters.has_tickets ?? undefined,
  }), [filters]);

  const {
    data,
    isLoading,
    error,
    refetch,
  }: UseQueryResult<Initiative[], Error> = useInitiatives(queryFilters, {
    retry: false,
  });

  const initiatives = data ?? [];

  // Mutate function for optimistic updates - invalidates and refetches
  const mutate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['initiatives'] }),
      queryClient.invalidateQueries({ queryKey: ['filteredInitiatives'] }),
    ]);
  };

  useEffect(() => {
    console.log('[MenuDebug] Raw initiatives response', {
      count: data?.length ?? 0,
      filters: queryFilters,
    });
  }, [data, queryFilters]);

  useEffect(() => {
    if (error) {
      console.error('[MenuDebug] Initiative query error', error);
    }
  }, [error]);

  const derived = useMemo(() => {
    // Build pipeline stage buckets for the board (Draft, Ready, Submitted, Accepted, Deferred)
    const stageBuckets: Record<string, Initiative[]> = {
      draft: [],
      ready: [],
      submitted: [],
      accepted: [],
      deferred: [],
      rejected: [],
    };

    const unassigned: Initiative[] = [];
    const appGroups: Record<string, { appName: string; initiatives: Initiative[] }> = {};
    const quarterGroups: Record<string, Initiative[]> = {};
    const recent = [...initiatives].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

    initiatives.forEach((initiative) => {
      // Use computed pipeline bucket (handles null forge_status correctly)
      const bucketKey = getPipelineBucket(initiative);
      if (stageBuckets[bucketKey]) {
        stageBuckets[bucketKey].push(initiative);
      } else {
        unassigned.push(initiative);
      }

      if (initiative.app_id) {
        const key = initiative.app_id;
        if (!appGroups[key]) {
          appGroups[key] = {
            appName: initiative.app?.name || 'Unknown app',
            initiatives: [],
          };
        }
        appGroups[key].initiatives.push(initiative);
      }

      const quarterKey = initiative.target_year && initiative.target_quarter
        ? `${initiative.target_year}-${initiative.target_quarter}`
        : 'unscheduled';
      if (!quarterGroups[quarterKey]) {
        quarterGroups[quarterKey] = [];
      }
      quarterGroups[quarterKey].push(initiative);
    });

    // Sort initiatives alphabetically within each group
    Object.keys(appGroups).forEach(key => {
      appGroups[key].initiatives.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    });

    Object.keys(quarterGroups).forEach(key => {
      quarterGroups[key].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    });

    const totals = {
      active: initiatives.filter((i) => !isArchived(i)).length,
      approved: stageBuckets['accepted_by_forge']?.length || 0,
      blocked: stageBuckets['deferred']?.length || 0,
    };

    const archiveBuckets: MenuArchiveBuckets = {
      liveOrCompleted: initiatives.filter(isDone),
      cancelled: initiatives.filter(isCancelled),
      archived: initiatives.filter(isArchived),
    };

    return {
      stageBuckets,
      unassigned,
      appGroups,
      quarterGroups,
      recent,
      totals,
      archiveBuckets,
    };
  }, [initiatives]);

  return {
    initiatives,
    isLoading,
    error,
    refetch,
    mutate,
    ...derived,
  };
};
