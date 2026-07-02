import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, User as UserIcon, X } from 'lucide-react';
import { useSupabaseUser } from '@/services/supabaseApi';
import { uploadAvatar, updateProfileAvatar } from '@/services/avatarService';
import type { UserProfile } from '@/types';

interface LoftProfilePageProps {
  onNavigate: (path: string) => void;
}

const sanitizeAvatarUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase().startsWith('data:')) return undefined;
  return trimmed;
};

const getProfileNameSource = (profile?: UserProfile | null): string => {
  if (!profile) return '';
  const candidates = [
    profile.name,
    (profile as any)?.displayName,
    (profile as any)?.fullName,
    (profile as any)?.email,
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() || '';
};

const getInitials = (value: string): string => {
  const cleaned = value.replace(/[^a-zA-Z\s]/g, ' ').trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || '';
  const second = parts[1]?.[0] || parts[0]?.[1] || '';
  return `${first}${second}`.toUpperCase() || '?';
};

const LoftProfilePage: React.FC<LoftProfilePageProps> = ({ onNavigate }) => {
  const { user, profile, refreshProfile } = useSupabaseUser();
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const profileName = useMemo(() => getProfileNameSource(profile), [profile]);
  const profileInitials = useMemo(() => getInitials(profileName), [profileName]);
  const profileAvatarUrl = useMemo(() => sanitizeAvatarUrl(profile?.avatarUrl), [profile?.avatarUrl]);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [profileAvatarUrl]);

  const handleAvatarUpload = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setAvatarUploadError(null);
    setIsAvatarUploading(true);
    try {
      const publicUrl = await uploadAvatar(file);
      await updateProfileAvatar(publicUrl);
      await refreshProfile();
    } catch {
      setAvatarUploadError('Photo upload failed.');
    } finally {
      setIsAvatarUploading(false);
    }
  }, [refreshProfile]);

  const closeProfile = () => onNavigate('/lobby');

  if (!profile && !user) {
    return (
      <FocusedSurface onClose={closeProfile} title="Profile">
        <div className="p-6 text-center space-y-5">
          <UserIcon className="w-10 h-10 mx-auto text-cafe" />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-main">Sign in to manage Loft</h1>
            <p className="mt-2 text-sm text-muted leading-relaxed">Your Loft profile lives behind member access.</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/loft/login')}
            className="w-full rounded-2xl bg-cafe text-white px-5 py-4 text-[12px] font-black uppercase tracking-[0.22em] hover:brightness-110 active:scale-95 transition-all"
          >
            Go to login
          </button>
        </div>
      </FocusedSurface>
    );
  }

  return (
    <FocusedSurface onClose={closeProfile} title="Profile">
      <div className="px-5 pb-8 pt-6 md:px-7 md:pb-10">
        <input
          ref={avatarInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = '';
            handleAvatarUpload(file);
          }}
        />

        <section className="space-y-7">
          <div className="flex flex-col items-center text-center gap-5">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isAvatarUploading}
              className="group relative w-32 h-32 rounded-[2rem] border border-[var(--loft-border)] bg-[var(--loft-surface)] overflow-hidden shadow-xl active:scale-95 transition-transform"
              aria-label="Change profile photo"
              title="Change profile photo"
            >
              {profileAvatarUrl && !avatarLoadError ? (
                <img
                  src={profileAvatarUrl}
                  className="w-full h-full object-cover"
                  alt={profileName ? `${profileName} avatar` : 'User avatar'}
                  onError={() => setAvatarLoadError(true)}
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-3xl font-black tracking-widest text-main">
                  {profileInitials}
                </span>
              )}
              <span className="absolute inset-0 bg-black/0 group-hover:bg-black/45 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                {isAvatarUploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
              </span>
            </button>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.32em] text-muted">Profile Photo</p>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isAvatarUploading}
                className="mt-3 rounded-2xl border border-[var(--loft-border)] bg-[var(--loft-surface)] px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-main hover:border-cafe/45 active:scale-95 transition-all"
              >
                {isAvatarUploading ? 'Uploading' : 'Change photo'}
              </button>
              {avatarUploadError && (
                <p className="mt-3 text-[11px] font-bold text-red-500">{avatarUploadError}</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-muted">Name</p>
            <p className="mt-2 text-lg font-black tracking-tight text-main">{profileName || user?.email || 'Loft member'}</p>
          </div>
        </section>
      </div>
    </FocusedSurface>
  );
};

const FocusedSurface: React.FC<{
  children: React.ReactNode;
  title: string;
  onClose: () => void;
}> = ({ children, title, onClose }) => (
  <div className="fixed inset-0 z-[75] md:z-[60] pointer-events-none">
    <button
      type="button"
      className="hidden md:block absolute inset-0 bg-transparent pointer-events-auto"
      aria-label="Close profile"
      onClick={onClose}
    />

    <section className="pointer-events-auto absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto no-scrollbar rounded-t-[2rem] border border-[var(--loft-border)] bg-[var(--loft-surface)] shadow-2xl md:inset-x-auto md:inset-y-0 md:right-0 md:bottom-auto md:w-[min(420px,calc(100vw-5rem))] md:max-h-none md:h-full md:rounded-none md:border-y-0 md:border-r-0">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--loft-border)] bg-[var(--loft-surface)]/92 px-5 py-4 backdrop-blur-xl md:px-7">
        <div className="min-w-0">
          <h1 className="text-lg font-black uppercase tracking-tight text-main">{title}</h1>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Name and photo</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 rounded-2xl loft-panel flex items-center justify-center text-main hover:text-cafe active:scale-95 transition-all"
          aria-label="Close profile"
          title="Close profile"
        >
          <X className="w-5 h-5" />
        </button>
      </header>
      {children}
    </section>
  </div>
);

export default LoftProfilePage;
