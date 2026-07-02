import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UploadIcon, SearchIcon, FolderIcon, VaultIcon } from '../components/Icons';
import { useSupabaseFiles } from '../hooks/useSupabaseFiles';
import { useSupabaseUpload } from '../hooks/useSupabaseUpload';
import { useSupabaseFolders } from '../hooks/useSupabaseFolders';
import { useCreateFolder } from '../hooks/useCreateFolder';
import { useFileDownload } from '../hooks/useFileDownload';
import { useFolderAncestors } from '../hooks/useFolderAncestors';
import { useKeepSearch } from '../hooks/useKeepSearch';
import { supabase } from '../../../lib/supabase';
import { useQuickLinks } from '../hooks/useQuickLinks';
import FileGrid from '../components/FileGrid';
import BreadcrumbNav from '../components/BreadcrumbNav';
import FileDetailPanel from '../components/FileDetailPanel';
import CrewLinks from '../components/CrewLinks';
import MyLinks from '../components/MyLinks';
import GoldLibraryGovernancePanel from '../components/GoldLibraryGovernancePanel';
import SubmitWorkspaceFileToGoldModal from '../components/SubmitWorkspaceFileToGoldModal';
import ConfirmDialog from '../components/ConfirmDialog';
import UploadSlideOver from '../components/UploadSlideOver';
import type { KeepFileItem, KeepFolder, BreadcrumbItem, QuickLink } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

interface KeepBrowserPageProps {
  folderId: string | null;
  folderName: string;
  area?: 'workspace' | 'gold_library';
  areaLabel?: string;
}

