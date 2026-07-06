import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import {
  UserProfile,
  LoftRoom,
  LoftRoomStatus,
  JoinTokenResponse,
  LoftMemberHydration,
  LoftProfileSummary,
} from '../types';

// --- In-Memory Store for Demo Purposes ---

let MOCK_ROOMS: LoftRoom[] = [];

const assignDebugSnapshot = (key: string, value: unknown) => {
  try {
    if (typeof window === 'undefined') return;
    (window as any)[key] = value;
  } catch {
    // ignore
  }
};

const normalizeProfile = (profileRow: any, fallbackName: string): UserProfile => {
  const nameFromSchema =
    profileRow.full_name ||
    profileRow.display_name ||
    [profileRow.first_name, profileRow.last_name].filter(Boolean).join(' ') ||
    profileRow.name ||
    fallbackName ||
    'Loft member';
  const canUsePersonalRoom = !!(profileRow.can_use_personal_room ?? profileRow.canUsePersonalRoom);
  const canCreateLoftRooms = !!(
    profileRow.can_create_loft_rooms ??
    profileRow.canCreateLoftRooms ??
    profileRow.can_host_loft ??
    profileRow.is_loft_admin ??
    Number(profileRow.user_type_id) === 5
  );
  const personalRoomSlug = canUsePersonalRoom ? profileRow.personal_room_slug || profileRow.personalRoomSlug || undefined : undefined;
  const personalRoomId = canUsePersonalRoom ? profileRow.personal_room_id || profileRow.personalRoomId || undefined : undefined;

  return {
    id: profileRow.id,
    name: nameFromSchema,
    avatarUrl: profileRow.avatar_url ?? profileRow.avatarUrl ?? undefined,
    defaultBgId: profileRow.default_bg_id ?? profileRow.defaultBgId ?? undefined,
    can_host_loft: !!profileRow.can_host_loft,
    can_create_loft_rooms: canCreateLoftRooms,
    canCreateLoftRooms,
    can_use_personal_room: canUsePersonalRoom,
    canUsePersonalRoom,
    personal_room_slug: personalRoomSlug,
    personalRoomSlug,
    personal_room_id: personalRoomId,
    personalRoomId,
    is_loft_admin: !!profileRow.is_loft_admin,
    user_type_id: profileRow.user_type_id ?? null,
  };
};

