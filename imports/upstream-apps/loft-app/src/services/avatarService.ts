import { supabase } from '@/services/supabaseClient';
import { callEdgeFunction } from '@/services/supabaseApi';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB
const BUCKET = 'avatars';

const sanitizeFileName = (name: string) => {
  if (!name) return 'avatar';
  return name.replace(/[^a-zA-Z0-9.\-]/g, '_');
};

export async function uploadAvatar(file: File): Promise<string> {
  if (!file) {
    throw new Error('No file provided.');
  }
  if (!file.type?.startsWith('image/')) {
    throw new Error('Avatar must be an image file.');
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('Avatar must be 5MB or smaller.');
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const uid = authData?.user?.id;
  if (!uid) throw new Error('Must be logged in to upload avatar.');

  const safeName = sanitizeFileName(file.name || 'avatar');
  const objectPath = `${uid}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, file, { upsert: false, contentType: file.type });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  const publicUrl = publicData?.publicUrl;
  if (!publicUrl) throw new Error('Failed to get public URL for uploaded avatar.');

  return publicUrl;
}

export async function updateProfileAvatar(avatarUrl: string | null): Promise<string> {
  // Allow null to remove avatar, otherwise validate URL
  if (avatarUrl !== null && (!avatarUrl || !/^https?:\/\//i.test(avatarUrl))) {
    throw new Error('Avatar URL must be an http(s) link or null to remove.');
  }

  const data = await callEdgeFunction<{ avatarUrl?: string | null; avatar_url?: string | null }>('loft_update_current_profile', {
    avatarUrl,
  });
  return data?.avatarUrl ?? data?.avatar_url ?? '';
}
