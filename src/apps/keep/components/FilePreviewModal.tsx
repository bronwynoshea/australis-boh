import React from 'react';
import { XIcon, DownloadIcon, ExternalLinkIcon } from './Icons';
import type { DriveFile } from '../types';

interface FilePreviewModalProps {
  file: DriveFile | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
}

export default function FilePreviewModal({
  file,
  isOpen,
  onClose,
  onDownload,
}: FilePreviewModalProps) {
  if (!isOpen || !file) return null;

  const isImage = file.mimeType.startsWith('image/');
  const isPdf = file.mimeType === 'application/pdf';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-boh-surface-light dark:bg-boh-surface rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-boh-border-light dark:border-boh-border">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text truncate">
              {file.name}
            </h2>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              {file.mimeType}
            </p>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={onDownload}
              className="p-2 rounded-lg relative group"
              title="Download"
            >
              <DownloadIcon className="w-5 h-5" />
              <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-boh-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg relative group"
              title="Close"
            >
              <XIcon className="w-5 h-5" />
              <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-boh-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-auto max-h-[calc(90vh-80px)]">
          {isImage && (
            <div className="flex items-center justify-center">
              <img
                src={`https://drive.google.com/uc?id=${file.id}`}
                alt={file.name}
                className="max-w-full h-auto rounded-lg"
              />
            </div>
          )}

          {isPdf && (
            <div className="aspect-[8.5/11] w-full">
              <iframe
                src={`https://drive.google.com/file/d/${file.id}/preview`}
                className="w-full h-full rounded-lg border border-boh-border-light dark:border-boh-border"
                title={file.name}
              />
            </div>
          )}

          {!isImage && !isPdf && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ExternalLinkIcon className="w-12 h-12 text-boh-text-sub-light dark:text-boh-text-sub mb-4" />
              <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text mb-2">
                Preview not available
              </h3>
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-4">
                This file type cannot be previewed in the browser
              </p>
              <button
                onClick={onDownload}
                className="px-4 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 transition-colors"
              >
                Download File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