const fetchCurrentProfileFromEdge = async (): Promise<{
  user: { id: string; email?: string } | null;
  profile: UserProfile | null;
}> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Missing Loft Supabase environment variables for profile hydration.');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) return { user: null, profile: null };

  const response = await fetch(`${String(supabaseUrl).replace(/\/$/, '')}/functions/v1/loft-current-profile`, {
    method: 'POST',
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const responseText = await response.text();
  const data = responseText ? JSON.parse(responseText) : null;
  if (!response.ok) {
    throw new Error(`Edge function loft-current-profile failed (${response.status})`);
  }

  return {
    user: data?.user?.id
      ? { id: data.user.id, email: data.user.email || undefined }
      : null,
    profile: data?.profile?.id ? normalizeProfile(data.profile, data?.user?.email || 'Loft member') : null,
  };
};

const getAuthedUserAndProfile = async (): Promise<{
  user: { id: string; email?: string } | null;
  profile: UserProfile | null;
}> => {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return { user: null, profile: null };
  }

  const user = userData.user;

  try {
    const hydrated = await fetchCurrentProfileFromEdge();
    if (hydrated.profile?.id) {
      if ((import.meta as any)?.env?.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[Loft][SupabaseUser] profile hydrated from edge', {
          profileId: hydrated.profile.id,
          name: hydrated.profile.name,
          canUsePersonalRoom: hydrated.profile.canUsePersonalRoom,
          personalRoomSlug: hydrated.profile.personalRoomSlug || null,
        });
        assignDebugSnapshot('__loftDebugProfile', hydrated.profile);
      }
      return hydrated;
    }
  } catch (err) {
    if ((import.meta as any)?.env?.DEV) {
      // eslint-disable-next-line no-console
      console.error('[Loft][SupabaseUser] current-profile edge hydration failed', err);
    }
  }

  const profileSelect = 'id, display_name, full_name, first_name, last_name, subscription_level, access_override, avatar_url, default_bg_id, can_host_loft, can_use_personal_room, personal_room_slug, personal_room_id, is_loft_admin, user_type_id';
  const byUserId = await supabase
    .from('profile')
    .select(profileSelect)
    .eq('user_id', user.id)
    .maybeSingle();

  const byProfileId = byUserId.data?.id
    ? { data: null, error: null }
    : await supabase
        .from('profile')
        .select(profileSelect)
        .eq('id', user.id)
        .maybeSingle();

  const profileRow = byUserId.data?.id ? byUserId.data : byProfileId.data;
  const profileErr = byUserId.error || byProfileId.error;

  if (profileErr || !profileRow?.id) {
    try {
      return await fetchCurrentProfileFromEdge();
    } catch {
      return {
        user: { id: user.id, email: user.email || undefined },
        profile: null,
      };
    }
  }

  const profile = normalizeProfile(profileRow, user.email || 'Loft member');

  if ((import.meta as any)?.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[Loft][SupabaseUser] profile fetched', {
      profileId: profile.id,
      avatarUrl: profile.avatarUrl || null,
      name: profile.name,
      canUsePersonalRoom: profile.canUsePersonalRoom,
      personalRoomSlug: profile.personalRoomSlug || null,
    });
    assignDebugSnapshot('__loftDebugProfile', profile);
  }

  return {
    user: { id: user.id, email: user.email || undefined },
    profile,
  };
};

// Global state for user profile to prevent multiple loads
let globalUserState: {
  user: { id: string; email?: string } | null;
  profile: UserProfile | null;
  isLoading: boolean;
  subscribers: Set<(user: any, profile: any, isLoading: boolean) => void>;
  authSubscription: any;
  hasInitialized: boolean;
} | null = null;

const getGlobalUserState = () => {
  if (!globalUserState) {
    globalUserState = {
      user: null,
      profile: null,
      isLoading: true,
      subscribers: new Set(),
      authSubscription: null,
      hasInitialized: false,
    };
  }
  return globalUserState;
};

export const useSupabaseUser = () => {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const globalState = getGlobalUserState();
    
    // Initialize from global state
    setUser(globalState.user);
    setProfile(globalState.profile);
    setIsLoading(globalState.isLoading);
    
    // Subscribe to global state changes
    const subscriber = (newUser: any, newProfile: any, newLoading: boolean) => {
      setUser(newUser);
      setProfile(newProfile);
      setIsLoading(newLoading);
    };
    
    globalState.subscribers.add(subscriber);
    
    return () => {
      globalState.subscribers.delete(subscriber);
    };
  }, []);

  // Separate effect for global auth listener management
  useEffect(() => {
    const globalState = getGlobalUserState();

    const ensureAuthListener = () => {
      if (globalState.authSubscription) {
        return;
      }

      const load = async () => {
        // Only load if user is actually authenticated
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          globalState.isLoading = false;
          globalState.subscribers.forEach(sub => sub(null, null, false));
          globalState.hasInitialized = true;
          return;
        }

        // Prevent duplicate loads if already initialized and data exists
        if (globalState.hasInitialized && globalState.user?.id === session.user.id) {
          return;
        }

        globalState.isLoading = true;
        globalState.subscribers.forEach(sub => sub(globalState.user, globalState.profile, true));

        const { user: authedUser, profile: authedProfile } = await getAuthedUserAndProfile();

        globalState.user = authedUser;
        globalState.profile = authedProfile;
        globalState.isLoading = false;
        globalState.hasInitialized = true;

        globalState.subscribers.forEach(sub => sub(authedUser, authedProfile, false));
      };

      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (
          event === 'INITIAL_SESSION' ||
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED' ||
          event === 'SIGNED_OUT'
        ) {
          load();
        }
      });

      globalState.authSubscription = sub;

      if (!globalState.hasInitialized) {
        load();
      }
    };

    ensureAuthListener();

    return () => {
      if (globalState.subscribers.size === 0 && globalState.authSubscription) {
        globalState.authSubscription.subscription.unsubscribe();
        globalState.authSubscription = null;
        globalState.hasInitialized = false;
      }
    };
  }, []);

  const refreshProfile = () => {
    const globalState = getGlobalUserState();
    
    const load = async () => {
      globalState.isLoading = true;
      globalState.subscribers.forEach(sub => sub(globalState.user, globalState.profile, true));
      
      const { user: authedUser, profile: authedProfile } = await getAuthedUserAndProfile();
      
      globalState.user = authedUser;
      globalState.profile = authedProfile;
      globalState.isLoading = false;
      
      globalState.subscribers.forEach(sub => sub(authedUser, authedProfile, false));
    };
    
    load();
  };

  return {
    user,
    profile,
    isLoading,
    isAuthenticated: !!user,
    refreshProfile,
  };
};

