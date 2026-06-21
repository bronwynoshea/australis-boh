import React, { useState } from 'react';
import {
  FolderIcon,
  FileTextIcon,
  FileSpreadsheetIcon,
  ImageIcon,
  FileCodeIcon,
  MoreVerticalIcon,
  BookmarkIcon,
  UsersIcon,
  CrownIcon,
  TrashIcon,
  UploadIcon,
} from './Icons';
import { FILE_TYPE_ICONS } from '../constants';
import type { KeepFileItem } from '../types';

interface FileGridProps {
  files: KeepFileItem[];
  onFileClick: (file: KeepFileItem) => void;
  selectedFileId?: string;
  loading?: boolean;
  area?: 'workspace' | 'gold_library';
  // Quick link actions
  isInMyLinks?: (targetId: string) => boolean;
  isInCrewLinks?: (targetId: string) => boolean;
  onAddToMyLinks?: (file: KeepFileItem) => void;
  onRemoveFromMyLinks?: (file: KeepFileItem) => void;
  onAddToCrewLinks?: (file: KeepFileItem) => void;
  onRemoveFromCrewLinks?: (file: KeepFileItem) => void;
  onDeleteFile?: (file: KeepFileItem) => void;
  onDeleteFolder?: (folder: KeepFileItem) => void;
  onSubmitFolderToGold?: (folder: KeepFileItem) => void;
  selectedFileIds?: Set<string>;
  onToggleFileSelection?: (file: KeepFileItem) => void;
  isSuperAdmin?: boolean;
}

