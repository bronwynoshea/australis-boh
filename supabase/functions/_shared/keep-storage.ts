// @ts-nocheck
// Shared storage helpers for Keep module
// Centralizes bucket routing logic for two-bucket architecture

/**
 * Resolves the storage bucket name from the file area.
 * Two-bucket architecture:
 * - workspace → keep-workspace
 * - gold_library → keep-gold-library
 */
export function resolveStorageBucket(area: 'workspace' | 'gold_library'): string {
  switch (area) {
    case 'workspace':
      return 'keep-workspace';
    case 'gold_library':
      return 'keep-gold-library';
    default:
      // Fallback for safety, though this shouldn't happen with proper typing
      console.warn(`[keep-storage] Unknown area "${area}", defaulting to keep-workspace`);
      return 'keep-workspace';
  }
}

/**
 * Validates that a bucket name is one of the expected Keep buckets.
 * Used for backward compatibility checks.
 */
export function isValidKeepBucket(bucket: string | null | undefined): boolean {
  if (!bucket) return false;
  return bucket === 'keep-workspace' || bucket === 'keep-gold-library';
}

/**
 * Normalizes legacy bucket names to the new architecture.
 * Returns the original if it's already valid or unrecognized.
 */
export function normalizeBucketName(bucket: string | null | undefined): string {
  if (!bucket) return 'keep-workspace';
  
  // Map old legacy bucket names
  if (bucket === 'keep-files') {
    console.warn(`[keep-storage] Legacy bucket "${bucket}" detected, downloads may fail - record needs migration`);
    return bucket; // Return as-is for download attempts, but log warning
  }
  
  return bucket;
}