const normalizeProfileSummary = (input: any): LoftProfileSummary | undefined => {
  if (!input) return undefined;
  const profileId = input.profileId || input.profile_id;
  if (!profileId) return undefined;
  return {
    profileId,
    displayName: input.displayName || input.display_name || 'Guest',
    avatarUrl: input.avatarUrl ?? input.avatar_url ?? null,
  };
};

const normalizeMemberHydration = (input: any): LoftMemberHydration | null => {
  if (!input) return null;
  const profileId = input.profileId || input.profile_id;
  if (!profileId) return null;
  return {
    profileId,
    userId: input.userId || input.user_id || undefined,
    displayName: input.displayName || input.display_name || 'Guest',
    avatarUrl: input.avatarUrl ?? input.avatar_url ?? null,
    role: input.role,
    isHandRaised: input.isHandRaised ?? input.is_hand_raised ?? false,
  };
};

const normalizeJoinTokenResponse = (raw: any): JoinTokenResponse => {
  const members = Array.isArray(raw?.members)
    ? (raw.members
        .map(normalizeMemberHydration)
        .filter(Boolean) as LoftMemberHydration[])
    : [];

  const normalized: JoinTokenResponse = {
    ...raw,
    members,
    currentUserProfile:
      normalizeProfileSummary(raw?.currentUserProfile) ||
      normalizeProfileSummary(raw?.current_user_profile),
  };

  if ((import.meta as any)?.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[Loft][JoinToken] avatar snapshot', {
      hostProfileId: raw?.hostProfileId || raw?.host_profile_id || null,
      currentUserProfile: normalized.currentUserProfile,
      members: members.map((m) => ({ profileId: m.profileId, avatarUrl: m.avatarUrl, role: m.role })),
    });
    assignDebugSnapshot('__loftDebugJoinToken', {
      hostProfileId: raw?.hostProfileId || raw?.host_profile_id || null,
      currentUserProfile: normalized.currentUserProfile,
      members,
    });
  }

  return normalized;
};

