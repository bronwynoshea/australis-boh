import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

interface PendingFile {
  id: string;
  file_name: string;
  file_ext: string;
  uploaded_by: string;
  uploaded_by_name?: string;
  updated_at: string;
  folder_id: string;
  folder_name?: string;
  folder_path?: string;
  approval_count: number;
  required_approval_count: number;
  can_user_approve: boolean;
  can_user_reject: boolean;
  can_publish_immediately: boolean;
  can_publish_with_override: boolean;
  submitter_is_admin_or_super: boolean;
  current_user_is_admin_or_super: boolean;
  current_user_is_super_admin: boolean;
  is_own_file?: boolean;
}

interface RecentFile {
  id: string;
  file_name: string;
  file_ext: string;
  uploaded_by_name?: string;
  updated_at: string;
  lifecycle_status: string;
}

interface UseGoldLibraryGovernanceResult {
  pendingFiles: PendingFile[];
  recentApproved: RecentFile[];
  recentSubmitted: RecentFile[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  approveFile: (fileId: string, notes?: string, options?: { override?: boolean }) => Promise<boolean>;
  rejectFile: (fileId: string, notes?: string) => Promise<boolean>;
  withdrawFile: (fileId: string) => Promise<boolean>;
  movePendingFile: (fileId: string, destinationFolderId: string) => Promise<boolean>;
  isSubmitting: boolean;
}

async function resolveCurrentBohUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  const authUserId = user?.id;
  if (!authUserId) return null;

  const { data: bohUser, error } = await supabase
    .from('boh_user')
    .select('id')
    .eq('auth_user_id', authUserId)
    .eq('app_context', 'boh')
    .maybeSingle();

  if (error) {
    console.warn('[useGoldLibraryGovernance] Failed to resolve BOH user:', error);
    return null;
  }

  return bohUser?.id ?? null;
}

export function useGoldLibraryGovernance(): UseGoldLibraryGovernanceResult {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [recentApproved, setRecentApproved] = useState<RecentFile[]>([]);
  const [recentSubmitted, setRecentSubmitted] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      if (!supabaseUrl) {
        throw new Error('SUPABASE_URL not configured');
      }

      // Auth user IDs are only for authentication; Keep ownership uses boh_user.id.
      const bohUserId = await resolveCurrentBohUserId();
      setCurrentUserId(bohUserId);

      // Fetch pending review files
      const pendingResponse = await fetch(
        `${supabaseUrl}/functions/v1/keep-files?area=gold_library&lifecycle_status=pending_review`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!pendingResponse.ok) {
        throw new Error('Failed to fetch pending files');
      }

      const pendingData = await pendingResponse.json();
      
      // Fetch approval counts for pending files
      const pendingWithCounts = await Promise.all(
        (pendingData.files || []).map(async (file: any) => {
          try {
            const approvalResponse = await fetch(
              `${supabaseUrl}/functions/v1/keep-file-approval?file_id=${file.id}`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              }
            );

            if (approvalResponse.ok) {
              const approvalData = await approvalResponse.json();
              const approvedCount = approvalData.approvals?.filter(
                (a: any) => a.decision === 'approved'
              ).length || 0;
              const status = approvalData.status || {};
              return { 
                ...file, 
                approval_count: approvedCount,
                required_approval_count: status.requiredApprovalCount || 2,
                can_user_approve: Boolean(status.canUserApprove),
                can_user_reject: Boolean(status.canUserReject),
                can_publish_immediately: Boolean(status.canPublishImmediately),
                can_publish_with_override: Boolean(status.canPublishWithOverride),
                submitter_is_admin_or_super: Boolean(status.submitterIsAdminOrSuper),
                current_user_is_admin_or_super: Boolean(status.currentUserIsAdminOrSuper),
                current_user_is_super_admin: Boolean(status.currentUserIsSuperAdmin),
                is_own_file: Boolean(status.isOwnFile ?? (bohUserId ? file.uploaded_by === bohUserId : false))
              };
            }
          } catch (err) {
            console.warn('Failed to fetch approval count for file:', file.id);
          }
          return { 
            ...file, 
            approval_count: 0,
            required_approval_count: 2,
            can_user_approve: false,
            can_user_reject: false,
            can_publish_immediately: false,
            can_publish_with_override: false,
            submitter_is_admin_or_super: false,
            current_user_is_admin_or_super: false,
            current_user_is_super_admin: false,
            is_own_file: bohUserId ? file.uploaded_by === bohUserId : false
          };
        })
      );

      setPendingFiles(pendingWithCounts.slice(0, 10)); // Limit to 10

      // Fetch recently approved files
      const approvedResponse = await fetch(
        `${supabaseUrl}/functions/v1/keep-files?area=gold_library&lifecycle_status=approved`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (approvedResponse.ok) {
        const approvedData = await approvedResponse.json();
        setRecentApproved((approvedData.files || []).slice(0, 5));
      }

      // Fetch recently submitted files (pending + approved combined, sorted by date)
      const allRecentResponse = await fetch(
        `${supabaseUrl}/functions/v1/keep-files?area=gold_library`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (allRecentResponse.ok) {
        const allRecentData = await allRecentResponse.json();
        const sorted = (allRecentData.files || [])
          .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 5);
        setRecentSubmitted(sorted);
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch governance data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const approveFile = useCallback(async (
    fileId: string,
    notes?: string,
    options: { override?: boolean } = {}
  ): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      if (!supabaseUrl) {
        throw new Error('SUPABASE_URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/keep-file-approval`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          decision: 'approved',
          notes,
          override: options.override || false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to approve file');
      }

      const data = await response.json();

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to approve file');
      }

      // Refresh data after approval
      await fetchData();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve file';
      setError(message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchData]);

  const rejectFile = useCallback(async (fileId: string, notes?: string): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      if (!supabaseUrl) {
        throw new Error('SUPABASE_URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/keep-file-approval`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          decision: 'rejected',
          notes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to reject file');
      }

      const data = await response.json();

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to reject file');
      }

      // Refresh data after rejection
      await fetchData();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject file';
      setError(message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchData]);

  const withdrawFile = useCallback(async (fileId: string): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      if (!supabaseUrl) {
        throw new Error('SUPABASE_URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/keep-delete-file`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to withdraw file');
      }

      await fetchData();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to withdraw file';
      setError(message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchData]);

  const movePendingFile = useCallback(async (fileId: string, destinationFolderId: string): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      if (!supabaseUrl) {
        throw new Error('SUPABASE_URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/keep-move-file`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId, destinationFolderId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to move file');
      }

      await fetchData();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to move file';
      setError(message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchData]);

  return {
    pendingFiles,
    recentApproved,
    recentSubmitted,
    loading,
    error,
    refetch: fetchData,
    approveFile,
    rejectFile,
    withdrawFile,
    movePendingFile,
    isSubmitting,
  };
}
