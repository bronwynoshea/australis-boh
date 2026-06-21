import { useState } from 'react';
import { keepApi } from '../api/keepApi';
import type { UploadFile } from '../types';

export function useKeepUpload(sectionSlug: string, parentFolderId?: string, area?: 'workspace' | 'vault') {
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const uploadFiles = async (files: File[]) => {
    setUploading(true);

    const newUploads: UploadFile[] = files.map(file => ({
      file,
      progress: 0,
      status: 'pending' as const,
    }));

    setUploads(prev => [...prev, ...newUploads]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploadIndex = uploads.length + i;

      try {
        setUploads(prev => {
          const updated = [...prev];
          updated[uploadIndex] = { ...updated[uploadIndex], status: 'uploading', progress: 50 };
          return updated;
        });

        await keepApi.uploadFile({
          sectionSlug,
          fileName: file.name,
          mimeType: file.type,
          parentFolderId,
          area,
          fileContent: file,
        });

        setUploads(prev => {
          const updated = [...prev];
          updated[uploadIndex] = { ...updated[uploadIndex], status: 'success', progress: 100 };
          return updated;
        });
      } catch (err) {
        setUploads(prev => {
          const updated = [...prev];
          updated[uploadIndex] = {
            ...updated[uploadIndex],
            status: 'error',
            error: err instanceof Error ? err.message : 'Upload failed',
          };
          return updated;
        });
      }
    }

    setUploading(false);
  };

  const clearUploads = () => {
    setUploads([]);
  };

  return {
    uploads,
    uploading,
    uploadFiles,
    clearUploads,
  };
}
