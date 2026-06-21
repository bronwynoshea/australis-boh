import React, { useEffect, useMemo, useState } from 'react';
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  CheckIcon,
  XIcon,
  TrashIcon,
  FileTextIcon,
  FolderIcon,
} from './Icons';
import { useGoldLibraryGovernance } from '../hooks/useGoldLibraryGovernance';
import { supabase } from '../../../lib/supabase';
import FolderTreePicker from './FolderTreePicker';
import ConfirmDialog from './ConfirmDialog';
import type { KeepFolder } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

interface GoldLibraryGovernancePanelProps {
  folders: KeepFolder[];
  onSubmitSuccess: () => void;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30 rounded-full">
          <CheckCircleIcon className="w-3 h-3" />
          Approved
        </span>
      );
    case 'pending_review':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 rounded-full">
          <ClockIcon className="w-3 h-3" />
          Pending
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30 rounded-full">
          <XCircleIcon className="w-3 h-3" />
          Rejected
        </span>
      );
    default:
      return null;
  }
};

export default function GoldLibraryGovernancePanel({
  onSubmitSuccess,
}: GoldLibraryGovernancePanelProps) {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [allGoldFolders, setAllGoldFolders] = useState<KeepFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [movingFileId, setMovingFileId] = useState<string | null>(null);
  const [selectedMoveFolderId, setSelectedMoveFolderId] = useState<string | null>(null);
  const [selectedMoveFolderPath, setSelectedMoveFolderPath] = useState('');
  const [filePendingWithdraw, setFilePendingWithdraw] = useState<{ id: string; name: string } | null>(null);
  const [filePendingOverride, setFilePendingOverride] = useState<{ id: string; name: string } | null>(null);

  const {
    pendingFiles,
    recentSubmitted,
    loading,
    error,
    approveFile,
    rejectFile,
    withdrawFile,
    movePendingFile,
    isSubmitting,
  } = useGoldLibraryGovernance();

  useEffect(() => {
    const fetchGoldFolders = async () => {
      setLoadingFolders(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token || !supabaseUrl) return;

        const response = await fetch(
          `${supabaseUrl}/functions/v1/keep-folders?area=gold_library&include_all=true`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        const data = await response.json().catch(() => ({}));
        if (response.ok && data?.success) {
          setAllGoldFolders(data.folders || []);
        }
      } catch (err) {
        console.warn('[GoldLibraryGovernancePanel] Failed to fetch Gold Library folders:', err);
      } finally {
        setLoadingFolders(false);
      }
    };

    fetchGoldFolders();
  }, []);

  const folderPathById = useMemo(() => {
    const map = new Map<string, KeepFolder>(allGoldFolders.map(folder => [folder.id, folder]));
    const buildPath = (folderId: string): string => {
      const names: string[] = [];
      let currentId: string | null = folderId;

      while (currentId) {
        const folder = map.get(currentId);
        if (!folder) break;
        if (!folder.is_system_folder) names.unshift(folder.name);
        currentId = folder.parent_id;
      }

      return names.join(' / ');
    };

    return new Map(allGoldFolders.map(folder => [folder.id, buildPath(folder.id)]));
  }, [allGoldFolders]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApprove = async (fileId: string) => {
    const success = await approveFile(fileId);
    showToast(success ? 'File approved successfully' : 'Failed to approve file', success ? 'success' : 'error');
  };

  const handlePublishWithOverride = async (fileId: string) => {
    const success = await approveFile(fileId, 'Super admin self-submit override', { override: true });
    showToast(success ? 'File submitted with override' : 'Failed to submit with override', success ? 'success' : 'error');
    if (success) {
      setFilePendingOverride(null);
    }
  };

  const handleReject = async (fileId: string) => {
    const success = await rejectFile(fileId);
    showToast(success ? 'File rejected' : 'Failed to reject file', success ? 'success' : 'error');
  };

  const handleWithdraw = async (fileId: string) => {
    const success = await withdrawFile(fileId);
    showToast(success ? 'Submission withdrawn' : 'Failed to withdraw submission', success ? 'success' : 'error');
    if (success) {
      setFilePendingWithdraw(null);
    }
  };

  const startMove = (fileId: string, currentFolderId: string) => {
    setMovingFileId(fileId);
    setSelectedMoveFolderId(currentFolderId);
    setSelectedMoveFolderPath(folderPathById.get(currentFolderId) || '');
  };

  const handleMove = async () => {
    if (!movingFileId || !selectedMoveFolderId) return;

    const success = await movePendingFile(movingFileId, selectedMoveFolderId);
    showToast(success ? 'Destination updated' : 'Failed to update destination', success ? 'success' : 'error');
    if (success) {
      setMovingFileId(null);
      setSelectedMoveFolderId(null);
      setSelectedMoveFolderPath('');
      onSubmitSuccess();
    }
  };

  const getApprovalCopy = (file: typeof pendingFiles[number]) => {
    if (file.can_publish_immediately) {
      return 'Ready for super admin approval';
    }

    const requiredCount = file.required_approval_count || 2;
    return `${file.approval_count} of ${requiredCount} approval${requiredCount === 1 ? '' : 's'}`;
  };

  const getApprovalActionCopy = (file: typeof pendingFiles[number]) => {
    if (file.can_publish_immediately) {
      return 'Your approval will submit this file immediately';
    }

    const requiredCount = file.required_approval_count || 2;
    if (requiredCount === 1) {
      return 'This requires one approval from another admin or super admin';
    }

    return file.approval_count === 0
      ? 'Your approval will record the first approval'
      : 'Your approval will complete approval and submit this file';
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircleIcon className="w-5 h-5" />
            ) : (
              <XCircleIcon className="w-5 h-5" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
            Review Queue
          </h3>
          {pendingFiles.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
              {pendingFiles.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-boh-bg-light dark:bg-boh-bg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : pendingFiles.length === 0 ? (
          <div className="text-center py-8">
            <ClockIcon className="w-8 h-8 text-boh-text-sub-light dark:text-boh-text-sub mx-auto mb-2" />
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              No files pending review
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {pendingFiles.map((file) => (
              <div
                key={file.id}
                className="p-3 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileTextIcon className="w-4 h-4 text-boh-text-sub-light dark:text-boh-text-sub flex-shrink-0" />
                      <p className="text-sm font-medium text-boh-text-light dark:text-boh-text truncate">
                        {file.file_name}{file.file_ext && `.${file.file_ext}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        by {file.uploaded_by_name || file.uploaded_by.slice(0, 8)}
                      </p>
                      <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">-</span>
                      <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        {formatDate(file.updated_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                      <FolderIcon className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">
                        {folderPathById.get(file.folder_id) || 'Gold Library'}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    {getApprovalCopy(file)}
                  </span>
                </div>

                {movingFileId === file.id && (
                  <div className="mb-3 p-3 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider mb-2">
                        Correct Gold Library Folder
                      </p>
                      {loadingFolders ? (
                        <div className="p-3 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                          Loading folders...
                        </div>
                      ) : (
                        <FolderTreePicker
                          folders={allGoldFolders}
                          selectedFolderId={selectedMoveFolderId}
                          onSelectFolder={(folderId, folderPath) => {
                            setSelectedMoveFolderId(folderId);
                            setSelectedMoveFolderPath(folderPath);
                          }}
                        />
                      )}
                    </div>
                    {selectedMoveFolderPath && (
                      <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        New destination: <span className="font-medium text-boh-text-light dark:text-boh-text">{selectedMoveFolderPath}</span>
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleMove}
                        disabled={isSubmitting || !selectedMoveFolderId || selectedMoveFolderId === file.folder_id}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-boh-primary text-white text-xs rounded hover:bg-boh-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CheckIcon className="w-3 h-3" />
                        Save destination
                      </button>
                      <button
                        onClick={() => {
                          setMovingFileId(null);
                          setSelectedMoveFolderId(null);
                          setSelectedMoveFolderPath('');
                        }}
                        disabled={isSubmitting}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 border border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text text-xs rounded hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors disabled:opacity-50"
                      >
                        <XIcon className="w-3 h-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {file.is_own_file ? (
                  <div className="space-y-2">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-300">
                      {file.can_publish_with_override
                        ? 'You can submit this with a recorded super admin override'
                        : 'Awaiting review - you cannot approve your own submission'}
                    </div>
                    {file.can_publish_with_override && (
                      <button
                        onClick={() => setFilePendingOverride({
                          id: file.id,
                          name: file.file_ext ? `${file.file_name}.${file.file_ext}` : file.file_name,
                        })}
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-1 px-2 py-1 bg-boh-primary text-white text-xs rounded hover:bg-boh-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CheckIcon className="w-3 h-3" />
                        Submit with override
                      </button>
                    )}
                    <button
                      onClick={() => startMove(file.id, file.folder_id)}
                      disabled={isSubmitting || loadingFolders}
                      className="w-full flex items-center justify-center gap-1 px-2 py-1 border border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text text-xs rounded hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FolderIcon className="w-3 h-3" />
                      Change destination
                    </button>
                    <button
                      onClick={() => setFilePendingWithdraw({
                        id: file.id,
                        name: file.file_ext ? `${file.file_name}.${file.file_ext}` : file.file_name,
                      })}
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-1 px-2 py-1 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <TrashIcon className="w-3 h-3" />
                      Withdraw submission
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      {file.can_user_approve && (
                        <button
                          onClick={() => handleApprove(file.id)}
                          disabled={isSubmitting}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckIcon className="w-3 h-3" />
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => handleReject(file.id)}
                        disabled={isSubmitting || !file.can_user_reject}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <XIcon className="w-3 h-3" />
                        Reject
                      </button>
                    </div>
                    <button
                      onClick={() => startMove(file.id, file.folder_id)}
                      disabled={isSubmitting || loadingFolders}
                      className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1 border border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text text-xs rounded hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FolderIcon className="w-3 h-3" />
                      Change destination
                    </button>
                    <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
                      {getApprovalActionCopy(file)}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border p-4">
        <h3 className="text-sm font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider mb-3">
          Recent Activity
        </h3>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-boh-bg-light dark:bg-boh-bg animate-pulse" />
            ))}
          </div>
        ) : recentSubmitted.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              No recent activity
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentSubmitted.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-boh-text-light dark:text-boh-text truncate">
                    {file.file_name}{file.file_ext && `.${file.file_ext}`}
                  </p>
                  <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                    {formatDate(file.updated_at)}
                  </p>
                </div>
                <div className="ml-2">
                  {getStatusBadge(file.lifecycle_status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!filePendingWithdraw}
        title="Withdraw submission?"
        body={
          <>
            This will remove{' '}
            <span className="font-semibold text-boh-text-light dark:text-boh-text">
              {filePendingWithdraw?.name}
            </span>
            {' '}from the Gold Library review queue.
          </>
        }
        confirmLabel="Withdraw submission"
        confirmingLabel="Withdrawing..."
        isConfirming={isSubmitting}
        onCancel={() => {
          if (!isSubmitting) setFilePendingWithdraw(null);
        }}
        onConfirm={() => {
          if (filePendingWithdraw) handleWithdraw(filePendingWithdraw.id);
        }}
      />

      <ConfirmDialog
        isOpen={!!filePendingOverride}
        title="Submit with super admin override?"
        body="This will submit your own file without independent approval. The override will be recorded in the activity history."
        confirmLabel="Submit with override"
        confirmingLabel="Submitting..."
        isConfirming={isSubmitting}
        onCancel={() => {
          if (!isSubmitting) setFilePendingOverride(null);
        }}
        onConfirm={() => {
          if (filePendingOverride) handlePublishWithOverride(filePendingOverride.id);
        }}
      />
    </div>
  );
}