const EDGE_FN_MAP: Record<string, string> = {
  get_loft_join_token: 'loft-join-token',
  loft_join_token: 'loft-join-token',
  loft_public_join_token: 'loft-public-join-token',
  get_or_create_personal_room: 'loft-get-or-create-personal-room',
  get_personal_room_by_slug: 'loft-get-personal-room-by-slug',
  get_personal_room_waitlist: 'loft-get-personal-room-waitlist',
  request_personal_room_access: 'loft-request-personal-room-access',
  approve_waitlist_entry: 'loft-approve-waitlist-entry',
  reject_waitlist_entry: 'loft-reject-waitlist-entry',
  update_guest_leave_status: 'loft-update-guest-leave-status',
  clear_room_waitlist: 'loft-clear-room-waitlist',
  check_guest_waitlist_status: 'loft-check-guest-waitlist-status',
  create_loft_room: 'loft-create-room',
  update_loft_room: 'loft-update-room',
  delete_loft_room: 'loft-delete-room',
  loft_rsvp: 'loft-rsvp',
  loft_list_rooms: 'loft-list-rooms',
  end_loft_room: 'loft-end-room',
  loft_raise_hand: 'loft-raise-hand',
  loft_list_hand_raises: 'loft-list-hand-raises',
  loft_set_member_role: 'loft-set-member-role',
  loft_get_room_roles: 'loft-get-room-roles',
  submit_host_application: 'loft-submit-host-application',
  review_host_application: 'loft-review-host-application',
  loft_admin_list_personal_tables: 'loft-admin-list-personal-tables',
  loft_admin_manage_personal_table: 'loft-admin-manage-personal-table',
};

const getCurrentAccessToken = async (): Promise<string | undefined> => {
  try {
    const sessionResult = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1500)),
    ]);
    return sessionResult?.data?.session?.access_token || undefined;
  } catch {
    return undefined;
  }
};

export const callEdgeFunction = async <T>(
  functionName: unknown,
  payload: any
): Promise<T> => {
  if (typeof functionName !== 'string' || functionName.trim().length === 0) {
    throw new Error(`Invalid edge function name: ${String(functionName)}`);
  }

  const fn = EDGE_FN_MAP[functionName] || functionName;
  if (typeof fn !== 'string' || fn.trim().length === 0) {
    throw new Error(`Could not resolve edge function name for: ${functionName}`);
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Missing Loft Supabase environment variables for Edge Function call.');
  }

  const accessToken = await getCurrentAccessToken();
  const headers: Record<string, string> = {
    apikey: supabasePublishableKey,
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${String(supabaseUrl).replace(/\/$/, '')}/functions/v1/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload ?? {}),
  });

  const responseText = await response.text();
  const data = responseText
    ? (() => {
        try {
          return JSON.parse(responseText);
        } catch {
          return responseText;
        }
      })()
    : null;

  if (!response.ok) {
    const bodyString = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : '';
    const bodyMessage = typeof data === 'object' && data && 'message' in data
      ? String((data as { message?: unknown }).message || '')
      : '';
    const wrappedErr: any = new Error(
      bodyMessage || `Edge function ${fn} failed (${response.status}): ${response.statusText}${
        bodyString ? ` | body: ${bodyString}` : ''
      }`
    );
    wrappedErr.status = response.status;
    wrappedErr.body = data;
    throw wrappedErr;
  }

  if (fn === 'loft-create-room') {
    const room = (data as any)?.room;
    if (!room?.id) throw new Error('Edge function loft-create-room returned no room.id');
    return { id: room.id } as unknown as T;
  }

  if (fn === 'loft-join-token') {
    return normalizeJoinTokenResponse(data) as unknown as T;
  }

  return data as T;
};

