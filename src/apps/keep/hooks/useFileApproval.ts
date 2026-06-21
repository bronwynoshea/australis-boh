import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

export interface FileApproval {
  id: string;
  file_id: string;
  approval_stage: number;
  required_stage: number;
  reviewer_id: string;
  decision: 'approved' | 'rejected';
  reviewed_at: string;
  notes: string | null;
}

interface ApprovalStatus {
  isApproved: boolean;
  isRejected: boolean;
  currentStage: number;
  approvedCount: number;
  requiredApprovalCount: number;
  canUserApprove: boolean;
  canUserReject: boolean;
  canPublishImmediately: boolean;
  canPublishWithOverride: boolean;
  isOwnFile: boolean;
  submitterIsAdminOrSuper: boolean;
  currentUserIsAdminOrSuper: boolean;
  currentUserIsSuperAdmin: boolean;
}

interface UseFileApprovalResult {
  approvals: FileApproval[];
  status: ApprovalStatus | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  submitApproval: (
    decision: 'approved' | 'rejected',
    notes?: string,
    actionOptions?: { override?: boolean }
  ) => Promise<boolean>;
  isSubmitting: boolean;
}

export function useFileApproval(
  fileId: string | undefined,
  options: { onSubmitSuccess?: () => void; onSubmitError?: (error: string) => void } = {}
): UseFileApprovalResult {
  const [approvals, setApprovals] = useState<FileApproval[]>([]);
  const [status, setStatus] = useState<ApprovalStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchApprovals = useCallback(async () => {
    if (!fileId) {
      setApprovals([]);
      setStatus(null);
      return;
    }

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

      const response = await fetch(
        `${supabaseUrl}/functions/v1/keep-file-approval?file_id=${encodeURIComponent(fileId)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch approvals: ${response.status}`);
      }

      const data = await response.json();

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch approvals');
      }

      setApprovals(data.approvals || []);
      setStatus(data.status || null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch approvals';
      setError(message);
      setApprovals([]);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  const submitApproval = useCallback(async (
    decision: 'approved' | 'rejected',
    notes?: string,
    actionOptions: { override?: boolean } = {}
  ): Promise<boolean> => {
    if (!fileId) {
      setError('No file selected');
      return false;
    }

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
          decision,
          notes,
          override: actionOptions.override || false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to submit approval: ${response.status}`);
      }

      const data = await response.json();

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to submit approval');
      }

      // Update local state with new approval
      if (data.approval) {
        setApprovals(prev => [...prev, data.approval]);
      }
      
      if (data.status) {
        setStatus(data.status);
      }

      options.onSubmitSuccess?.();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit approval';
      setError(message);
      options.onSubmitError?.(message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [fileId, options]);

  // Fetch approvals on mount and when fileId changes
  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  return {
    approvals,
    status,
    loading,
    error,
    refetch: fetchApprovals,
    submitApproval,
    isSubmitting,
  };
}
