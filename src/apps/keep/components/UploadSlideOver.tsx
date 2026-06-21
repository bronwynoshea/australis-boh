import React from 'react';
import { XIcon, UploadIcon, FolderIcon } from './Icons';
import UploadDropzone from './UploadDropzone';
import type { UploadFile } from '../types';

interface UploadSlideOverProps {
  isOpen: boolean;
  destinationPath: string;
  uploads: UploadFile[];
  uploading: boolean;
  onFilesSelected: (files: File[]) => void;
  onClearUploads: () => void;
  onClose: () => void;
}

export default function UploadSlideOver({
  isOpen,
  destinationPath,
  uploads,
  uploading,
  onFilesSelected,
  onClearUploads,
  onClose,
}: UploadSlideOverProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        className="absolute inset-0 bg-brand-bg-dark/50 dark:bg-brand-bg-dark/70 backdrop-blur-sm"
        onClick={uploading ? undefined : onClose}
        aria-label="Close upload panel"
      />

      <aside className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface shadow-xl sm:max-w-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-boh-border-light dark:border-boh-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-boh-primary/10 flex items-center justify-center flex-shrink-0">
              <UploadIcon className="w-5 h-5 text-boh-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
                Upload to Workspace
              </h2>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-boh-text-sub-light dark:text-boh-text-sub min-w-0">
                <FolderIcon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{destinationPath || 'Workspace'}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="p-1.5 rounded hover:bg-boh-bg-light dark:hover:bg-boh-bg text-boh-text-sub-light dark:text-boh-text-sub disabled:opacity-50"
            aria-label="Close upload panel"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <UploadDropzone
            onFilesSelected={onFilesSelected}
            uploads={uploads}
            uploading={uploading}
            onClearUploads={onClearUploads}
          />
        </div>
      </aside>
    </div>
  );
}