// Format file size
function formatSize(bytes: number | null): string {
  if (bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// Format date - compact enterprise style
function formatDate(dateString: string): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Format date with time for tooltip/full display
function formatDateTime(dateString: string): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Get icon component based on mime type
function getIconComponent(mimeType: string): React.FC<{className?: string}> {
  if (mimeType === 'application/vnd.google-apps.folder') return FolderIcon;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheetIcon;
  if (mimeType.includes('image')) return ImageIcon;
  return FileTextIcon;
}

// Get color class based on mime type
function getIconColorClass(mimeType: string): string {
  if (mimeType === 'application/vnd.google-apps.folder') return 'bg-boh-primary-tint text-boh-primary dark:bg-boh-surface dark:text-boh-text';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'bg-boh-success-tint text-boh-success dark:bg-boh-surface dark:text-boh-text';
  if (mimeType.includes('image')) return 'bg-boh-primary-tint text-boh-primary dark:bg-boh-surface dark:text-boh-text';
  if (mimeType.includes('pdf')) return 'bg-boh-primary-tint text-boh-primary dark:bg-boh-surface dark:text-boh-text';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'bg-boh-success-tint text-boh-success dark:bg-boh-surface dark:text-boh-text';
  return 'bg-boh-primary-tint text-boh-primary dark:bg-boh-surface dark:text-boh-text';
}

// Get file type label
function getFileTypeLabel(mimeType: string): string {
  if (mimeType === 'application/vnd.google-apps.folder') return 'Folder';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('image')) return 'Image';
  if (mimeType.includes('video')) return 'Video';
  if (mimeType.includes('audio')) return 'Audio';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Spreadsheet';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'Document';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'Presentation';
  if (mimeType.includes('text')) return 'Text';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'Archive';
  return 'File';
}

function getFolderSubmitLabel(folder: KeepFileItem): string {
  switch (folder.goldLibraryStatus) {
    case 'pending_review':
      return 'In Gold Library Queue';
    case 'approved':
      return 'Update Gold Library';
    case 'rejected':
      return 'Resubmit folder to Gold';
    case 'partial':
      return 'Update Gold Library';
    default:
      return folder.hasGoldLibraryCopy ? 'Update Gold Library' : 'Submit folder to Gold';
  }
}

export default function FileGrid({
  files,
  onFileClick,
  selectedFileId,
  loading,
  area = 'workspace',
  isInMyLinks,
  isInCrewLinks,
  onAddToMyLinks,
  onRemoveFromMyLinks,
  onAddToCrewLinks,
  onRemoveFromCrewLinks,
  onDeleteFile,
  onDeleteFolder,
  onSubmitFolderToGold,
  selectedFileIds,
  onToggleFileSelection,
  isSuperAdmin = false,
}: FileGridProps) {
  const folders = files.filter(f => f.isFolder);
  const regularFiles = files.filter(f => !f.isFolder);
  
  // Track which item has open menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  const toggleMenu = (id: string) => {
    setOpenMenuId(openMenuId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto pb-24">
        <div className="space-y-6">
          {/* Folders skeleton */}
          <div>
            <div className="h-4 w-20 bg-boh-surface-light dark:bg-boh-surface rounded animate-pulse mb-3 mx-4" />
            <div className="space-y-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-11 bg-boh-surface-light dark:bg-boh-surface animate-pulse mx-4"
                />
              ))}
            </div>
          </div>
          {/* Files skeleton */}
          <div>
            <div className="h-4 w-16 bg-boh-surface-light dark:bg-boh-surface rounded animate-pulse mb-3 mx-4" />
            <div className="space-y-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-11 bg-boh-surface-light dark:bg-boh-surface animate-pulse mx-4"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state - no folders and no files
  if (files.length === 0) {
    return (
      <div className="h-full overflow-y-auto pb-24">
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
            No files or folders
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-24">
      {/* Folders Section */}
      {folders.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider mb-3 px-4 pt-4">
            Folders
          </h3>
          <div className="space-y-1">
            {folders.map((folder) => {
              const inMyLinks = isInMyLinks?.(folder.id) ?? false;
              const inCrewLinks = isInCrewLinks?.(folder.id) ?? false;
              const isMenuOpen = openMenuId === folder.id;
              const isSelected = selectedFileId === folder.id;
              const folderSubmitLabel = getFolderSubmitLabel(folder);
              const isFolderPendingGoldReview = folder.goldLibraryStatus === 'pending_review';
              
              return (
                <div
                  key={folder.id}
                  className={`group relative flex items-center px-4 py-2.5 hover:bg-boh-surface-light dark:hover:bg-boh-surface transition-colors ${
                    isSelected ? 'bg-boh-primary/10' : ''
                  }`}
                >
                  <button
                    onClick={() => onFileClick(folder)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <div className="w-8 h-8 rounded bg-boh-primary/10 flex items-center justify-center shrink-0">
                      <FolderIcon className="w-5 h-5 text-boh-primary" />
                    </div>
                    <span className="font-medium text-boh-text-light dark:text-boh-text truncate text-sm">
                      {folder.name}
                    </span>
                    {typeof folder.fileCount === 'number' && (
                      <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        ({folder.fileCount})
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {inMyLinks && (
                      <div className="w-1.5 h-1.5 rounded-full bg-boh-primary" title="In My Links" />
                    )}
                    {inCrewLinks && (
                      <CrownIcon className="w-3.5 h-3.5 text-boh-primary" title="In Crew Links" />
                    )}
                    {folder.goldLibraryStatus === 'pending_review' && (
                      <span className="text-xs font-medium text-boh-primary">
                        In queue
                      </span>
                    )}
                    {folder.goldLibraryStatus === 'approved' && (
                      <span className="text-xs font-medium text-boh-success">
                        In Gold
                      </span>
                    )}
                    {folder.modifiedTime && (
                      <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        {formatDate(folder.modifiedTime)}
                      </span>
                    )}
                  </div>

                  {/* Quick Link Menu */}
                  {(onAddToMyLinks || onAddToCrewLinks || onSubmitFolderToGold || onDeleteFolder) && (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMenu(folder.id);
                        }}
                        className="p-1.5 rounded hover:bg-boh-bg-light dark:hover:bg-boh-bg text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-primary transition-colors"
                        title="Actions"
                      >
                        <MoreVerticalIcon className="w-4 h-4" />
                      </button>
                      
                      {isMenuOpen && (
                        <div className="absolute top-full right-0 mt-1 w-48 bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-lg shadow-lg z-10 py-1">
                          {onAddToMyLinks && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (inMyLinks) {
                                  onRemoveFromMyLinks?.(folder);
                                } else {
                                  onAddToMyLinks(folder);
                                }
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-boh-bg-light dark:hover:bg-boh-bg flex items-center gap-2"
                            >
                              <BookmarkIcon className={`w-4 h-4 ${inMyLinks ? 'fill-boh-primary text-boh-primary' : ''}`} />
                              {inMyLinks ? 'Remove from My Links' : 'Add to My Links'}
                            </button>
                          )}

                          {isSuperAdmin && onAddToCrewLinks && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (inCrewLinks) {
                                  onRemoveFromCrewLinks?.(folder);
                                } else {
                                  onAddToCrewLinks(folder);
                                }
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-boh-bg-light dark:hover:bg-boh-bg flex items-center gap-2"
                            >
                              <UsersIcon className={`w-4 h-4 ${inCrewLinks ? 'text-boh-primary' : ''}`} />
                              {inCrewLinks ? 'Remove from Crew Links' : 'Add to Crew Links'}
                            </button>
                          )}

                          {onDeleteFolder && area === 'workspace' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteFolder(folder);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-600 dark:text-red-400"
                            >
                              <TrashIcon className="w-4 h-4" />
                              Delete folder
                            </button>
                          )}

                          {onSubmitFolderToGold && area === 'workspace' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isFolderPendingGoldReview) return;
                                onSubmitFolderToGold(folder);
                                setOpenMenuId(null);
                              }}
                              disabled={isFolderPendingGoldReview}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-boh-bg-light dark:hover:bg-boh-bg flex items-center gap-2 text-boh-text-light dark:text-boh-text disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <UploadIcon className="w-4 h-4" />
                              {folderSubmitLabel}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Files Section */}
      {regularFiles.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider mb-3 px-4 pt-2">
            Files
          </h3>
          <div className="space-y-1">
            {regularFiles.map((file) => {
              const IconComponent = getIconComponent(file.mimeType);
              const fileColor = getIconColorClass(file.mimeType);
              const isSelected = file.id === selectedFileId;
              const fileInMyLinks = isInMyLinks?.(file.id) ?? false;
              const fileInCrewLinks = isInCrewLinks?.(file.id) ?? false;
              const isMenuOpen = openMenuId === file.id;
              const isChecked = selectedFileIds?.has(file.id) ?? false;

              return (
                <div
                  key={file.id}
                  className={`group relative flex items-center px-4 py-2.5 hover:bg-boh-surface-light dark:hover:bg-boh-surface transition-colors ${
                    isSelected || isChecked ? 'bg-boh-primary/10' : ''
                  }`}
                >
                  {onToggleFileSelection && (
                    <label className="mr-3 flex items-center" title="Select file">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToggleFileSelection(file);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-boh-border-light accent-boh-primary dark:border-boh-border focus:ring-boh-primary"
                      />
                    </label>
                  )}
                  <button
                    onClick={() => onFileClick(file)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <div className={`w-8 h-8 rounded ${fileColor} flex items-center justify-center shrink-0`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <span className="font-medium text-boh-text-light dark:text-boh-text truncate text-sm">
                      {file.name}
                    </span>
                  </button>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {fileInMyLinks && (
                      <div className="w-1.5 h-1.5 rounded-full bg-boh-primary" title="In My Links" />
                    )}
                    {fileInCrewLinks && (
                      <CrownIcon className="w-3.5 h-3.5 text-boh-primary" title="In Crew Links" />
                    )}
                    <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub min-w-[60px] text-right">
                      {formatSize(file.size)}
                    </span>
                    {file.modifiedTime && (
                      <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        {formatDate(file.modifiedTime)}
                      </span>
                    )}
                  </div>

                  {/* Quick Link Menu */}
                  {(onAddToMyLinks || onAddToCrewLinks) && (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMenu(file.id);
                        }}
                        className="p-1.5 rounded hover:bg-boh-bg-light dark:hover:bg-boh-bg text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-primary transition-colors"
                        title="Actions"
                      >
                        <MoreVerticalIcon className="w-4 h-4" />
                      </button>
                      
                      {isMenuOpen && (
                        <div className="absolute top-full right-0 mt-1 w-48 bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-lg shadow-lg z-10 py-1">
                          {onAddToMyLinks && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (fileInMyLinks) {
                                  onRemoveFromMyLinks?.(file);
                                } else {
                                  onAddToMyLinks(file);
                                }
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-boh-bg-light dark:hover:bg-boh-bg flex items-center gap-2 text-boh-text-light dark:text-boh-text"
                            >
                              <BookmarkIcon className={`w-4 h-4 ${fileInMyLinks ? 'fill-boh-primary text-boh-primary' : ''}`} />
                              {fileInMyLinks ? 'Remove from My Links' : 'Add to My Links'}
                            </button>
                          )}
                          
                          {isSuperAdmin && onAddToCrewLinks && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (fileInCrewLinks) {
                                  onRemoveFromCrewLinks?.(file);
                                } else {
                                  onAddToCrewLinks(file);
                                }
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-boh-bg-light dark:hover:bg-boh-bg flex items-center gap-2 text-boh-text-light dark:text-boh-text"
                            >
                              <UsersIcon className={`w-4 h-4 ${fileInCrewLinks ? 'text-boh-primary' : ''}`} />
                              {fileInCrewLinks ? 'Remove from Crew Links' : 'Add to Crew Links'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Delete button for files */}
                  {!file.isFolder && onDeleteFile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFile(file);
                      }}
                      className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-boh-text-sub-light dark:text-boh-text-sub hover:text-red-600 transition-colors"
                      title="Delete file"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Simple empty messages */}
      {folders.length === 0 && regularFiles.length > 0 && (
        <div className="px-4 py-3 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
          No folders
        </div>
      )}
      {regularFiles.length === 0 && folders.length > 0 && (
        <div className="px-4 py-3 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
          No files
        </div>
      )}
    </div>
  );
}
