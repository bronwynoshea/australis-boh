import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UploadIcon, XIcon, CheckCircleIcon, AlertCircleIcon, FolderIcon, FileTextIcon } from './Icons';
import type { UploadFile } from '../types';

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  uploads: UploadFile[];
  uploading: boolean;
  onClearUploads: () => void;
}

type FileWithPath = File & { webkitRelativePath?: string };

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
}

interface FileSystemFileEntryLike extends FileSystemEntryLike {
  file: (successCallback: (file: File) => void, errorCallback?: (error: DOMException) => void) => void;
}

interface FileSystemDirectoryReaderLike {
  readEntries: (
    successCallback: (entries: FileSystemEntryLike[]) => void,
    errorCallback?: (error: DOMException) => void,
  ) => void;
}

interface FileSystemDirectoryEntryLike extends FileSystemEntryLike {
  createReader: () => FileSystemDirectoryReaderLike;
}

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntryLike | null;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const normalizeRelativePath = (path: string): string => path.replace(/\\/g, '/').replace(/^\/+/, '');

const withRelativePath = (file: File, relativePath: string): File => {
  const normalizedPath = normalizeRelativePath(relativePath);
  if (!normalizedPath || normalizedPath === file.name) return file;

  try {
    Object.defineProperty(file, 'webkitRelativePath', {
      configurable: true,
      value: normalizedPath,
    });
  } catch {
    // Some browser File objects may not allow redefining this property.
  }

  return file;
};

const readFileEntry = (entry: FileSystemFileEntryLike, relativePath: string): Promise<File> => (
  new Promise((resolve, reject) => {
    entry.file(
      (file) => resolve(withRelativePath(file, relativePath || entry.name)),
      reject,
    );
  })
);

const readDirectoryEntries = (reader: FileSystemDirectoryReaderLike): Promise<FileSystemEntryLike[]> => (
  new Promise((resolve, reject) => {
    const entries: FileSystemEntryLike[] = [];

    const readBatch = () => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) {
            resolve(entries);
            return;
          }

          entries.push(...batch);
          readBatch();
        },
        reject,
      );
    };

    readBatch();
  })
);

const readEntryFiles = async (entry: FileSystemEntryLike, parentPath = ''): Promise<File[]> => {
  const relativePath = normalizeRelativePath(parentPath ? `${parentPath}/${entry.name}` : entry.name);

  if (entry.isFile) {
    return [await readFileEntry(entry as FileSystemFileEntryLike, relativePath)];
  }

  if (entry.isDirectory) {
    const directory = entry as FileSystemDirectoryEntryLike;
    const entries = await readDirectoryEntries(directory.createReader());
    const nestedFiles = await Promise.all(entries.map(child => readEntryFiles(child, relativePath)));
    return nestedFiles.flat();
  }

  return [];
};

const getDisplayPath = (file: File): string => (
  (file as FileWithPath).webkitRelativePath || file.name
);

const getSelectionSummary = (files: File[]) => {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const paths = files.map(getDisplayPath);
  const topSegments = new Set(
    paths
      .filter(path => path.includes('/'))
      .map(path => path.split('/')[0])
      .filter(Boolean),
  );

  return {
    totalSize,
    topLevelName: topSegments.size === 1 ? Array.from(topSegments)[0] : null,
  };
};