const fetchRoomsDirectDeprecated = async (filter: string, options?: { includeEnded?: boolean }) => {
  const { profile } = await getAuthedUserAndProfile();
  const profileId = profile?.id || null;

  const selectRooms = async (table: 'loft_room_with_counts' | 'loft_room') => {
    let q = supabase
      .from(table)
      .select(`
        *,
        profile!loft_room_host_profile_id_fkey (
          id,
          display_name,
          full_name,
          first_name,
          last_name,
          avatar_url
        )
      `);

    const includeEnded = !!options?.includeEnded;

    if (filter === 'mine') {
      if (!profileId) return [];
      q = q.eq('host_profile_id', profileId);

      if (!includeEnded) {
        q = q.in('status', [LoftRoomStatus.LIVE, LoftRoomStatus.SCHEDULED]);
      }
    } else if (filter === 'registered') {
      if (!profileId) return [];
      const { data: rsvps, error: rsvpErr } = await supabase
        .from('loft_room_rsvp')
        .select('loft_room_id')
        .eq('profile_id', profileId)
        .eq('status', 'going');
      if (rsvpErr) throw rsvpErr;
      const ids = (rsvps || []).map((r: any) => r.loft_room_id).filter(Boolean);
      if (ids.length === 0) return [];
      q = q.in('id', ids);
    } else {
      q = q.in('visibility', ['public', 'unlisted']);
    }

    if (filter !== 'mine' || includeEnded) {
      const statusSet = includeEnded
        ? [LoftRoomStatus.LIVE, LoftRoomStatus.SCHEDULED, LoftRoomStatus.ENDED]
        : [LoftRoomStatus.LIVE, LoftRoomStatus.SCHEDULED];
      q = q.in('status', statusSet);
    }

    q = q
      .order('status', { ascending: true })
      .order('scheduled_start_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    const { data, error } = await q;
    if (error) throw error;

    const normalizedRooms = (data || [])
      .filter((room: any) => {
        // 🔥 FILTER: Exclude personal rooms from lobby
        // Personal rooms have an invite_code, regular Loft rooms don't
        const isPersonalRoom = !!room.invite_code;
        
        if (isPersonalRoom) {
          console.log(`[fetchRooms] Filtering out personal room: ${room.title}`);
          return false;
        }
        
        return true;
      })
      .map((room: any) => {
      const hostProfile = room?.profile;
      
      const hostProfileName =
        hostProfile?.display_name ||
        hostProfile?.full_name ||
        [hostProfile?.first_name, hostProfile?.last_name].filter(Boolean).join(' ') ||
        '';
      
      // Generate public URL for avatar if it exists
      let publicAvatarUrl = null;
      if (hostProfile?.avatar_url) {
        try {
          // Check if it's already a public URL or needs to be converted
          if (hostProfile.avatar_url.startsWith('https://') && hostProfile.avatar_url.includes('supabase')) {
            // It's already a public URL, use as-is
            publicAvatarUrl = hostProfile.avatar_url;
          } else {
            // It's a storage path, generate public URL
            const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(hostProfile.avatar_url);
            publicAvatarUrl = publicData?.publicUrl || null;
          }
        } catch (error) {
          console.warn('[fetchRooms] Failed to generate public avatar URL:', error);
          publicAvatarUrl = null;
        }
      }
      
      const { profile, ...rest } = room;
      const finalResult = {
        ...rest,
        host_name: hostProfileName || room.host_name || '',
        host_avatar_url: publicAvatarUrl,
      };
      
      return finalResult;
    });

    if ((import.meta as any)?.env?.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[Loft][Lobby] rooms avatar snapshot', normalizedRooms.map((room: any) => ({
        roomId: room.id,
        hostName: room.host_name,
        hostAvatarUrl: room.host_avatar_url || null,
      })));
      assignDebugSnapshot('__loftDebugLobbyRooms', normalizedRooms);
    }

    return normalizedRooms as LoftRoom[];
  };

  try {
    return await selectRooms('loft_room_with_counts');
  } catch (e: any) {
    const code = e?.code;
    const msg = e?.message || '';
    if (code === '42P01' || msg.toLowerCase().includes('loft_room_with_counts')) {
      return await selectRooms('loft_room');
    }
    throw e;
  }
};

export const fetchRooms = async (filter: string, options?: { includeEnded?: boolean }) => {
  const edgeResponse = await callEdgeFunction<{ rooms: LoftRoom[] }>('loft_list_rooms', {
    filter,
    includeEnded: !!options?.includeEnded,
  });

  const rooms = Array.isArray(edgeResponse?.rooms) ? edgeResponse.rooms : [];
  if ((import.meta as any)?.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[Loft][Lobby] rooms loaded via edge function', rooms.map((room: any) => ({
      roomId: room.id,
      hostName: room.host_name,
      hostAvatarUrl: room.host_avatar_url || null,
      isRegistered: !!room.is_registered,
    })));
    assignDebugSnapshot('__loftDebugLobbyRooms', rooms);
  }

  return rooms;
};