export default function KeepBrowserPage({
  folderId,
  folderName,
  area = 'workspace',
  areaLabel = area === 'gold_library' ? 'Gold Library' : 'Keep',
}: KeepBrowserPageProps) {
  const navigate = useNavigate();
  const [currentFolder, setCurrentFolder] = useState<KeepFolder | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: 'root', name: areaLabel, folderId: null },
  ]);
  const [selectedFile, setSelectedFile] = useState<KeepFileItem | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [submitToGoldItem, setSubmitToGoldItem] = useState<KeepFileItem | null>(null);
  const [filePendingDelete, setFilePendingDelete] = useState<KeepFileItem | null>(null);
  const [folderPendingDelete, setFolderPendingDelete] = useState<KeepFileItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [pendingQuickLinkFileId, setPendingQuickLinkFileId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Quick links data fetching and management
  const { 
    crewLinks, 
    myLinks, 
    loading: quickLinksLoading, 
    addMyLink, 
    removeMyLink,
    addCrewLink,
    removeCrewLink,
    isInMyLinks,
    isInCrewLinks,
    getMyLinkId,
    getCrewLinkId,
  } = useQuickLinks({ area });

  // TODO: Get isSuperAdmin from auth context
  const isSuperAdmin = false; // Replace with actual auth check

  // Create folder hook
  const { createFolder, isCreating, error: createError, clearError } = useCreateFolder();

  // Load folder ancestors for breadcrumbs
  const { ancestors: folderAncestors, loading: ancestorsLoading } = useFolderAncestors(folderId);

  // Load folders for navigation
  // When at root (folderId = null), find the system folder and show its children
  const isRootLevel = folderId === null;
  // System folder names in database: "Workspace" for workspace, "00-GOLD-LIBRARY" for gold_library
  const systemFolderName = isRootLevel
    ? area === 'gold_library'
      ? '00-GOLD-LIBRARY'
      : 'Workspace'
    : undefined;
  const {
    folders: childFolders,
    loading: foldersLoading,
    error: foldersError,
    refetch: refetchFolders,
  } = useSupabaseFolders({
    area,
    parentId: isRootLevel ? undefined : folderId, // Don't use parentId when finding system folder
    systemFolderName,
  });

  // Load files for current folder (ONLY if a specific folder is selected)
  // At root level, we never show files - only folders and quick links
  const { files, loading: filesLoading, error, refetch } = useSupabaseFiles({
    folderId: folderId || undefined, // Only fetch when folderId is provided
    area: folderId ? area : undefined, // Only pass area when in a folder
  });

  const {
    results: searchResults,
    loading: searchLoading,
    error: searchError,
  } = useKeepSearch({ area, query: searchQuery });

  // Upload hook (only works when inside a specific folder)
  const { uploads, uploading, uploadFiles, clearUploads } = useSupabaseUpload({
    folderId: folderId || undefined,
  });

  const loading = foldersLoading || filesLoading;
  const isSearching = searchQuery.trim().length >= 2;

  // Navigate to a subfolder - updates URL
  const navigateToFolder = (folder: KeepFolder) => {
    const encodedName = encodeURIComponent(folder.name);
    const routePath = area === 'gold_library' ? 'gold-library' : area;
    navigate(`/keep/${routePath}/${folder.id}/${encodedName}`);
  };

  const handleFileClick = (item: KeepFileItem) => {
    if (item.isFolder) {
      // Find the folder in childFolders
      const folder = childFolders.find(f => f.id === item.id);
      if (folder) {
        navigateToFolder(folder);
      } else {
        const encodedName = encodeURIComponent(item.name);
        const routePath = area === 'gold_library' ? 'gold-library' : area;
        navigate(`/keep/${routePath}/${item.id}/${encodedName}`);
      }
    } else {
      // Single click: select file for side panel
      setSelectedFile(item);
    }
  };

  const handleBreadcrumbNavigate = (item: BreadcrumbItem) => {
    const routePath = area === 'gold_library' ? 'gold-library' : area;
    if (!item.folderId) {
      // Navigate to area landing
      navigate(`/keep/${routePath}`);
    } else {
      // Navigate to folder in URL
      const folder = childFolders.find(f => f.id === item.folderId);
      const name = folder?.name || item.name;
      const encodedName = encodeURIComponent(name);
      navigate(`/keep/${routePath}/${item.folderId}/${encodedName}`);
    }
  };

  // Download hook
  const { executeDownload, isDownloading } = useFileDownload({
    onSuccess: () => {
      console.log('Download completed successfully');
    },
    onError: (error) => {
      console.error('Download failed:', error);
      toast.error(error);
    },
  });

  const handleFileDownload = async (file: KeepFileItem) => {
    await executeDownload(file.id, file.name);
  };

  const handleQuickLinkNavigate = async (
    targetId: string,
    type: 'folder' | 'file',
    links: QuickLink[],
  ) => {
    const link = links.find(item => item.targetId === targetId && item.targetType === type);

    if (type === 'folder') {
      const encodedName = encodeURIComponent(link?.label || 'Folder');
      const routePath = area === 'gold_library' ? 'gold-library' : area;
      navigate(`/keep/${routePath}/${targetId}/${encodedName}`);
      return;
    }

    const { data: linkedFile, error: linkedFileError } = await supabase
      .from('keep_file')
      .select('id, folder_id, file_name, file_ext, folder:keep_folder!folder_id(name)')
      .eq('id', targetId)
      .eq('is_active', true)
      .eq('is_current', true)
      .maybeSingle();

    if (linkedFileError || !linkedFile) {
      toast.error('Unable to find linked file');
      return;
    }

    const linkedFolder = linkedFile.folder as { name?: string } | { name?: string }[] | null;
    const folderName = Array.isArray(linkedFolder)
      ? linkedFolder[0]?.name
      : linkedFolder?.name;
    const encodedName = encodeURIComponent(folderName || 'Folder');
    const routePath = area === 'gold_library' ? 'gold-library' : area;
    setPendingQuickLinkFileId(targetId);
    navigate(`/keep/${routePath}/${linkedFile.folder_id}/${encodedName}`);
  };

  const deleteFileRequest = async (file: KeepFileItem) => {
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
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId: file.id }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Delete failed');
    }
  };

  const deleteFolderRequest = async (folder: KeepFileItem) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error('Not authenticated');
    }

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL not configured');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/keep-delete-folder`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ folderId: folder.id }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Delete failed');
    }
  };

  const handleDeleteFile = async (file: KeepFileItem) => {
    setIsDeletingFile(true);
    setDeleteError(null);

    try {
      await deleteFileRequest(file);
      refetch();
      if (selectedFile?.id === file.id) {
        setSelectedFile(null);
      }
      setSelectedFileIds(prev => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
      setFilePendingDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
      setDeleteError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsDeletingFile(false);
    }
  };

  const requestDeleteFile = (file: KeepFileItem) => {
    setDeleteError(null);
    setFilePendingDelete(file);
  };

  const handleConfirmDeleteFile = () => {
    if (!filePendingDelete) return;
    handleDeleteFile(filePendingDelete);
  };

  const handleCancelDeleteFile = () => {
    if (isDeletingFile) return;
    setFilePendingDelete(null);
    setDeleteError(null);
  };

  const requestDeleteFolder = (folder: KeepFileItem) => {
    setDeleteError(null);
    setFolderPendingDelete(folder);
  };

  const handleConfirmDeleteFolder = async () => {
    if (!folderPendingDelete) return;

    setIsDeletingFile(true);
    setDeleteError(null);

    try {
      await deleteFolderRequest(folderPendingDelete);
      refetchFolders();
      refetch();
      if (selectedFile?.folderId === folderPendingDelete.id || selectedFile?.id === folderPendingDelete.id) {
        setSelectedFile(null);
      }
      setFolderPendingDelete(null);
    } catch (err) {
      console.error('Folder delete error:', err);
      setDeleteError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsDeletingFile(false);
    }
  };

  const handleCancelDeleteFolder = () => {
    if (isDeletingFile) return;
    setFolderPendingDelete(null);
    setDeleteError(null);
  };

  const handleToggleFileSelection = (file: KeepFileItem) => {
    if (file.isFolder) return;
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(file.id)) {
        next.delete(file.id);
      } else {
        next.add(file.id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedFileIds(new Set());
    setBulkDeleteOpen(false);
    setDeleteError(null);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedFiles.length === 0) return;

    setIsDeletingFile(true);
    setDeleteError(null);

    try {
      for (const file of selectedFiles) {
        await deleteFileRequest(file);
      }

      refetch();
      if (selectedFile && selectedFileIds.has(selectedFile.id)) {
        setSelectedFile(null);
      }
      clearSelection();
    } catch (err) {
      console.error('Bulk delete error:', err);
      setDeleteError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsDeletingFile(false);
    }
  };

  const handleUpload = async (uploadedFiles: File[]) => {
    await uploadFiles(uploadedFiles);
  };

  const canUpload = folderId !== null && area === 'workspace';
  const canCreateFolder = folderId !== null && area === 'workspace';

  const handleCreateFolder = async () => {
    if (!folderId || !newFolderName.trim()) return;

    const result = await createFolder({
      parentId: folderId,
      name: newFolderName.trim(),
    });

    if (result.folder) {
      setNewFolderName('');
      setShowNewFolder(false);
      clearError();
      // Refresh folders to show the new one
      refetchFolders();
    }
  };

  // Quick link action handlers
  const handleAddToMyLinks = async (item: KeepFileItem) => {
    const targetType = item.isFolder ? 'folder' : 'file';
    const result = await addMyLink({
      label: item.name,
      targetType,
      targetId: item.id,
      sortOrder: myLinks.length,
    });
    if (!result.success && result.error) {
      toast.error(result.error);
    }
  };

  const handleRemoveFromMyLinks = async (item: KeepFileItem) => {
    const linkId = getMyLinkId(item.id);
    if (linkId) {
      await removeMyLink(linkId);
    }
  };

  const handleAddToCrewLinks = async (item: KeepFileItem) => {
    if (!isSuperAdmin) return;
    const targetType = item.isFolder ? 'folder' : 'file';
    const result = await addCrewLink({
      label: item.name,
      targetType,
      targetId: item.id,
      sortOrder: crewLinks.length,
    });
    if (!result.success && result.error) {
      toast.error(result.error);
    }
  };

  const handleRemoveFromCrewLinks = async (item: KeepFileItem) => {
    if (!isSuperAdmin) return;
    const linkId = getCrewLinkId(item.id);
    if (linkId) {
      await removeCrewLink(linkId);
    }
  };
  // Update breadcrumbs when folder changes
  useEffect(() => {
    if (isRootLevel) {
      setBreadcrumbs([{ id: 'root', name: areaLabel, folderId: null }]);
    } else if (folderId) {
      // Build breadcrumbs from ancestor chain
      const breadcrumbItems: BreadcrumbItem[] = [
        { id: 'root', name: areaLabel, folderId: null },
      ];

      // Add all ancestors except the root system folder (Workspace/00-GOLD-LIBRARY)
      // Note: ancestors includes the current folder as the last item
      let skippedRootSystemFolder = false;
      folderAncestors.forEach((ancestor) => {
        // Only skip the first system folder encountered (the root Workspace/00-GOLD-LIBRARY)
        // User-facing folders like Executive should show even if marked as system folders
        if (ancestor.is_system_folder && !skippedRootSystemFolder) {
          skippedRootSystemFolder = true;
          return; // Skip this one
        }
        breadcrumbItems.push({
          id: ancestor.id,
          name: ancestor.name,
          folderId: ancestor.id,
        });
      });

      setBreadcrumbs(breadcrumbItems);
    }
  }, [folderId, folderName, isRootLevel, areaLabel, folderAncestors]);

  // Refresh files after successful upload
  useEffect(() => {
    if (uploads.length > 0 && uploads.every(u => u.status === 'success')) {
      const timer = setTimeout(() => {
        refetch();
        refetchFolders();
        clearUploads();
        setShowUpload(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [uploads, clearUploads, refetch, refetchFolders]);

  useEffect(() => {
    setSelectedFileIds(new Set());
    setBulkDeleteOpen(false);
  }, [folderId, area]);

  useEffect(() => {
    if (!pendingQuickLinkFileId || filesLoading) return;

    const linkedFile = files.find(item => item.id === pendingQuickLinkFileId);
    if (linkedFile) {
      setSelectedFile(linkedFile);
      setPendingQuickLinkFileId(null);
    }
  }, [files, filesLoading, pendingQuickLinkFileId]);

  // At root level, show the live folders returned from keep_folder.
  const topLevelFolders = childFolders;

  // When inside a folder: show subfolders + files for THAT folder only
  const folderItems: KeepFileItem[] = childFolders.map(folder => ({
    id: folder.id,
    name: folder.name,
    mimeType: 'application/vnd.google-apps.folder',
    size: null,
    modifiedTime: '',
    isFolder: true,
    folderId: folder.parent_id || undefined,
    fileCount: folder.file_count,
    hasGoldLibraryCopy: Boolean(folder.has_gold_library_copy),
    goldLibraryStatus: folder.gold_library_status,
  }));

  // Only combine folders and files when inside a specific folder
  const folderViewItems = isRootLevel 
    ? [] // No files at root level
    : [...folderItems, ...files];
  
  const filteredItems = isSearching
    ? searchResults
    : searchQuery
    ? folderViewItems.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : folderViewItems;

  const destinationPath = breadcrumbs
    .filter(item => item.id !== 'root')
    .map(item => item.name)
    .join(' / ');
  const selectedFiles = filteredItems.filter(item => !item.isFolder && selectedFileIds.has(item.id));
  const selectedFileCount = selectedFiles.length;

  // Clear selected file when folder changes or file is no longer in current folder
  useEffect(() => {
    if (selectedFile) {
      // Check if selected file still exists in current folder view
      const currentFile = filteredItems.find(item => item.id === selectedFile.id);
      if (!currentFile) {
        setSelectedFile(null);
      } else if (currentFile !== selectedFile) {
        setSelectedFile(currentFile);
      }
    }
  }, [folderId, filteredItems, selectedFile]);

  return (
    <div className="flex flex-col h-full">
      {/* Header - Matching other BOH apps style */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 border-b border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {area === 'gold_library' && (
                <div className="p-2 rounded-lg bg-boh-primary/10">
                  <VaultIcon className="w-6 h-6 text-boh-primary" />
                </div>
              )}
              <div>
                <div className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wide mb-1">
                  Keep
                </div>
                <h2 className="text-2xl font-bold text-boh-text-light dark:text-boh-text mb-1">
                  {folderName}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {area === 'gold_library' && (
                <button
                  onClick={() => navigate('/keep/review-queue')}
                  className="flex items-center gap-2 px-4 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text rounded-lg hover:bg-boh-border-light dark:hover:bg-boh-border transition-colors"
                >
                  <VaultIcon className="w-4 h-4" />
                  <span>Review Queue</span>
                </button>
              )}
              {canCreateFolder && (
                <button
                  onClick={() => setShowNewFolder(!showNewFolder)}
                  className="flex items-center gap-2 px-4 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text rounded-lg hover:bg-boh-border-light dark:hover:bg-boh-border transition-colors"
                >
                  <FolderIcon className="w-4 h-4" />
                  <span>New Folder</span>
                </button>
              )}
              {canUpload && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 transition-colors"
                >
                  <UploadIcon className="w-4 h-4" />
                  <span>Upload</span>
                </button>
              )}
            </div>
          </div>

          {/* New Folder Input */}
          {showNewFolder && canCreateFolder && (
            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                placeholder="Folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') {
                    setShowNewFolder(false);
                    setNewFolderName('');
                    clearError();
                  }
                }}
                disabled={isCreating}
                className="flex-1 max-w-xs px-3 py-2 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text placeholder-boh-text-sub-light dark:placeholder-boh-text-sub focus:outline-none focus:ring-2 focus:ring-boh-primary"
              />
              <button
                onClick={handleCreateFolder}
                disabled={isCreating || !newFolderName.trim()}
                className="px-3 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowNewFolder(false);
                  setNewFolderName('');
                  clearError();
                }}
                disabled={isCreating}
                className="px-3 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-sub-light dark:text-boh-text-sub rounded-lg hover:bg-boh-border-light dark:hover:bg-boh-border transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Create Folder Error */}
          {createError && showNewFolder && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
            </div>
          )}
        </header>

        {/* Breadcrumbs and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <BreadcrumbNav items={breadcrumbs} onNavigate={handleBreadcrumbNavigate} />
          </div>
          <div className="relative w-full sm:w-72">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-boh-text-sub-light dark:text-boh-text-sub" />
            <input
              type="text"
              placeholder={`Search ${areaLabel}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text placeholder-boh-text-sub-light dark:placeholder-boh-text-sub focus:outline-none focus:ring-2 focus:ring-boh-primary"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isSearching ? (
          <div className="max-w-5xl">
            <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-boh-border-light dark:border-boh-border">
                <h3 className="font-semibold text-boh-text-light dark:text-boh-text">Search Results</h3>
                <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                  {searchLoading ? 'Searching...' : `${filteredItems.length} result${filteredItems.length === 1 ? '' : 's'}`}
                </span>
              </div>
              {searchError && (
                <div className="m-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{searchError}</p>
                </div>
              )}
              {selectedFileCount > 0 && area === 'workspace' && (
                <div className="mx-4 mt-4 flex flex-col gap-3 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                    {selectedFileCount} file{selectedFileCount === 1 ? '' : 's'} selected
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={clearSelection}
                      disabled={isDeletingFile}
                      className="px-3 py-2 text-sm rounded-lg border border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text bg-boh-surface-light dark:bg-boh-surface hover:bg-boh-bg-light dark:hover:bg-boh-bg disabled:opacity-50"
                    >
                      Clear selection
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setBulkDeleteOpen(true);
                      }}
                      disabled={isDeletingFile}
                      className="px-3 py-2 text-sm rounded-lg bg-boh-primary text-white hover:bg-boh-primary/90 disabled:opacity-50"
                    >
                      Delete selected
                    </button>
                  </div>
                </div>
              )}
              <div className="h-[calc(100vh-280px)]">
                <FileGrid
                  files={filteredItems}
                  onFileClick={handleFileClick}
                  selectedFileId={selectedFile?.id}
                  loading={searchLoading}
                  area={area}
                  isInMyLinks={isInMyLinks}
                  isInCrewLinks={isInCrewLinks}
                  onAddToMyLinks={handleAddToMyLinks}
                  onRemoveFromMyLinks={handleRemoveFromMyLinks}
                  onAddToCrewLinks={isSuperAdmin ? handleAddToCrewLinks : undefined}
                  onRemoveFromCrewLinks={isSuperAdmin ? handleRemoveFromCrewLinks : undefined}
                  onDeleteFile={area === 'workspace' ? requestDeleteFile : undefined}
                  onDeleteFolder={area === 'workspace' ? requestDeleteFolder : undefined}
                  onSubmitFolderToGold={area === 'workspace' ? setSubmitToGoldItem : undefined}
                  selectedFileIds={area === 'workspace' ? selectedFileIds : undefined}
                  onToggleFileSelection={area === 'workspace' ? handleToggleFileSelection : undefined}
                  isSuperAdmin={isSuperAdmin}
                />
              </div>
            </div>
          </div>
        ) : isRootLevel ? (
          /* ROOT LEVEL: Different layouts for Workspace vs Gold Library */
          area === 'gold_library' ? (
            /* GOLD LIBRARY ROOT: 2-column layout with folders + governance panel */
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-6 max-w-7xl">
              {/* Left Column: Category Folders (40% width) */}
              <div className="min-w-0">
                <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-4">
                  <h3 className="text-sm font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider mb-3">
                    Categories
                  </h3>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2">
                    {foldersLoading ? (
                      Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="h-16 rounded-lg bg-boh-bg-light dark:bg-boh-bg animate-pulse" />
                      ))
                    ) : foldersError ? (
                      <div className="col-span-2 py-12 text-center">
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">
                          {foldersError}
                        </p>
                      </div>
                    ) : topLevelFolders.length === 0 ? (
                      <div className="col-span-2 py-12 text-center">
                        <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                          No categories available
                        </p>
                      </div>
                    ) : (
                      topLevelFolders.map((folder) => (
                        <button
                          key={folder.id}
                          onClick={() => navigateToFolder(folder)}
                          className="flex min-h-14 items-center gap-2 p-2.5 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg hover:border-boh-primary/50 hover:shadow-sm transition-all text-left"
                        >
                          <div className="p-1.5 rounded bg-boh-primary/10 text-boh-primary flex-shrink-0">
                            <FolderIcon className="w-4 h-4" />
                          </div>
                          <span className="min-w-0 break-words [overflow-wrap:anywhere] font-medium text-xs text-boh-text-light dark:text-boh-text leading-tight">
                            {folder.name}
                            {typeof folder.file_count === 'number' && (
                              <span className="ml-1 text-boh-text-sub-light dark:text-boh-text-sub">
                                ({folder.file_count})
                              </span>
                            )}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Governance Panel (60% width) */}
              <div className="min-w-0">
                <GoldLibraryGovernancePanel
                  folders={topLevelFolders}
                  onSubmitSuccess={() => {
                    refetch();
                    refetchFolders();
                  }}
                />
              </div>
            </div>
          ) : (
            /* WORKSPACE ROOT: 3-column layout with Crew Links + My Links */
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-8 max-w-6xl">
              {/* Column 1: Folders */}
              <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-5 h-[calc(100vh-240px)] flex flex-col">
                <h3 className="text-sm font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider mb-4">
                  Folders
                </h3>
                <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                  {foldersLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 rounded-lg bg-boh-surface-light dark:bg-boh-surface animate-pulse" />
                      ))}
                    </div>
                  ) : foldersError ? (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {foldersError}
                    </p>
                  ) : topLevelFolders.length === 0 ? (
                    <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                      No folders available
                    </p>
                  ) : (
                    topLevelFolders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => navigateToFolder(folder)}
                        className="w-full min-h-14 flex items-center gap-3 p-3 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface hover:border-boh-primary/50 hover:shadow-sm transition-all text-left"
                      >
                        <div className="p-2 rounded bg-boh-primary/10 text-boh-primary">
                          <FolderIcon className="w-5 h-5" />
                        </div>
                        <span className="min-w-0 break-words [overflow-wrap:anywhere] font-medium text-boh-text-light dark:text-boh-text">
                          {folder.name}
                          {typeof folder.file_count === 'number' && (
                            <span className="ml-1 text-sm font-normal text-boh-text-sub-light dark:text-boh-text-sub">
                              ({folder.file_count})
                            </span>
                          )}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Column 2: Crew Links */}
              <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-5 h-[calc(100vh-240px)] flex flex-col">
                <CrewLinks
                  links={crewLinks}
                  onNavigate={(targetId, type) => handleQuickLinkNavigate(targetId, type, crewLinks)}
                  loading={quickLinksLoading}
                />
              </div>

              {/* Column 3: My Links */}
              <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-5 h-[calc(100vh-240px)] flex flex-col relative">
                <MyLinks
                  links={myLinks}
                  onNavigate={(targetId, type) => handleQuickLinkNavigate(targetId, type, myLinks)}
                  onRemoveLink={removeMyLink}
                  loading={quickLinksLoading}
                />
              </div>
            </div>
          )
        ) : (
          /* FOLDER VIEW: True 50/50 workspace split */
          <div className="flex flex-1 gap-4 p-4 overflow-hidden">
            {/* Left side: File list card */}
            <div className="w-1/2 flex flex-col bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border overflow-hidden">
              {/* File list header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-boh-border-light dark:border-boh-border flex-shrink-0">
                <h3 className="font-semibold text-boh-text-light dark:text-boh-text">Files</h3>
                <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                  {(() => {
                    const fileCount = filteredItems.filter(f => !f.isFolder).length;
                    const folderCount = filteredItems.filter(f => f.isFolder).length;
                    const parts = [];
                    if (fileCount > 0) parts.push(`${fileCount} File${fileCount !== 1 ? 's' : ''}`);
                    if (folderCount > 0) parts.push(`${folderCount} Folder${folderCount !== 1 ? 's' : ''}`);
                    return parts.length > 0 ? parts.join(' • ') : 'Empty';
                  })()}
                </span>
              </div>

              {selectedFileCount > 0 && area === 'workspace' && (
                <div className="mx-4 mt-4 flex flex-col gap-3 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg px-3 py-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
                  <p className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                    {selectedFileCount} file{selectedFileCount === 1 ? '' : 's'} selected
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={clearSelection}
                      disabled={isDeletingFile}
                      className="px-3 py-2 text-sm rounded-lg border border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text bg-boh-surface-light dark:bg-boh-surface hover:bg-boh-bg-light dark:hover:bg-boh-bg disabled:opacity-50"
                    >
                      Clear selection
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setBulkDeleteOpen(true);
                      }}
                      disabled={isDeletingFile}
                      className="px-3 py-2 text-sm rounded-lg bg-boh-primary text-white hover:bg-boh-primary/90 disabled:opacity-50"
                    >
                      Delete selected
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex-shrink-0">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* File list - internal scroll */}
              <div className="flex-1 overflow-y-auto">
                <FileGrid
                  files={filteredItems}
                  onFileClick={handleFileClick}
                  selectedFileId={selectedFile?.id}
                  loading={loading}
                  area={area}
                  isInMyLinks={area === 'workspace' ? isInMyLinks : () => false}
                  isInCrewLinks={area === 'workspace' ? isInCrewLinks : () => false}
                  onAddToMyLinks={area === 'workspace' ? handleAddToMyLinks : undefined}
                  onRemoveFromMyLinks={area === 'workspace' ? handleRemoveFromMyLinks : undefined}
                  onAddToCrewLinks={area === 'workspace' ? handleAddToCrewLinks : undefined}
                  onRemoveFromCrewLinks={area === 'workspace' ? handleRemoveFromCrewLinks : undefined}
                  onDeleteFile={area === 'workspace' ? requestDeleteFile : undefined}
                  onDeleteFolder={area === 'workspace' ? requestDeleteFolder : undefined}
                  onSubmitFolderToGold={area === 'workspace' ? setSubmitToGoldItem : undefined}
                  selectedFileIds={area === 'workspace' ? selectedFileIds : undefined}
                  onToggleFileSelection={area === 'workspace' ? handleToggleFileSelection : undefined}
                  isSuperAdmin={isSuperAdmin}
                />
              </div>
            </div>

            {/* Right side: Details panel */}
            <div className="w-1/2 flex flex-col bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border overflow-hidden">
              {selectedFile && !selectedFile.isFolder ? (
                <FileDetailPanel
                  file={selectedFile}
                  onClose={() => setSelectedFile(null)}
                  area={area}
                  isInMyLinks={area === 'workspace' ? isInMyLinks(selectedFile.id) : false}
                  isInCrewLinks={area === 'workspace' ? isInCrewLinks(selectedFile.id) : false}
                  onAddToMyLinks={area === 'workspace' ? () => handleAddToMyLinks(selectedFile) : undefined}
                  onRemoveFromMyLinks={area === 'workspace' ? () => handleRemoveFromMyLinks(selectedFile) : undefined}
                  onAddToCrewLinks={area === 'workspace' ? () => handleAddToCrewLinks(selectedFile) : undefined}
                  onRemoveFromCrewLinks={area === 'workspace' ? () => handleRemoveFromCrewLinks(selectedFile) : undefined}
                  isSuperAdmin={isSuperAdmin}
                  onDownload={() => handleFileDownload(selectedFile)}
                  onDeleteFile={area === 'workspace' ? () => requestDeleteFile(selectedFile) : undefined}
                  onSubmitToGold={area === 'workspace' && !selectedFile.isFolder ? () => setSubmitToGoldItem(selectedFile) : undefined}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 rounded-2xl bg-boh-bg-light dark:bg-boh-bg flex items-center justify-center mb-4">
                    <FolderIcon className="w-8 h-8 text-boh-text-sub-light dark:text-boh-text-sub" />
                  </div>
                  <p className="text-boh-text-sub-light dark:text-boh-text-sub">
                    Select a file to view details
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <SubmitWorkspaceFileToGoldModal
        file={submitToGoldItem}
        isOpen={!!submitToGoldItem}
        onClose={() => setSubmitToGoldItem(null)}
        onSuccess={() => {
          setSubmitToGoldItem(null);
          refetch();
          refetchFolders();
        }}
      />

      <UploadSlideOver
        isOpen={showUpload}
        destinationPath={destinationPath || folderName}
        uploads={uploads}
        uploading={uploading}
        onFilesSelected={handleUpload}
        onClearUploads={clearUploads}
        onClose={() => setShowUpload(false)}
      />

      <ConfirmDialog
        isOpen={!!filePendingDelete}
        title="Delete file?"
        body={
          <>
            This will permanently delete{' '}
            <span className="font-semibold text-boh-text-light dark:text-boh-text">
              {filePendingDelete?.name}
            </span>
            . This cannot be undone.
            {deleteError && (
              <span className="block mt-3 text-red-600 dark:text-red-400">
                {deleteError}
              </span>
            )}
          </>
        }
        confirmLabel="Delete file"
        confirmingLabel="Deleting..."
        isConfirming={isDeletingFile}
        onCancel={handleCancelDeleteFile}
        onConfirm={handleConfirmDeleteFile}
      />

      <ConfirmDialog
        isOpen={bulkDeleteOpen}
        title="Delete selected files?"
        body={
          <>
            This will permanently delete {selectedFileCount} selected file{selectedFileCount === 1 ? '' : 's'}.
            This cannot be undone.
            {deleteError && (
              <span className="block mt-3 text-red-600 dark:text-red-400">
                {deleteError}
              </span>
            )}
          </>
        }
        confirmLabel="Delete selected"
        confirmingLabel="Deleting..."
        isConfirming={isDeletingFile}
        onCancel={() => {
          if (!isDeletingFile) {
            setBulkDeleteOpen(false);
            setDeleteError(null);
          }
        }}
        onConfirm={handleConfirmBulkDelete}
      />

      <ConfirmDialog
        isOpen={!!folderPendingDelete}
        title="Delete folder?"
        body={
          <>
            This will delete{' '}
            <span className="font-semibold text-boh-text-light dark:text-boh-text">
              {folderPendingDelete?.name}
            </span>
            {' '}and any files and folders inside it from Workspace. This cannot be undone.
            {deleteError && (
              <span className="block mt-3 text-red-600 dark:text-red-400">
                {deleteError}
              </span>
            )}
          </>
        }
        confirmLabel="Delete folder"
        confirmingLabel="Deleting..."
        isConfirming={isDeletingFile}
        onCancel={handleCancelDeleteFolder}
        onConfirm={handleConfirmDeleteFolder}
      />
    </div>
  );
}