export default function UploadDropzone({
  onFilesSelected,
  uploads,
  uploading,
  onClearUploads,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dropError, setDropError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const folderInput = folderInputRef.current;
    if (!folderInput) return;

    folderInput.setAttribute('webkitdirectory', '');
    folderInput.setAttribute('directory', '');
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setDropError(null);

    try {
      const items = Array.from(e.dataTransfer.items || []) as DataTransferItemWithEntry[];
      const entryFiles = items.length > 0
        ? (await Promise.all(
            items.map(async (item) => {
              const entry = item.webkitGetAsEntry?.();
              if (!entry) {
                const fallbackFile = item.kind === 'file' ? item.getAsFile() : null;
                return fallbackFile ? [fallbackFile] : [];
              }
              return readEntryFiles(entry);
            }),
          )).flat()
        : [];

      const files = entryFiles.length > 0
        ? entryFiles
        : Array.from(e.dataTransfer.files || []) as File[];

      if (files.length > 0) {
        setPendingFiles(files);
      }
    } catch (error) {
      console.error('[UploadDropzone] Failed to read dropped files', error);
      setDropError('Unable to read that drop. Please choose files or choose folder instead.');
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      setDropError(null);
      setPendingFiles(files);
    }
    e.target.value = '';
  }, [onFilesSelected]);

  const handleUploadSelection = useCallback(() => {
    if (pendingFiles.length === 0) return;
    onFilesSelected(pendingFiles);
    setPendingFiles([]);
  }, [onFilesSelected, pendingFiles]);

  const handleClearSelection = useCallback(() => {
    setPendingFiles([]);
    setDropError(null);
  }, []);

  const hasUploads = uploads.length > 0;
  const hasPendingFiles = pendingFiles.length > 0;
  const pendingSummary = getSelectionSummary(pendingFiles);
  const previewFiles = pendingFiles.slice(0, 8);

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative overflow-hidden border-2 border-dashed rounded-lg p-8 text-center
          transition-all duration-200 bg-boh-bg-light dark:bg-boh-bg
          ${isDragging
            ? 'border-boh-primary bg-boh-primary/10 shadow-lg shadow-boh-primary/10'
            : 'border-boh-primary/40 hover:border-boh-primary hover:bg-boh-primary/5'
          }
        `}
      >
        <input ref={fileInputRef} type="file" multiple onChange={handleFileInput} className="hidden" disabled={uploading} />
        <input ref={folderInputRef} type="file" multiple onChange={handleFileInput} className="hidden" disabled={uploading} />

        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-boh-primary/30" />

        <div className="relative">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-boh-primary/10 flex items-center justify-center">
            <UploadIcon className="w-8 h-8 text-boh-primary" />
          </div>
          
          <h3 className="text-xl font-semibold text-boh-text-light dark:text-boh-text mb-2">
            {isDragging ? 'Release to add files' : 'Drop files or folders here'}
          </h3>
          
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
            or choose files / choose folder
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg disabled:opacity-50"
            >
              Choose files
            </button>
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg disabled:opacity-50"
            >
              Choose folder
            </button>
          </div>
        </div>
      </div>

      {dropError && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
          {dropError}
        </div>
      )}

      {hasPendingFiles && (
        <div className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-boh-primary/10 flex items-center justify-center flex-shrink-0">
                {pendingSummary.topLevelName ? (
                  <FolderIcon className="w-5 h-5 text-boh-primary" />
                ) : (
                  <FileTextIcon className="w-5 h-5 text-boh-primary" />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-boh-text-light dark:text-boh-text break-words">
                  {pendingSummary.topLevelName || `${pendingFiles.length} selected file${pendingFiles.length === 1 ? '' : 's'}`}
                </h4>
                <p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                  {pendingFiles.length} file{pendingFiles.length === 1 ? '' : 's'} • {formatFileSize(pendingSummary.totalSize)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearSelection}
              disabled={uploading}
              className="p-1.5 rounded hover:bg-boh-bg-light dark:hover:bg-boh-bg text-boh-text-sub-light dark:text-boh-text-sub disabled:opacity-50"
              aria-label="Clear selected files"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto rounded border border-boh-border-light dark:border-boh-border divide-y divide-boh-border-light dark:divide-boh-border">
            {previewFiles.map((file, index) => (
              <div key={`${getDisplayPath(file)}-${index}`} className="flex items-center gap-3 px-3 py-2 bg-boh-bg-light dark:bg-boh-bg">
                <FileTextIcon className="w-4 h-4 flex-shrink-0 text-boh-text-sub-light dark:text-boh-text-sub" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-boh-text-light dark:text-boh-text truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub truncate">
                    {getDisplayPath(file)}
                  </p>
                </div>
                <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub flex-shrink-0">
                  {formatFileSize(file.size)}
                </span>
              </div>
            ))}
            {pendingFiles.length > previewFiles.length && (
              <div className="px-3 py-2 text-xs text-boh-text-sub-light dark:text-boh-text-sub bg-boh-bg-light dark:bg-boh-bg">
                + {pendingFiles.length - previewFiles.length} more file{pendingFiles.length - previewFiles.length === 1 ? '' : 's'}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClearSelection}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg disabled:opacity-50"
            >
              Clear selection
            </button>
            <button
              type="button"
              onClick={handleUploadSelection}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-boh-primary text-white hover:bg-boh-primary/90 disabled:opacity-50"
            >
              Upload selection
            </button>
          </div>
        </div>
      )}

      {hasUploads && (
        <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm text-boh-text-light dark:text-boh-text">
              Uploads ({uploads.length})
            </h4>
            <button
              onClick={onClearUploads}
              className="text-xs text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-boh-text"
              disabled={uploading}
            >
              Clear
            </button>
          </div>

          <div className="space-y-2">
            {uploads.map((upload, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-2 rounded bg-boh-bg-light dark:bg-boh-bg"
              >
                <div className="flex-shrink-0">
                  {upload.status === 'success' && (
                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  )}
                  {upload.status === 'error' && (
                    <AlertCircleIcon className="w-5 h-5 text-red-500" />
                  )}
                  {(upload.status === 'pending' || upload.status === 'uploading') && (
                    <div className="w-5 h-5 rounded-full border-2 border-boh-primary border-t-transparent animate-spin" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-boh-text-light dark:text-boh-text truncate">
                    {upload.relativePath || (upload.file as File & { webkitRelativePath?: string }).webkitRelativePath || upload.file.name}
                  </p>
                  {upload.status === 'error' && upload.error && (
                    <p className="text-xs text-red-500">{upload.error}</p>
                  )}
                  {upload.status === 'uploading' && (
                    <div className="mt-1 h-1 bg-boh-surface-light dark:bg-boh-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-boh-primary transition-all duration-300"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                  {upload.status === 'success' && 'Done'}
                  {upload.status === 'uploading' && `${upload.progress}%`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
