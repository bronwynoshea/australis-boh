import React, { useEffect, useState } from 'react';
import {
  XIcon,
  DownloadIcon,
  ExternalLinkIcon,
  HistoryIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  UploadIcon,
  CheckIcon,
  FileTextIcon,
} from './Icons';
import type { KeepFileItem } from '../types';
import { supabase } from '../../../lib/supabase';
import { useFileDownload } from '../hooks/useFileDownload';
import { useFileVersions, type FileVersion } from '../hooks/useFileVersions';
import { useFileApproval, type FileApproval } from '../hooks/useFileApproval';
import ConfirmDialog from './ConfirmDialog';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

interface FileDetailModalProps {
  file: KeepFileItem | null;
  isOpen: boolean;
  onClose: () => void;
  area?: 'workspace' | 'gold_library';
  canUploadNewVersion?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function FileDetailModal({ 
  file, 
  isOpen, 
  onClose, 
  area = 'workspace',
  canUploadNewVersion = false,
}: FileDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'versions' | 'approvals'>('preview');
  const [showUploadVersion, setShowUploadVersion] = useState(false);
  const [uploadReason, setUploadReason] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [overrideConfirmOpen, setOverrideConfirmOpen] = useState(false);
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const isGoldLibrary = area === 'gold_library';
  const { executeDownload, isDownloading } = useFileDownload();
  const { 
    versions, 
    loading: versionsLoading, 
    uploadNewVersion, 
    isUploading,
  } = useFileVersions(file?.id, {
    onUploadSuccess: () => {
      setShowUploadVersion(false);
      setSelectedFile(null);
      setUploadReason('');
    },
  });

  const {
    approvals,
    status: approvalStatus,
    loading: approvalsLoading,
    error: approvalsError,
    refetch: refetchApprovals,
    submitApproval,
    isSubmitting,
  } = useFileApproval(file?.id);

  useEffect(() => {
    if (!isOpen || !file) return;
    setActiveTab(isGoldLibrary ? 'approvals' : 'preview');
  }, [file?.id, isGoldLibrary, isOpen]);

  if (!isOpen || !file) return null;

  const isImage = file.mimeType.startsWith('image/');
  const isPdf = file.mimeType === 'application/pdf';

  const handleDownload = async () => {
    await executeDownload(file.id, file.name);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUploadVersion = async () => {
    if (!selectedFile) return;
    await uploadNewVersion(selectedFile, uploadReason);
  };

  const handleApprovalSubmit = async (decision: 'approved' | 'rejected') => {
    await submitApproval(decision, approvalNotes);
    setApprovalNotes('');
  };

  const handleOverrideSubmit = async () => {
    const success = await submitApproval('approved', approvalNotes || 'Super admin self-submit override', {
      override: true,
    });
    if (success) {
      setApprovalNotes('');
      setOverrideConfirmOpen(false);
    }
  };

  const handleWithdrawSubmit = async () => {
    if (!file?.id) return;

    setIsWithdrawing(true);
    setWithdrawError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      if (!supabaseUrl) throw new Error('SUPABASE_URL not configured');

      const response = await fetch(`${supabaseUrl}/functions/v1/keep-delete-file`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId: file.id }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to withdraw submission');
      }

      setWithdrawConfirmOpen(false);
      await refetchApprovals();
      onClose();
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : 'Failed to withdraw submission');
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-[1600] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-[900px] h-[min(80vh,720px)] max-h-[calc(100vh-2rem)] bg-boh-surface-light dark:bg-boh-surface rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-boh-border-light dark:border-boh-border">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text truncate">
              {file.name}
            </h2>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              {file.mimeType} • {file.size ? formatFileSize(file.size) : 'Unknown size'}
            </p>
          </div>

          <div className="flex items-center gap-2 ml-4">
            {!isGoldLibrary && (
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-2 px-3 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 transition-colors disabled:opacity-50"
              >
                <DownloadIcon className="w-4 h-4" />
                <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-boh-bg-light dark:hover:bg-boh-bg"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-boh-border-light dark:border-boh-border">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'preview'
                ? 'text-boh-primary border-b-2 border-boh-primary'
                : 'text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-boh-text'
            }`}
          >
            {isGoldLibrary ? 'Details' : 'Preview'}
          </button>
          <button
            onClick={() => setActiveTab('versions')}
            className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'versions'
                ? 'text-boh-primary border-b-2 border-boh-primary'
                : 'text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-boh-text'
            }`}
          >
            <HistoryIcon className="w-4 h-4" />
            Versions
            {versions.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-boh-primary/10 text-boh-primary rounded-full">
                {versions.length}
              </span>
            )}
          </button>
          {isGoldLibrary && (
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'approvals'
                  ? 'text-boh-primary border-b-2 border-boh-primary'
                  : 'text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-boh-text'
              }`}
            >
              <CheckCircleIcon className="w-4 h-4" />
              Approvals
              {approvalStatus && (
                <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                  approvalStatus.isApproved
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : approvalStatus.isRejected
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                }`}>
                  {approvalStatus.isApproved ? 'Approved' : approvalStatus.isRejected ? 'Rejected' : 'Pending'}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Content - internal scroll for tab content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-6">
          {activeTab === 'preview' && (
            <div className="space-y-4">
              {isGoldLibrary && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg p-4">
                    <h3 className="text-base font-semibold text-boh-text-light dark:text-boh-text mb-2">
                      Gold Library File
                    </h3>
                    <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                      This file is in the Gold Library review workflow. Review approvals and version history here before it is treated as protected vault storage.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-boh-border-light dark:border-boh-border p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub mb-1">
                        File Name
                      </p>
                      <p className="text-sm text-boh-text-light dark:text-boh-text break-words">
                        {file.name}
                      </p>
                    </div>
                    <div className="rounded-lg border border-boh-border-light dark:border-boh-border p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub mb-1">
                        File Type
                      </p>
                      <p className="text-sm text-boh-text-light dark:text-boh-text">
                        {file.mimeType}
                      </p>
                    </div>
                    <div className="rounded-lg border border-boh-border-light dark:border-boh-border p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub mb-1">
                        Size
                      </p>
                      <p className="text-sm text-boh-text-light dark:text-boh-text">
                        {file.size ? formatFileSize(file.size) : 'Unknown size'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-boh-border-light dark:border-boh-border p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub mb-1">
                        Last Updated
                      </p>
                      <p className="text-sm text-boh-text-light dark:text-boh-text">
                        {formatDate(file.modifiedTime)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!isGoldLibrary && (
                <>
              {isImage && (
                <div className="flex items-center justify-center min-h-[300px]">
                  <img
                    src={`/api/keep/preview/${file.id}`}
                    alt={file.name}
                    className="max-w-full max-h-[50vh] h-auto rounded-lg object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {isPdf && (
                <div className="h-[50vh] w-full">
                  <iframe
                    src={`/api/keep/preview/${file.id}`}
                    className="w-full h-full rounded-lg border border-boh-border-light dark:border-boh-border"
                    title={file.name}
                  ></iframe>
                </div>
              )}

              {/* Office files - Clean fallback, no broken viewer */}
              {(file.mimeType.includes('officedocument') ||
                file.mimeType.includes('msword') ||
                file.mimeType.includes('excel') ||
                file.mimeType.includes('powerpoint') ||
                file.name.endsWith('.docx') ||
                file.name.endsWith('.pptx') ||
                file.name.endsWith('.xlsx')) && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                    <FileTextIcon className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text mb-2">
                    {file.name}
                  </h3>
                  <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-1">
                    Office Document
                  </p>
                  <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mb-6 max-w-sm">
                    Browser preview is not available for Office files. Download to view or edit.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDownload}
                      disabled={isDownloading}
                      className="flex items-center gap-2 px-4 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 transition-colors disabled:opacity-50"
                    >
                      <DownloadIcon className="w-4 h-4" />
                      {isDownloading ? 'Downloading...' : 'Download'}
                    </button>
                    <button
                      onClick={() => window.open(`/api/keep/preview/${file.id}`, '_blank')}
                      className="flex items-center gap-2 px-4 py-2 bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text rounded-lg hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
                    >
                      <ExternalLinkIcon className="w-4 h-4" />
                      Open
                    </button>
                  </div>
                </div>
              )}

              {/* Fallback for non-previewable files */}
              {!isImage && !isPdf &&
               !file.mimeType.includes('officedocument') &&
               !file.mimeType.includes('msword') &&
               !file.mimeType.includes('excel') &&
               !file.mimeType.includes('powerpoint') &&
               !file.name.endsWith('.docx') &&
               !file.name.endsWith('.pptx') &&
               !file.name.endsWith('.xlsx') && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-xl bg-boh-primary/10 flex items-center justify-center mb-4">
                    <ExternalLinkIcon className="w-8 h-8 text-boh-primary" />
                  </div>
                  <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text mb-2">
                    Preview not available
                  </h3>
                  <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-6 max-w-sm">
                    This file format cannot be previewed in the browser. Download the file to view it.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDownload}
                      disabled={isDownloading}
                      className="flex items-center gap-2 px-4 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 transition-colors disabled:opacity-50"
                    >
                      <DownloadIcon className="w-4 h-4" />
                      {isDownloading ? 'Downloading...' : 'Download'}
                    </button>
                    <button
                      onClick={() => window.open(`/api/keep/preview/${file.id}`, '_blank')}
                      className="flex items-center gap-2 px-4 py-2 bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text rounded-lg hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
                    >
                      <ExternalLinkIcon className="w-4 h-4" />
                      Open in New Tab
                    </button>
                  </div>
                </div>
              )}
                </>
              )}
            </div>
          )}

          {activeTab === 'versions' && (
            <div className="space-y-4">
              {/* Upload new version section */}
              {canUploadNewVersion && (
                <div className="border border-boh-border-light dark:border-boh-border rounded-lg p-4">
                  {!showUploadVersion ? (
                    <button
                      onClick={() => setShowUploadVersion(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 transition-colors"
                    >
                      <UploadIcon className="w-4 h-4" />
                      Upload New Version
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
                          Select new file
                        </label>
                        <input
                          type="file"
                          onChange={handleFileSelect}
                          className="block w-full text-sm text-boh-text-sub-light dark:text-boh-text-sub
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-lg file:border-0
                            file:text-sm file:font-medium
                            file:bg-boh-primary file:text-white
                            hover:file:bg-boh-primary/90"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
                          Change reason (optional)
                        </label>
                        <input
                          type="text"
                          value={uploadReason}
                          onChange={(e) => setUploadReason(e.target.value)}
                          placeholder="e.g., Updated with new data"
                          className="w-full px-3 py-2 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleUploadVersion}
                          disabled={!selectedFile || isUploading}
                          className="px-4 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 transition-colors disabled:opacity-50"
                        >
                          {isUploading ? 'Uploading...' : 'Upload Version'}
                        </button>
                        <button
                          onClick={() => {
                            setShowUploadVersion(false);
                            setSelectedFile(null);
                            setUploadReason('');
                          }}
                          disabled={isUploading}
                          className="px-4 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text rounded-lg hover:bg-boh-border-light dark:hover:bg-boh-border transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Version history */}
              <div className="border border-boh-border-light dark:border-boh-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-boh-bg-light dark:bg-boh-bg">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-boh-text-sub-light dark:text-boh-text-sub">Version</th>
                      <th className="px-4 py-3 text-left font-medium text-boh-text-sub-light dark:text-boh-text-sub">Size</th>
                      <th className="px-4 py-3 text-left font-medium text-boh-text-sub-light dark:text-boh-text-sub">Uploaded</th>
                      <th className="px-4 py-3 text-left font-medium text-boh-text-sub-light dark:text-boh-text-sub">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-boh-border-light dark:divide-boh-border">
                    {versionsLoading ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-boh-text-sub-light dark:text-boh-text-sub">
                          Loading versions...
                        </td>
                      </tr>
                    ) : versions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center">
                          <div className="space-y-2">
                            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                              No versions yet
                            </p>
                            <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                              Upload a new version to start tracking changes
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      versions.map((version) => (
                        <tr key={version.id} className="hover:bg-boh-bg-light dark:hover:bg-boh-bg">
                          <td className="px-4 py-3">
                            <span className="font-medium">v{version.version_number}</span>
                            {version.version_number === versions.length && (
                              <span className="ml-2 text-xs text-boh-primary">(current)</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-boh-text-sub-light dark:text-boh-text-sub">
                            {formatFileSize(version.file_size_bytes)}
                          </td>
                          <td className="px-4 py-3 text-boh-text-sub-light dark:text-boh-text-sub">
                            {formatDate(version.uploaded_at)}
                          </td>
                          <td className="px-4 py-3 text-boh-text-sub-light dark:text-boh-text-sub">
                            {version.change_reason || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'approvals' && isGoldLibrary && (
            <div className="space-y-4">
              {/* Approval status */}
              {approvalsError && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {approvalsError}
                  </p>
                </div>
              )}

              {approvalStatus && (
                <div className={`p-4 rounded-lg ${
                  approvalStatus.isApproved
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : approvalStatus.isRejected
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {approvalStatus.isApproved ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : approvalStatus.isRejected ? (
                      <XCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                    ) : (
                      <ClockIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    )}
                    <span className="font-medium text-boh-text-light dark:text-boh-text">
                      {approvalStatus.isApproved
                        ? 'File Approved'
                        : approvalStatus.isRejected
                        ? 'File Rejected'
                        : approvalStatus.canPublishImmediately
                        ? 'Ready for super admin approval'
                        : `Pending Approval (Stage ${approvalStatus.currentStage}/${approvalStatus.requiredApprovalCount || 2})`}
                    </span>
                  </div>
                  <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                    {approvalStatus.isApproved
                      ? 'This file has been approved and is available in the Gold Library.'
                      : approvalStatus.isRejected
                      ? 'This file has been rejected and cannot be accessed.'
                      : `This file requires ${approvalStatus.requiredApprovalCount || 2} approval${(approvalStatus.requiredApprovalCount || 2) === 1 ? '' : 's'} before it becomes available in the Gold Library.`}
                  </p>
                </div>
              )}

              {/* Approval actions */}
              {(approvalStatus?.canUserApprove || approvalStatus?.canUserReject || approvalStatus?.canPublishWithOverride || approvalStatus?.isOwnFile) &&
                !approvalStatus?.isApproved &&
                !approvalStatus?.isRejected && (
                <div className="border border-boh-border-light dark:border-boh-border rounded-lg p-4">
                  <h4 className="font-medium text-boh-text-light dark:text-boh-text mb-3">
                    {approvalStatus?.canPublishWithOverride ? 'Super Admin Override' : approvalStatus?.isOwnFile ? 'Submission actions' : 'Submit Review'}
                  </h4>
                  <div className="space-y-3">
                    {(approvalStatus?.canUserApprove || approvalStatus?.canUserReject || approvalStatus?.canPublishWithOverride) && (
                    <div>
                      <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
                        Notes (optional)
                      </label>
                      <textarea
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text"
                        placeholder="Enter any notes about your review..."
                      />
                    </div>
                    )}
                    <div className="flex gap-2">
                      {approvalStatus?.canUserApprove && (
                        <button
                          onClick={() => handleApprovalSubmit('approved')}
                          disabled={isSubmitting}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <CheckIcon className="w-4 h-4" />
                          {isSubmitting ? 'Submitting...' : 'Approve'}
                        </button>
                      )}
                      {approvalStatus?.canUserReject && (
                        <button
                          onClick={() => handleApprovalSubmit('rejected')}
                          disabled={isSubmitting}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          <XIcon className="w-4 h-4" />
                          Reject
                        </button>
                      )}
                      {approvalStatus?.canPublishWithOverride && (
                        <button
                          onClick={() => setOverrideConfirmOpen(true)}
                          disabled={isSubmitting}
                          className="flex items-center gap-2 px-4 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 transition-colors disabled:opacity-50"
                        >
                          <CheckIcon className="w-4 h-4" />
                          Submit with override
                        </button>
                      )}
                      {approvalStatus?.isOwnFile && (
                        <button
                          onClick={() => {
                            setWithdrawError(null);
                            setWithdrawConfirmOpen(true);
                          }}
                          disabled={isSubmitting || isWithdrawing}
                          className="flex items-center gap-2 px-4 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                        >
                          <XIcon className="w-4 h-4" />
                          Withdraw submission
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!approvalsLoading && !approvalsError && approvalStatus &&
                !approvalStatus.isApproved &&
                !approvalStatus.isRejected &&
                !approvalStatus.canUserApprove &&
                !approvalStatus.canUserReject &&
                !approvalStatus.canPublishWithOverride && (
                <div className="p-4 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg">
                  <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                    {approvalStatus.isOwnFile
                      ? 'You cannot use the standard review actions on your own submission.'
                      : 'Review actions are not available for your current role on this file.'}
                  </p>
                </div>
              )}

              {/* Approval history */}
              <div className="border border-boh-border-light dark:border-boh-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-boh-bg-light dark:bg-boh-bg">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-boh-text-sub-light dark:text-boh-text-sub">Stage</th>
                      <th className="px-4 py-3 text-left font-medium text-boh-text-sub-light dark:text-boh-text-sub">Reviewer</th>
                      <th className="px-4 py-3 text-left font-medium text-boh-text-sub-light dark:text-boh-text-sub">Decision</th>
                      <th className="px-4 py-3 text-left font-medium text-boh-text-sub-light dark:text-boh-text-sub">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-boh-text-sub-light dark:text-boh-text-sub">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-boh-border-light dark:divide-boh-border">
                    {approvalsLoading ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-boh-text-sub-light dark:text-boh-text-sub">
                          Loading approvals...
                        </td>
                      </tr>
                    ) : approvals.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-boh-text-sub-light dark:text-boh-text-sub">
                          No approvals yet. Waiting for first reviewer.
                        </td>
                      </tr>
                    ) : (
                      approvals.map((approval) => (
                        <tr key={approval.id} className="hover:bg-boh-bg-light dark:hover:bg-boh-bg">
                          <td className="px-4 py-3">
                            <span className="font-medium">Stage {approval.approval_stage}</span>
                          </td>
                          <td className="px-4 py-3 text-boh-text-sub-light dark:text-boh-text-sub">
                            {approval.reviewer_id.slice(0, 8)}...
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                              approval.decision === 'approved'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            }`}>
                              {approval.decision === 'approved' ? (
                                <CheckIcon className="w-3 h-3" />
                              ) : (
                                <XIcon className="w-3 h-3" />
                              )}
                              {approval.decision === 'approved' ? 'Approved' : 'Rejected'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-boh-text-sub-light dark:text-boh-text-sub">
                            {formatDate(approval.reviewed_at)}
                          </td>
                          <td className="px-4 py-3 text-boh-text-sub-light dark:text-boh-text-sub">
                            {approval.notes || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>

      <ConfirmDialog
        isOpen={overrideConfirmOpen}
        title="Submit with super admin override?"
        body="This will submit your own file without independent approval. The override will be recorded in the activity history."
        confirmLabel="Submit with override"
        confirmingLabel="Submitting..."
        isConfirming={isSubmitting}
        onCancel={() => {
          if (!isSubmitting) {
            setOverrideConfirmOpen(false);
          }
        }}
        onConfirm={handleOverrideSubmit}
      />

      <ConfirmDialog
        isOpen={withdrawConfirmOpen}
        title="Withdraw submission?"
        body={
          <>
            This will remove{' '}
            <span className="font-semibold text-boh-text-light dark:text-boh-text">
              {file.name}
            </span>
            {' '}from the Gold Library review queue.
            {withdrawError && (
              <span className="block mt-3 text-red-600 dark:text-red-400">
                {withdrawError}
              </span>
            )}
          </>
        }
        confirmLabel="Withdraw submission"
        confirmingLabel="Withdrawing..."
        isConfirming={isWithdrawing}
        onCancel={() => {
          if (!isWithdrawing) {
            setWithdrawConfirmOpen(false);
            setWithdrawError(null);
          }
        }}
        onConfirm={handleWithdrawSubmit}
      />
    </>
  );
}
