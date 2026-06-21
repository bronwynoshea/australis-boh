import React from 'react';
import {
  FolderIcon,
  FileTextIcon,
  ImageIcon,
  FileSpreadsheetIcon,
  FileCodeIcon,
  DownloadIcon,
  MoreVerticalIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  CrownIcon,
  BookmarkIcon,
} from './Icons';
import type { KeepFileItem } from '../types';
import { FILE_TYPE_ICONS, FILE_TYPE_COLORS } from '../constants';

interface FileCardProps {
  file: KeepFileItem;
  onClick: () => void;
  onDownload?: () => void;
  isSelected?: boolean;
  lifecycleStatus?: string;
  area?: 'workspace' | 'gold_library';
  isInMyLinks?: boolean;
  isInCrewLinks?: boolean;
  approvalCount?: number;
}

const getFileIcon = (mimeType: string, isFolder: boolean) => {
  if (isFolder) return FolderIcon;
  
  const iconMap: Record<string, React.ComponentType> = {
    'file-text': FileTextIcon,
    'image': ImageIcon,
    'file-spreadsheet': FileSpreadsheetIcon,
    'file-code': FileCodeIcon,
  };

  const iconKey = FILE_TYPE_ICONS[mimeType] || 'file-text';
  return iconMap[iconKey] || FileTextIcon;
};

const getFileColor = (mimeType: string, isFolder: boolean) => {
  if (isFolder) return FILE_TYPE_COLORS.folder;
  
  for (const [type, color] of Object.entries(FILE_TYPE_COLORS)) {
    if (mimeType.includes(type)) return color;
  }
  
  return FILE_TYPE_COLORS.default;
};

const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return '';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString();
};

const getStatusBadge = (lifecycleStatus?: string, area?: 'workspace' | 'gold_library', approvalCount?: number) => {
  if (!area || area === 'workspace') return null;
  
  switch (lifecycleStatus) {
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
          Pending {approvalCount !== undefined ? `(${approvalCount}/2)` : ''}
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30 rounded-full">
          <XCircleIcon className="w-3 h-3" />
          Rejected
        </span>
      );
    case 'archived':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-slate-800 rounded-full">
          Archived
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 rounded-full">
          Draft
        </span>
      );
  }
};

export default function FileCard({ file, onClick, onDownload, isSelected, lifecycleStatus, area, isInMyLinks, isInCrewLinks, approvalCount }: FileCardProps) {
  const Icon = getFileIcon(file.mimeType, file.isFolder);
  const colorClass = getFileColor(file.mimeType, file.isFolder);
  const statusBadge = getStatusBadge(lifecycleStatus, area, approvalCount);

  return (
    <div
      onClick={onClick}
      className={`
        group relative rounded-lg border p-4 cursor-pointer
        transition-all duration-200 hover:shadow-lg hover:-translate-y-1
        ${isSelected
          ? 'border-boh-primary bg-boh-primary/5 dark:bg-boh-primary/10'
          : 'border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface'
        }
      `}
    >
      {/* Quick Link Indicators */}
      {(isInMyLinks || isInCrewLinks) && (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {isInCrewLinks && (
            <span className="p-1 rounded bg-boh-primary/10 text-boh-primary" title="In Crew Links">
              <CrownIcon className="w-3 h-3" />
            </span>
          )}
          {isInMyLinks && (
            <span className="p-1 rounded bg-boh-bg-light dark:bg-boh-bg border border-boh-border-light dark:border-boh-border" title="In My Links">
              <BookmarkIcon className="w-3 h-3 text-boh-text-sub-light dark:text-boh-text-sub" />
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-3 rounded-lg bg-boh-bg-light dark:bg-boh-bg ${colorClass}`}>
            <Icon className="w-6 h-6" />
          </div>

          {!file.isFolder && onDownload && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-boh-surface-light dark:hover:bg-boh-surface"
            >
              <DownloadIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex-1">
          <h3 className="font-medium text-sm text-boh-text-light dark:text-boh-text line-clamp-2 mb-1">
            {file.name}
          </h3>
          
          <div className="flex items-center gap-2 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
            {file.size && <span>{formatFileSize(file.size)}</span>}
            {file.size && file.modifiedTime && <span>•</span>}
            {file.modifiedTime && <span>{formatDate(file.modifiedTime)}</span>}
          </div>
        </div>

        {file.isFolder ? (
          <div className="mt-2 pt-2 border-t border-boh-border-light dark:border-boh-border">
            <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
              Folder
            </span>
          </div>
        ) : statusBadge ? (
          <div className="mt-2 pt-2 border-t border-boh-border-light dark:border-boh-border">
            {statusBadge}
          </div>
        ) : null}
      </div>
    </div>
  );
}
