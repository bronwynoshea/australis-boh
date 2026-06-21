import React, { useState, useEffect, useRef } from 'react';
import { XIcon, UploadIcon, CheckIcon } from './Icons';
import { supabase } from '../../../lib/supabase';
import FolderTreePicker from './FolderTreePicker';
import type { KeepFolder } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

function getFileRelativePath(file: File): string | null {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (!relativePath) return null;

  const normalized = relativePath.replace(/\\/g, '/');
  const segments = normalized
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean);

  if (
    segments.length === 0 ||
    normalized.startsWith('/') ||
    normalized.includes('://') ||
    segments.some(segment => segment === '.' || segment === '..')
  ) {
    return null;
  }

  return segments.join('/');
}

interface SubmitToGoldLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: KeepFolder[];
  onSuccess: () => void;
}

export default function SubmitToGoldLibraryModal({
  isOpen,
  onClose,
  folders,
  onSuccess,
}: SubmitToGoldLibraryModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>('');
  const [allFolders, setAllFolders] = useState<KeepFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAllFolders();
    }
  }, [isOpen]);

  useEffect(() => {
    const folderInput = folderInputRef.current;
    if (!folderInput) return;

    folderInput.setAttribute('webkitdirectory', '');
    folderInput.setAttribute('directory', '');
  }, []);

  const fetchAllFolders = async () => {
    setLoadingFolders(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token || !supabaseUrl) {
        return;
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/keep-folders?area=gold_library&include_all=true`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAllFolders(data.folders || []);
      }
    } catch (err) {
      console.error('Failed to fetch folders:', err);
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleFolderSelect = (folderId: string, folderPath: string) => {
    setSelectedFolderId(folderId);
    setSelectedFolderPath(folderPath);
    setError(null);
  };

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      setSelectedFiles(files);
      setError(null);
    }
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0 || !selectedFolderId) {
      setError('Please select files or a folder and a destination category');
      return;
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

      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder_id', selectedFolderId);

        const relativePath = getFileRelativePath(file);
        if (relativePath) {
          formData.append('relative_path', relativePath);
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/keep-upload-file`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Upload failed: ${response.status}`);
        }

        const data = await response.json();

        if (!data?.success) {
          throw new Error(data?.error || 'Upload failed');
        }
      }

      setSelectedFiles([]);
      setSelectedFolderId('');
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit file';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedFiles([]);
      setSelectedFolderId(null);
      setSelectedFolderPath('');
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl min-h-[500px] bg-boh-surface-light dark:bg-boh-surface rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-boh-border-light dark:border-boh-border">
          <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
            Submit to Gold Library
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 rounded-lg hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors disabled:opacity-50"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content - 2 column layout */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column: Folder Tree */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text">
                Select Destination Folder
              </label>
              <div className="h-80">
                {loadingFolders ? (
                  <div className="h-full flex items-center justify-center border border-boh-border-light dark:border-boh-border rounded-lg">
                    <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Loading folders...</p>
                  </div>
                ) : (
                  <FolderTreePicker
                    folders={allFolders}
                    selectedFolderId={selectedFolderId}
                    onSelectFolder={handleFolderSelect}
                  />
                )}
              </div>
            </div>

            {/* Right Column: File Upload & Summary */}
            <div className="space-y-4">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                  Select File
                </label>
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    disabled={isSubmitting}
                    className="block w-full text-sm text-boh-text-sub-light dark:text-boh-text-sub
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-medium
                      file:bg-boh-primary file:text-white
                      hover:file:bg-boh-primary/90
                      file:cursor-pointer
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    disabled={isSubmitting}
                    className="hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="mt-2 px-3 py-2 text-sm font-medium rounded-lg border border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg disabled:opacity-50"
                >
                  Select folder
                </button>
                {selectedFiles.length > 0 && (
                  <div className="mt-3 space-y-2 text-sm text-boh-text-light dark:text-boh-text">
                    <div className="flex items-center gap-2">
                      <CheckIcon className="w-4 h-4 text-green-600" />
                      <span>{selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} selected</span>
                    </div>
                    <div className="max-h-28 overflow-y-auto rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg p-2 space-y-1">
                      {selectedFiles.slice(0, 20).map((file, index) => (
                        <div key={`${file.name}-${index}`} className="truncate text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                          {getFileRelativePath(file) || file.name}
                        </div>
                      ))}
                      {selectedFiles.length > 20 && (
                        <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                          +{selectedFiles.length - 20} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Folder Path */}
              {selectedFolderPath && (
                <div className="p-3 bg-boh-bg-light dark:bg-boh-bg rounded-lg border border-boh-border-light dark:border-boh-border">
                  <p className="text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1">
                    Destination
                  </p>
                  <p className="text-sm text-boh-text-light dark:text-boh-text font-medium">
                    Gold Library / {selectedFolderPath}
                  </p>
                </div>
              )}

              {/* Info Message */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Files will enter the Gold Library review workflow before becoming available.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-boh-border-light dark:border-boh-border">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text rounded-lg hover:bg-boh-border-light dark:hover:bg-boh-border transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedFiles.length === 0 || !selectedFolderId}
            className="flex items-center gap-2 px-4 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UploadIcon className="w-4 h-4" />
            <span>{isSubmitting ? 'Submitting...' : 'Submit to Gold Library'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
