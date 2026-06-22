import { supabase } from '@/services/supabaseClient';

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

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const uid = authData?.user?.id;
  if (!uid) throw new Error('Must be logged in to update avatar.');

  const { data, error } = await supabase
    .from('profile')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('user_id', uid)
    .select('id, user_id, avatar_url')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Profile update did not apply (no row matched user_id or RLS blocked).');
  }
  return data.avatar_url;
}
