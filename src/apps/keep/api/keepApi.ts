import { supabase } from '../../../lib/supabase';
import type { DriveFile, KeepSection, KeepUserAccess } from '../types';

export const keepApi = {
  async getSections(): Promise<KeepSection[]> {
    const { data, error } = await supabase.functions.invoke('keep-sections', {
      method: 'GET',
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to fetch sections');

    return data.data.sections;
  },

  async listFiles(params: {
    sectionSlug?: string;
    folderId?: string;
    area?: 'workspace' | 'vault';
  }): Promise<DriveFile[]> {
    const { data, error } = await supabase.functions.invoke('keep-list', {
      method: 'POST',
      body: params,
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to list files');

    return data.data.files;
  },

  async uploadFile(params: {
    sectionSlug: string;
    fileName: string;
    mimeType: string;
    parentFolderId?: string;
    area?: 'workspace' | 'vault';
    fileContent: File;
  }): Promise<{ fileId: string; fileName: string; webViewLink: string }> {
    const { data, error } = await supabase.functions.invoke('keep-upload', {
      method: 'POST',
      body: {
        sectionSlug: params.sectionSlug,
        fileName: params.fileName,
        mimeType: params.mimeType,
        parentFolderId: params.parentFolderId,
        area: params.area,
      },
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to upload file');

    return data.data;
  },

  async downloadFile(params: {
    fileId: string;
    sectionSlug: string;
  }): Promise<Blob> {
    const { data, error } = await supabase.functions.invoke('keep-download', {
      method: 'POST',
      body: params,
    });

    if (error) throw error;
    
    return data;
  },

  async getUserAccess(): Promise<KeepUserAccess[]> {
    const { data, error } = await supabase
      .from('keep_user_access')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async grantUserAccess(params: {
    userId: string;
    sectionSlug: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('keep_user_access')
      .insert(params);

    if (error) throw error;
  },

  async revokeUserAccess(id: string): Promise<void> {
    const { error } = await supabase
      .from('keep_user_access')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
