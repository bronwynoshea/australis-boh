import React, { useEffect, useState } from 'react';
import { XIcon, UploadIcon } from './Icons';
import { supabase } from '../../../lib/supabase';
import FolderTreePicker from './FolderTreePicker';
import type { KeepFileItem, KeepFolder } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

interface SubmitWorkspaceFileToGoldModalProps {
  file: KeepFileItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SubmitWorkspaceFileToGoldModal({
  file,
  isOpen,
  onClose,
  onSuccess,
}: SubmitWorkspaceFileToGoldModalProps) {
  const [folders, setFolders] = useState<KeepFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState('');
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchFolders = async () => {
      setLoadingFolders(true);
      setError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(
          `${supabaseUrl}/functions/v1/keep-folders?area=gold_library&include_all=true`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Failed to load Gold Library folders');
        }

        setFolders(data.folders || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Gold Library folders');
      } finally {
        setLoadingFolders(false);
      }
    };

    fetchFolders();
  }, [isOpen]);

  const handleClose = () => {
    if (submitting) return;
    setSelectedFolderId(null);
    setSelectedFolderPath('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!file || !selectedFolderId) return;

    const isFolderSubmit = file.isFolder;
    setSubmitting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${supabaseUrl}/functions/v1/keep-submit-to-gold`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [isFolderSubmit ? 'folderId' : 'fileId']: file.id,
          destinationFolderId: selectedFolderId,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Failed to submit ${isFolderSubmit ? 'folder' : 'file'} to Gold Library`);
      }

      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to submit ${file.isFolder ? 'folder' : 'file'} to Gold Library`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !file) return null;
  const isFolderSubmit = file.isFolder;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-boh-border-light dark:border-boh-border">
          <div>
            <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
              {isFolderSubmit ? 'Submit folder to Gold Library' : 'Submit to Gold Library'}
            </h2>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub truncate">
              {file.name}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-1.5 rounded hover:bg-boh-bg-light dark:hover:bg-boh-bg text-boh-text-sub-light dark:text-boh-text-sub"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
              Gold Library Destination
            </label>
            <div className="h-80">
              {loadingFolders ? (
                <div className="h-full flex items-center justify-center border border-boh-border-light dark:border-boh-border rounded-lg">
                  <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Loading folders...</p>
                </div>
              ) : (
                <FolderTreePicker
                  folders={folders}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={(folderId, folderPath) => {
                    setSelectedFolderId(folderId);
                    setSelectedFolderPath(folderPath);
                    setError(null);
                  }}
                />
              )}
            </div>
          </div>

          {selectedFolderPath && (
            <div className="p-3 bg-boh-bg-light dark:bg-boh-bg rounded-lg border border-boh-border-light dark:border-boh-border">
              <p className="text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1">Destination</p>
              <p className="text-sm text-boh-text-light dark:text-boh-text font-medium">
                Gold Library / {selectedFolderPath}
              </p>
              {isFolderSubmit && (
                <p className="mt-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                  The folder and its active files will be copied here for review.
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-boh-border-light dark:border-boh-border">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg border border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedFolderId}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UploadIcon className="w-4 h-4" />
            {submitting ? 'Submitting...' : isFolderSubmit ? 'Submit Folder for Review' : 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
