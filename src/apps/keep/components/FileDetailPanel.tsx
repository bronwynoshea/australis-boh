import React from 'react';
import {
  DownloadIcon,
  BookmarkIcon,
  CrownIcon,
  FileTextIcon,
  FileSpreadsheetIcon,
  ImageIcon,
  FolderIcon,
  XIcon,
  TrashIcon,
  UploadIcon,
} from './Icons';
import toast from 'react-hot-toast';
import type { KeepFileItem } from '../types';
import { useFileDownload } from '../hooks/useFileDownload';

interface FileDetailPanelProps {
  file: KeepFileItem | null;
  onClose: () => void;
  area?: 'workspace' | 'gold_library';
  isInMyLinks?: boolean;
  isInCrewLinks?: boolean;
  onAddToMyLinks?: () => void;
  onRemoveFromMyLinks?: () => void;
  onAddToCrewLinks?: () => void;
  onRemoveFromCrewLinks?: () => void;
  isSuperAdmin?: boolean;
  onDownload?: () => void;
  onDeleteFile?: () => void;
  onSubmitToGold?: () => void;
}

const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getFileIcon = (mimeType: string, isFolder: boolean) => {
  if (isFolder) return FolderIcon;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheetIcon;
  if (mimeType.includes('image')) return ImageIcon;
  return FileTextIcon;
};

const getFileTypeLabel = (mimeType: string, isFolder: boolean): string => {
  if (isFolder) return 'Folder';
  if (mimeType.includes('pdf')) return 'PDF Document';
  if (mimeType.includes('image')) return 'Image';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Spreadsheet';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'Document';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'Presentation';
  if (mimeType.includes('text')) return 'Text File';
  return 'File';
};

const getGoldLibraryActionLabel = (file: KeepFileItem): string => {
  switch (file.goldLibraryStatus) {
    case 'pending_review':
      return 'In Gold Library Queue';
    case 'approved':
      return 'Update Gold Library';
    case 'rejected':
      return 'Resubmit to Gold Library';
    default:
      return file.hasGoldLibraryCopy ? 'Update Gold Library' : 'Submit to Gold Library';
  }
};

export default function FileDetailPanel({
  file,
  onClose,
  area = 'workspace',
  isInMyLinks = false,
  isInCrewLinks = false,
  onAddToMyLinks,
  onRemoveFromMyLinks,
  onAddToCrewLinks,
  onRemoveFromCrewLinks,
  isSuperAdmin = false,
  onDownload,
  onDeleteFile,
  onSubmitToGold,
}: FileDetailPanelProps) {
  const { executeDownload, isDownloading } = useFileDownload({
    onError: (message) => toast.error(message),
  });

  if (!file) return null;

  const Icon = getFileIcon(file.mimeType, file.isFolder);
  const fileTypeLabel = getFileTypeLabel(file.mimeType, file.isFolder);
  const isGoldLibrary = area === 'gold_library';
  const submitToGoldLabel = getGoldLibraryActionLabel(file);
  const isPendingGoldReview = file.goldLibraryStatus === 'pending_review';

  const handleDownload = async () => {
    await executeDownload(file.id, file.name);
  };

  return (
    <div className="h-full flex flex-col bg-boh-surface-light dark:bg-boh-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-boh-border-light dark:border-boh-border flex-shrink-0">
        <h3 className="font-semibold text-boh-text-light dark:text-boh-text">File Details</h3>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-boh-bg-light dark:hover:bg-boh-bg text-boh-text-sub-light dark:text-boh-text-sub">
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 p-4 border-b border-boh-border-light dark:border-boh-border">
          <div className="w-12 h-12 rounded-xl bg-boh-primary/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-boh-primary" />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-boh-text-light dark:text-boh-text truncate">{file.name}</h4>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">{fileTypeLabel}</p>
          </div>
        </div>

        {/* Actions & Info */}
        <div className="p-4 space-y-4">
          {/* Actions */}
          {!isGoldLibrary && (
            <div>
              <button onClick={handleDownload} disabled={isDownloading} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 disabled:opacity-50 text-sm">
                <DownloadIcon className="w-4 h-4" />
                {isDownloading ? '...' : 'Download'}
              </button>
            </div>
          )}

          {isGoldLibrary && (
            <div className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg px-4 py-3 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              Gold Library is vault storage. Files are reviewed and stored here rather than edited in place.
            </div>
          )}

          {onSubmitToGold && !file.isFolder && (
            <button
              onClick={onSubmitToGold}
              disabled={isPendingGoldReview}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
            >
              <UploadIcon className="w-4 h-4" />
              {submitToGoldLabel}
            </button>
          )}

          {/* Delete Action */}
          {onDeleteFile && (
            <button
              onClick={onDeleteFile}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg text-sm"
            >
              <TrashIcon className="w-4 h-4" />
              Delete File
            </button>
          )}

          {/* Info */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-boh-text-sub-light dark:text-boh-text-sub">Size</span>
              <span className="text-boh-text-light dark:text-boh-text">{formatFileSize(file.size)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-boh-text-sub-light dark:text-boh-text-sub">Modified</span>
              <span className="text-boh-text-light dark:text-boh-text">{formatDate(file.modifiedTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-boh-text-sub-light dark:text-boh-text-sub">Updated By</span>
              <span className="text-boh-text-light dark:text-boh-text">{file.uploadedByName || '—'}</span>
            </div>
          </div>

          {/* Quick Links */}
          {!isGoldLibrary && (onAddToMyLinks || (isSuperAdmin && onAddToCrewLinks)) && (
            <div className="pt-2 border-t border-boh-border-light dark:border-boh-border">
              {onAddToMyLinks && (
                <button onClick={isInMyLinks ? onRemoveFromMyLinks : onAddToMyLinks} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-boh-bg-light dark:hover:bg-boh-bg text-left text-sm">
                  <BookmarkIcon className={`w-4 h-4 ${isInMyLinks ? 'fill-boh-primary text-boh-primary' : ''}`} />
                  {isInMyLinks ? 'Remove from My Links' : 'Add to My Links'}
                </button>
              )}
              {isSuperAdmin && onAddToCrewLinks && (
                <button onClick={isInCrewLinks ? onRemoveFromCrewLinks : onAddToCrewLinks} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-boh-bg-light dark:hover:bg-boh-bg text-left text-sm">
                  <CrownIcon className={`w-4 h-4 ${isInCrewLinks ? 'text-boh-primary' : ''}`} />
                  {isInCrewLinks ? 'Remove from Crew Links' : 'Add to Crew Links'}
                </button>
              )}
            </div>
          )}

          {/* Status Badges */}
          {(isInMyLinks || isInCrewLinks) && (
            <div className="flex gap-2">
              {isInCrewLinks && <span className="px-2 py-1 text-xs bg-boh-primary/10 text-boh-primary rounded-full">Crew Link</span>}
              {isInMyLinks && <span className="px-2 py-1 text-xs bg-boh-bg-light dark:bg-boh-bg border border-boh-border-light dark:border-boh-border rounded-full">My Link</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
