import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  FileTextIcon,
  FolderIcon,
  AlertCircleIcon,
  XIcon,
} from '../components/Icons';
import { supabase } from '../../../lib/supabase';
import FileDetailModal from '../components/FileDetailModal';
import type { KeepFile } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

interface FileWithDetails extends KeepFile {
  uploaded_by_name?: string;
  folder_name?: string;
  folder_path?: string;
  approval_count?: number;
  required_approval_count?: number;
  can_publish_immediately?: boolean;
}

type FilterTab = 'pending_review' | 'approved' | 'rejected';

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getStatusBadge = (lifecycleStatus: string) => {
  switch (lifecycleStatus) {
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30 rounded-full">
          <CheckCircleIcon className="w-3 h-3" />
          Approved
        </span>
      );
    case 'pending_review':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 rounded-full">
          <ClockIcon className="w-3 h-3" />
          Pending Review
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30 rounded-full">
          <XCircleIcon className="w-3 h-3" />
          Rejected
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 rounded-full">
          Draft
        </span>
      );
  }
};

export default function KeepReviewQueuePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FilterTab>('pending_review');
  const [files, setFiles] = useState<FileWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileWithDetails | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchFiles = async () => {
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
        `${supabaseUrl}/functions/v1/keep-files?area=gold_library&lifecycle_status=${activeTab}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch files: ${response.status}`);
      }

      const data = await response.json();

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch files');
      }

      const filesWithApprovalCount = await Promise.all(
        (data.files || []).map(async (file: FileWithDetails) => {
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
              return {
                ...file,
                approval_count: approvedCount,
                required_approval_count: approvalData.status?.requiredApprovalCount || 2,
                can_publish_immediately: Boolean(approvalData.status?.canPublishImmediately),
              };
            }
          } catch (err) {
            console.warn('Failed to fetch approval count for file:', file.id);
          }
          return { ...file, approval_count: 0, required_approval_count: 2, can_publish_immediately: false };
        })
      );

      setFiles(filesWithApprovalCount);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch files';
      setError(message);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [activeTab]);

  const handleFileClick = (file: FileWithDetails) => {
    setSelectedFile(file);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedFile(null);
    fetchFiles();
  };

  const getTabCount = (tab: FilterTab) => {
    return files.filter(f => f.lifecycle_status === tab).length;
  };

  return (
    <div className="h-full flex flex-col bg-boh-bg-light dark:bg-boh-bg">
      {/* Header */}
      <div className="border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
        <div className="px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">
              Gold Library Review Queue
            </h1>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">
              Review and approve files for the Gold Library
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/keep/gold-library')}
            aria-label="Close review queue"
            title="Close review queue"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 gap-1">
          <button
            onClick={() => setActiveTab('pending_review')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'pending_review'
                ? 'text-boh-primary border-boh-primary'
                : 'text-boh-text-sub-light dark:text-boh-text-sub border-transparent hover:text-boh-text-light dark:hover:text-boh-text'
            }`}
          >
            <span className="flex items-center gap-2">
              <ClockIcon className="w-4 h-4" />
              Pending Review
              {files.filter(f => f.lifecycle_status === 'pending_review').length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
                  {files.filter(f => f.lifecycle_status === 'pending_review').length}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'approved'
                ? 'text-boh-primary border-boh-primary'
                : 'text-boh-text-sub-light dark:text-boh-text-sub border-transparent hover:text-boh-text-light dark:hover:text-boh-text'
            }`}
          >
            <span className="flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4" />
              Approved
            </span>
          </button>
          <button
            onClick={() => setActiveTab('rejected')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'rejected'
                ? 'text-boh-primary border-boh-primary'
                : 'text-boh-text-sub-light dark:text-boh-text-sub border-transparent hover:text-boh-text-light dark:hover:text-boh-text'
            }`}
          >
            <span className="flex items-center gap-2">
              <XCircleIcon className="w-4 h-4" />
              Rejected
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-boh-primary mb-4"></div>
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                Loading files...
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center max-w-md">
              <AlertCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text mb-2">
                Failed to load files
              </h3>
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-4">
                {error}
              </p>
              <button
                onClick={fetchFiles}
                className="px-4 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <FileTextIcon className="w-12 h-12 text-boh-text-sub-light dark:text-boh-text-sub mx-auto mb-4" />
              <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text mb-2">
                No files found
              </h3>
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                {activeTab === 'pending_review'
                  ? 'No files are currently pending review.'
                  : activeTab === 'approved'
                  ? 'No files have been approved yet.'
                  : 'No files have been rejected.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-boh-bg-light dark:bg-boh-bg border-b border-boh-border-light dark:border-boh-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                    File Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                    Folder
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                    Uploaded By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                    Status
                  </th>
                  {activeTab === 'pending_review' && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                      Approvals
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-boh-border-light dark:divide-boh-border">
                {files.map((file) => (
                  <tr
                    key={file.id}
                    onClick={() => handleFileClick(file)}
                    className="hover:bg-boh-bg-light dark:hover:bg-boh-bg cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileTextIcon className="w-4 h-4 text-boh-text-sub-light dark:text-boh-text-sub flex-shrink-0" />
                        <span className="font-medium text-boh-text-light dark:text-boh-text">
                          {file.file_name}
                          {file.file_ext && `.${file.file_ext}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                      {file.folder_path || file.folder_name || file.folder_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                      {file.uploaded_by_name || file.uploaded_by.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                      {formatFileSize(file.file_size_bytes)}
                    </td>
                    <td className="px-4 py-3 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                      {formatDate(file.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(file.lifecycle_status)}
                    </td>
                    {activeTab === 'pending_review' && (
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                          {file.can_publish_immediately
                            ? 'Ready for super admin approval'
                            : `${file.approval_count || 0} of ${file.required_approval_count || 2}`}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* File Detail Modal */}
      {selectedFile && (
        <FileDetailModal
          file={{
            id: selectedFile.id,
            name: `${selectedFile.file_name}${selectedFile.file_ext ? `.${selectedFile.file_ext}` : ''}`,
            mimeType: selectedFile.mime_type,
            size: selectedFile.file_size_bytes,
            modifiedTime: selectedFile.updated_at,
            isFolder: false,
            folderId: selectedFile.folder_id,
            uploadedBy: selectedFile.uploaded_by,
            uploadedByName: selectedFile.uploaded_by_name,
          }}
          isOpen={showDetailModal}
          onClose={handleCloseModal}
          area="gold_library"
          canUploadNewVersion={false}
        />
      )}
    </div>
  );
}
