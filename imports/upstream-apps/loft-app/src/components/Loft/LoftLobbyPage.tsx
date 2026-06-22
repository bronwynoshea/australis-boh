import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSupabaseUser, callEdgeFunction, fetchRooms } from '@/services/supabaseApi';
import { LoftRoom, AppContext } from '@/types';
import { Calendar, Users, Plus, Mic, Search, X, Check, ArrowRight, LayoutGrid, List, Video, Edit } from 'lucide-react';
import { getRoomDisplayStatus, getRoomSortTimestamp } from '@/utils/roomStatus';
import QuickMeetingLink from './QuickMeetingLink';
import LoftRoomForm from './LoftRoomForm';

const LoftIcon = ({ className = "w-5 h-5" }: { className?: string }) => {
  return (
    <>
      <img src="/brand/loft-icon-signal-final-light.svg" alt="Loft" className={`${className} dark:hidden`} />
      <img src="/brand/loft-icon-signal-final-dark.svg" alt="Loft" className={`${className} hidden dark:block`} />
    </>
  );
};

interface LoftLobbyPageProps {
  onNavigate: (path: string) => void;
}

const PAGE_SIZE = 6;
const MAX_VISIBLE_DAYS = 30;
const isPersonalRoom = (room: LoftRoom) => room.tags?.includes('personal-room') || !!room.invite_code;
const LIVE_ACCENT = '#e05f46';
const LIVE_ACCENT_SOFT = 'rgba(224, 95, 70, 0.18)';
const LIVE_ACCENT_SHADOW = 'rgba(224, 95, 70, 0.22)';

const APP_CONTEXT_THEMES: Record<string, { label: string; accent: string; soft: string; border: string }> = {
  [AppContext.CAFE]: {
    label: 'Cafe',
    accent: '#2563eb',
    soft: 'rgba(37, 99, 235, 0.10)',
    border: 'rgba(37, 99, 235, 0.24)',
  },
  [AppContext.JOURNEY]: {
    label: 'Journey',
    accent: '#7e22ce',
    soft: 'rgba(126, 34, 206, 0.10)',
    border: 'rgba(126, 34, 206, 0.24)',
  },
  [AppContext.COACH]: {
    label: 'Coach',
    accent: '#b45309',
    soft: 'rgba(180, 83, 9, 0.11)',
    border: 'rgba(180, 83, 9, 0.26)',
  },
  [AppContext.MENTOR]: {
    label: 'Mentor',
    accent: '#9f1239',
    soft: 'rgba(159, 18, 57, 0.10)',
    border: 'rgba(159, 18, 57, 0.24)',
  },
  [AppContext.DNA]: {
    label: 'DNA',
    accent: '#0f766e',
    soft: 'rgba(15, 118, 110, 0.10)',
    border: 'rgba(15, 118, 110, 0.24)',
  },
};

const getAppContextTheme = (context?: string, personal = false) => {
  if (personal) {
    return {
      label: 'Loft',
      accent: '#4f63d7',
      soft: 'rgba(79, 99, 215, 0.12)',
      border: 'rgba(79, 99, 215, 0.28)',
    };
  }

  return APP_CONTEXT_THEMES[String(context || '').toLowerCase()] || {
    label: 'Session',
    accent: '#4f63d7',
    soft: 'rgba(79, 99, 215, 0.10)',
    border: 'rgba(79, 99, 215, 0.24)',
  };
};

const formatSessionDate = (room: LoftRoom) => {
  if (isPersonalRoom(room) || !room.scheduled_start_at) return null;
  const date = new Date(room.scheduled_start_at);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const LoftLobbyPage: React.FC<LoftLobbyPageProps> = ({ onNavigate }) => {
  const { profile } = useSupabaseUser();
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'mine'>('all');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [rooms, setRooms] = useState<LoftRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMeetingLink, setShowMeetingLink] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingRoom, setEditingRoom] = useState<LoftRoom | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchSeqRef = useRef(0);
  const isSuperAdmin = !!(profile?.is_loft_admin || profile?.user_type_id === 5);

  const loadRooms = async () => {
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchRooms(filter);
      const baseRooms = Array.isArray(data) ? data : [];
      if (seq === fetchSeqRef.current) {
        setRooms(baseRooms);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load Loft tables.';
      if (seq === fetchSeqRef.current) {
        setLoadError('Unable to load tables. Please retry, or sign back in if the session has expired.');
        setRooms([]);
      }
      if (import.meta.env.DEV) {
        console.error('LoftLobbyPage loadRooms failed', {
          message,
          status: (error as any)?.status,
          body: (error as any)?.body,
        });
      }
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
      }
    }
  };

  const endRoom = async (room: LoftRoom) => {
    if (!profile?.id) return;
    if (room.host_profile_id !== profile.id) return;
    try {
      await callEdgeFunction<{ success: boolean }>('end_loft_room', { loftRoomId: room.id });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('LoftLobbyPage endRoom failed', error);
      }
    } finally {
      await loadRooms();
    }
  };

  useEffect(() => {
    loadRooms();
  }, [filter, profile?.id]);

  const cutoffTimestamp = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + MAX_VISIBLE_DAYS);
    return date.getTime();
  }, []);

  const filteredRooms = rooms
    .filter(room => {
      const q = searchQuery.toLowerCase();
      const title = (room.title || '').toLowerCase();
      const hostName = (room.host_name || '').toLowerCase();
      return title.includes(q) || hostName.includes(q);
    })
    .filter(room => {
      const kind = getRoomDisplayStatus(room).kind;
      const personal = isPersonalRoom(room);
      const isOwnedPersonalTable = personal && !!profile?.id && room.host_profile_id === profile.id;
      if (filter === 'mine') {
        if (!profile?.id) return false;
        // For 'mine' filter, show all rooms created by this user (no date filtering)
        return room.host_profile_id === profile.id;
      }
      if (personal) return filter === 'all' && isOwnedPersonalTable;
      if (filter === 'live') return kind === 'live';
      if (filter === 'upcoming') return kind === 'scheduled';

      return kind === 'live' || kind === 'scheduled';
    })
    .filter(room => {
      // Only apply date filtering for non-'mine' filters
      if (filter === 'mine') {
        return true; // No date filtering for host's rooms
      }

      if (getRoomDisplayStatus(room).kind === 'live') {
        return true;
      }
      
      if (!room.scheduled_start_at) return true;
      const scheduledTs = Date.parse(room.scheduled_start_at);
      if (Number.isNaN(scheduledTs)) return true;
      
      // Only show rooms from today onwards (within next 30 days)
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      
      // But keep rooms that ended recently (within 7 days) if user has RSVP
      const endedAt = room.ended_at ? Date.parse(room.ended_at) : null;
      const hasRSVP = room.is_registered;
      const recentlyEnded = endedAt && (endedAt >= (today.getTime() - (7 * 24 * 60 * 60 * 1000)));
      
      if (hasRSVP && recentlyEnded) {
        return true; // Keep recently ended rooms with RSVPs
      }
      
      return scheduledTs >= today.getTime() && scheduledTs <= cutoffTimestamp;
    });

  const orderedRooms = useMemo(() => {
    const statusRank = (kind: string) => {
      if (kind === 'live') return 0;
      if (kind === 'scheduled') return 1;
      return 2;
    };
    return [...filteredRooms].sort((a, b) => {
      const aStatus = getRoomDisplayStatus(a);
      const bStatus = getRoomDisplayStatus(b);
      const rankDiff = statusRank(aStatus.kind) - statusRank(bStatus.kind);
      if (rankDiff !== 0) return rankDiff;
      return getRoomSortTimestamp(a) - getRoomSortTimestamp(b);
    });
  }, [filteredRooms]);

  const totalPages = Math.max(1, Math.ceil(orderedRooms.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRooms = orderedRooms.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
    if (filter === 'mine') setViewMode('list');
  }, [filter, viewMode, searchQuery]);

  const toggleRsvp = async (room: LoftRoom) => {
    if (!profile?.id) return;
    if (room.host_profile_id === profile.id) return;
    if (getRoomDisplayStatus(room).kind !== 'scheduled') return;

    const nextRegistered = !room.is_registered;
    setRooms(prev => prev.map(r => (r.id === room.id ? { ...r, is_registered: nextRegistered } : r)));

    try {
      await callEdgeFunction<{ success: boolean }>('loft_rsvp', {
        loftRoomId: room.id,
        appContext: room.app_context,
        status: nextRegistered ? 'going' : 'cancelled',
      });
    } catch (e) {
      setRooms(prev => prev.map(r => (r.id === room.id ? { ...r, is_registered: !nextRegistered } : r)));
      throw e;
    }
  };

  const deleteRoom = async (room: LoftRoom) => {
    const currentUserId = profile?.id?.toString().trim();
    const hostUserId = room.host_profile_id?.toString().trim();
    const isHost = !!currentUserId && !!hostUserId && currentUserId === hostUserId;
    
    if (!profile?.id) return;
    if (!isHost && !isSuperAdmin) return;
    
    if (!confirm('Are you sure you want to delete this table or session? This action cannot be undone.')) {
      return;
    }
    
    try {
      await callEdgeFunction<{ success: boolean }>('loft-delete-room', { loftRoomId: room.id });
      await loadRooms();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('LoftLobbyPage deleteRoom failed', error);
      }
    }
  };

  const getRoomPath = (room: LoftRoom): string => {
    const isPersonal = isPersonalRoom(room);
    
    if (!isPersonal) {
      return `/room/${room.id}`;
    }

    const currentUserId = profile?.id?.toString().trim();
    const hostUserId = room.host_profile_id?.toString().trim();
    const isHost = currentUserId && hostUserId && currentUserId === hostUserId;

    if (isPersonal && isHost) {
      return `/personal-room/${room.id}`;
    }

    const personalSlug =
      room.guest_join_code ||
      room.invite_code ||
      '';

    return personalSlug ? `/personal/${personalSlug}` : `/personal-room/${room.id}`;
  };

  const renderRoomCard = (room: LoftRoom) => {
    const status = getRoomDisplayStatus(room);
    const personal = isPersonalRoom(room);
    const contextTheme = getAppContextTheme(room.app_context, personal);
    const sessionDate = formatSessionDate(room);
    const statusLabel = personal ? 'Open' : status.label;
    const isLiveSession = !personal && status.kind === 'live';
    
    const currentUserId = profile?.id?.toString().trim();
    const hostUserId = room.host_profile_id?.toString().trim();
    const isHost = !!(currentUserId && hostUserId && currentUserId === hostUserId);
    const canEditRoom = isHost || isSuperAdmin;
    
    const isRsvped = !!room.is_registered;
    const roomPath = getRoomPath(room);
    
    const showRsvpButton = !isHost && status.kind === 'scheduled';
    const showRSVPBadge = !isHost && isRsvped;
    const showEndButton = !personal && isHost && status.kind === 'live';
    const showJoinButton =
      personal ||
      status.kind === 'live' ||
      (isHost && status.kind === 'scheduled') ||
      showRSVPBadge;
    const joinLabel = isHost ? 'Start' : 'Join';
    const joinButtonDisabled = false;
    const joinButtonLabel = joinButtonDisabled ? 'Waiting for host' : joinLabel;
    const participantCount = room.participant_count ?? 0;
    const isRoomFull = participantCount >= 30;

    return (
      <div
        key={room.id}
        className="group loft-lobby-card rounded-xl p-4 md:p-5 flex flex-col justify-between transition-all relative overflow-hidden"
        style={{ '--lobby-context-accent': contextTheme.accent, '--lobby-context-soft': contextTheme.soft, '--lobby-context-border': contextTheme.border } as React.CSSProperties}
      >
        <div
          className="absolute top-0 left-0 bottom-0 w-1"
          style={{
            background: isLiveSession ? LIVE_ACCENT : contextTheme.accent,
            boxShadow: isLiveSession
              ? `2px 0 10px ${LIVE_ACCENT_SHADOW}`
              : `2px 0 10px ${contextTheme.soft}`,
          }}
        />

        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <span
                className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest"
                style={{ color: isLiveSession ? LIVE_ACCENT : contextTheme.accent }}
              >
                {isLiveSession && (
                  <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: LIVE_ACCENT }} />
                )}
                {statusLabel}
              </span>
            </div>
            <span
              className="rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-widest"
              style={{ color: contextTheme.accent, background: contextTheme.soft, borderColor: contextTheme.border }}
            >
              {contextTheme.label}
            </span>
          </div>

          <h3 className="text-base font-bold text-main leading-tight transition-colors uppercase tracking-tight line-clamp-2 group-hover:[color:var(--lobby-context-accent)]">
            {room.title}
          </h3>

          {sessionDate && (
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--loft-surface-2)] border border-[var(--loft-border)] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted">
              <Calendar className="w-3 h-3" />
              {sessionDate}
            </div>
          )}

          <p className="text-muted text-[10px] font-medium leading-relaxed line-clamp-2">
            {room.description}
          </p>
        </div>

        <div className="mt-5 pt-4 flex items-center justify-between gap-3 border-t border-[var(--loft-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg loft-lobby-avatar flex items-center justify-center overflow-hidden">
              {room.host_avatar_url ? (
                <img
                  src={room.host_avatar_url}
                  className="w-full h-full object-cover"
                  alt={room.host_name || 'Host avatar'}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      const fallback = document.createElement('div');
                      fallback.className =
                        'w-full h-full flex items-center justify-center text-[10px] font-bold text-main dark:text-white';
                      fallback.textContent =
                        (room.host_name?.[0] ||
                          room.host_name?.split(' ').map((n) => n[0]).join('') ||
                          '?').toUpperCase();
                      parent.appendChild(fallback);
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-main dark:text-white">
                  {(room.host_name?.[0] || room.host_name?.split(' ').map((n) => n[0]).join('') || '?').toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-main dark:text-white truncate uppercase tracking-tight">
                {room.host_name}
              </p>
              <p className="text-[8px] font-bold text-main/20 dark:text-white/20 uppercase tracking-widest">Host</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {showRsvpButton && (
              <button
                onClick={() => toggleRsvp(room)}
                disabled={isRoomFull && !isRsvped}
                className={`px-4 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all duration-200 border ${
                  isRsvped
                    ? 'bg-green-500/10 text-green-600 border-green-500/30 shadow-lg hover:brightness-110 active:scale-95'
                    : isRoomFull
                      ? 'bg-[var(--loft-surface-2)] text-main/40 dark:text-white/40 border-[var(--loft-border)] cursor-not-allowed'
                      : 'bg-[var(--loft-surface-2)] text-main/60 dark:text-white/50 border-[var(--loft-border)] hover:text-cafe hover:border-cafe/40 active:scale-95'
                }`}
              >
                {isRoomFull && !isRsvped ? 'Full' : isRsvped ? 'RSVP Verified' : 'RSVP'}
              </button>
            )}

            {showJoinButton && (
              <button
                type="button"
                disabled={joinButtonDisabled || (isRoomFull && !isRsvped)}
                aria-disabled={joinButtonDisabled || (isRoomFull && !isRsvped)}
                onClick={() => {
                  if (joinButtonDisabled || (isRoomFull && !isRsvped)) return;
                  onNavigate(roomPath);
                }}
                className={`px-5 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all duration-200 ${
                  joinButtonDisabled || (isRoomFull && !isRsvped)
                    ? 'bg-[var(--loft-surface-2)] text-main/40 dark:text-white/40 border border-[var(--loft-border)] cursor-not-allowed'
                    : 'bg-cafe text-white shadow-lg hover:brightness-110 active:scale-95'
                }`}
              >
                {isRoomFull && !isRsvped ? 'Full' : joinButtonLabel}
              </button>
            )}

            {showEndButton && (
              <button
                onClick={() => endRoom(room)}
                className="rounded-xl border border-red-500/25 bg-red-500/10 px-5 py-2.5 text-[9px] font-bold uppercase tracking-widest text-red-500 transition-all duration-200 hover:bg-red-500/18 active:scale-95 dark:text-red-300"
              >
                End
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRoomRow = (room: LoftRoom) => {
    const status = getRoomDisplayStatus(room);
    const personal = isPersonalRoom(room);
    const contextTheme = getAppContextTheme(room.app_context, personal);
    const sessionDate = formatSessionDate(room);
    const statusLabel = personal ? 'Open' : status.label;
    const isLiveSession = !personal && status.kind === 'live';
    
    const currentUserId = profile?.id?.toString().trim();
    const hostUserId = room.host_profile_id?.toString().trim();
    const isHost = !!(currentUserId && hostUserId && currentUserId === hostUserId);
    const canEditRoom = isHost || isSuperAdmin;
    
    const isRsvped = !!room.is_registered;
    const roomPath = getRoomPath(room);
    
    const showRsvpButton = !isHost && status.kind === 'scheduled';
    const showRSVPBadge = !isHost && isRsvped;
    const showEndButton = !personal && isHost && status.kind === 'live';
    const showJoinButton =
      personal ||
      status.kind === 'live' ||
      (isHost && status.kind === 'scheduled') ||
      showRSVPBadge;
    const joinLabel = isHost ? 'Start' : 'Join';
    const joinButtonDisabled = false;
    const participantCount = room.participant_count ?? 0;
    const isRoomFull = participantCount >= 30;
    const listRowCtaLabel = joinButtonDisabled ? 'Waiting' : isRoomFull ? 'Full' : joinLabel;
    const listRowCtaClasses = joinButtonDisabled || isRoomFull
      ? 'bg-[var(--loft-surface-2)] text-main/50 dark:text-white/60 border border-[var(--loft-border)] cursor-not-allowed'
      : 'bg-cafe/90 text-white shadow-md hover:brightness-110 active:scale-95';

    return (
      <div
        key={room.id}
        className="sm:grid grid-cols-12 gap-4 px-4 py-3 hover:bg-[var(--loft-surface)] transition-all relative border-b border-[var(--loft-border)] last:border-b-0"
        style={{ '--lobby-context-accent': contextTheme.accent, '--lobby-context-soft': contextTheme.soft, '--lobby-context-border': contextTheme.border } as React.CSSProperties}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: isLiveSession ? LIVE_ACCENT : contextTheme.accent }}
        />
        {/* Mobile View - Card Style */}
        <div className="sm:hidden flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl loft-panel flex items-center justify-center text-sm font-bold text-main/40 dark:text-white/40 shrink-0 overflow-hidden">
            {room.host_avatar_url ? (
              <img
                src={room.host_avatar_url}
                className="w-full h-full object-cover"
                alt={room.host_name || 'Host avatar'}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className =
                      'w-full h-full flex items-center justify-center text-sm font-bold text-main dark:text-white';
                    fallback.textContent =
                      (room.host_name?.[0] || room.host_name?.split(' ').map((n) => n[0]).join('') || '?').toUpperCase();
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              (room.host_name?.[0] || room.host_name?.split(' ').map((n) => n[0]).join('') || '?').toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-main dark:text-white uppercase truncate tracking-tight">
                {room.title}
                {isLiveSession && (
                  <div className="ml-2 inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: LIVE_ACCENT }} />
                )}
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {statusLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-bold text-main/60 dark:text-white/60 uppercase tracking-[0.25em] mt-1">
              <span>{room.host_name}</span>
              <span
                className="rounded-full border px-2 py-0.5 tracking-widest"
                style={{ color: contextTheme.accent, background: contextTheme.soft, borderColor: contextTheme.border }}
              >
                {contextTheme.label}
              </span>
            </div>
          </div>
        </div>

        {/* Desktop View - Table Style */}
        
        {/* Room Column */}
        <div className="hidden sm:block col-span-5">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-main dark:text-white uppercase tracking-tight line-clamp-1">
                {room.title}
                {isLiveSession && (
                  <div className="ml-2 inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: LIVE_ACCENT }} />
                )}
              </h3>
            </div>
            <p className="text-[9px] text-main/60 dark:text-white/60 line-clamp-2 mt-1">
              {sessionDate ? `${sessionDate} - ${room.description || ''}` : room.description}
            </p>
          </div>
        </div>

        {/* Host Column */}
        <div className="hidden sm:block col-span-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg border border-[var(--loft-border)] flex items-center justify-center overflow-hidden flex-shrink-0 bg-[var(--loft-surface)]">
              {room.host_avatar_url ? (
                <img
                  src={room.host_avatar_url}
                  className="w-full h-full object-cover"
                  alt={room.host_name || 'Host avatar'}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      const fallback = document.createElement('div');
                      fallback.className =
                        'w-full h-full flex items-center justify-center text-[10px] font-bold text-main dark:text-white';
                      fallback.textContent =
                        (room.host_name?.[0] ||
                          room.host_name?.split(' ').map((n) => n[0]).join('') ||
                          '?').toUpperCase();
                      parent.appendChild(fallback);
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-main dark:text-white">
                  {(room.host_name?.[0] || room.host_name?.split(' ').map((n) => n[0]).join('') || '?').toUpperCase()}
                </div>
              )}
            </div>
            <span className="text-[9px] font-bold text-main dark:text-white uppercase tracking-[0.25em] truncate">
              {room.host_name}
            </span>
          </div>
        </div>

        {/* Status Column */}
        <div className="hidden sm:block col-span-2">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isLiveSession ? LIVE_ACCENT : contextTheme.accent }}>
              {statusLabel}
            </span>
            <span
              className="w-fit rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest"
              style={{ color: contextTheme.accent, background: contextTheme.soft, borderColor: contextTheme.border }}
            >
              {contextTheme.label}
            </span>
          </div>
        </div>

        {/* Actions Column */}
        <div className="hidden sm:col-span-3 sm:flex items-center justify-end gap-2">
          {/* Host/Super Admin Actions */}
          {canEditRoom && (
            <>
              <button
                onClick={() => setEditingRoom(room)}
                className="px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.3em] rounded-lg transition-all bg-[var(--loft-surface-2)] text-main/60 dark:text-white/50 border border-[var(--loft-border)] hover:text-cafe hover:border-cafe/40"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteRoom(room);
                }}
                className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.3em] text-red-500 transition-all hover:bg-red-500/18 dark:text-red-300"
              >
                Delete
              </button>
            </>
          )}
          
          {/* Regular User Actions */}
          {!isHost && showRsvpButton && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isRoomFull || isRsvped) toggleRsvp(room);
              }}
              disabled={isRoomFull && !isRsvped}
              className={`text-[8px] font-semibold uppercase tracking-[0.3em] px-3 py-2 rounded-lg transition-all border ${
                isRsvped
                  ? 'bg-green-500/10 text-green-600 border-green-500/30 hover:brightness-110'
                  : isRoomFull
                    ? 'bg-[var(--loft-surface-2)] text-main/40 dark:text-white/40 border-[var(--loft-border)] cursor-not-allowed'
                    : 'bg-[var(--loft-surface-2)] text-main/60 dark:text-white/50 border-[var(--loft-border)] hover:text-cafe hover:border-cafe/40'
              }`}
            >
              {isRoomFull && !isRsvped ? 'Full' : isRsvped ? 'RSVP confirmed' : 'RSVP'}
            </button>
          )}
          
          {showJoinButton && (
            <button
              type="button"
              disabled={joinButtonDisabled || (isRoomFull && !isRsvped)}
              onClick={(e) => {
                e.stopPropagation();
                if (!joinButtonDisabled && !(isRoomFull && !isRsvped)) {
                  onNavigate(roomPath);
                }
              }}
              className={`text-[8px] font-semibold uppercase tracking-[0.3em] px-3 py-2 rounded-lg transition-all ${listRowCtaClasses}`}
            >
              {listRowCtaLabel}
            </button>
          )}
          
          {showEndButton && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                endRoom(room);
              }}
              className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.3em] text-red-500 transition-all hover:bg-red-500/18 dark:text-red-300"
            >
              End
            </button>
          )}
        </div>

        {/* Mobile Actions */}
        <div className="sm:hidden flex items-center gap-2 mt-3">
          {canEditRoom && (
            <>
              <button
                onClick={() => setEditingRoom(room)}
                className="px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.3em] rounded-lg transition-all bg-[var(--loft-surface-2)] text-main/60 dark:text-white/50 border border-[var(--loft-border)] hover:text-cafe hover:border-cafe/40"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteRoom(room);
                }}
                className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.3em] text-red-500 transition-all hover:bg-red-500/18 dark:text-red-300"
              >
                Delete
              </button>
            </>
          )}
          {!isHost && showRsvpButton && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isRoomFull || isRsvped) toggleRsvp(room);
              }}
              disabled={isRoomFull && !isRsvped}
              className={`text-[8px] font-semibold uppercase tracking-[0.3em] px-3 py-2 rounded-lg transition-all border ${
                isRsvped
                  ? 'bg-green-500/10 text-green-600 border-green-500/30 hover:brightness-110'
                  : isRoomFull
                    ? 'bg-[var(--loft-surface-2)] text-main/40 dark:text-white/40 border-[var(--loft-border)] cursor-not-allowed'
                    : 'bg-[var(--loft-surface-2)] text-main/60 dark:text-white/50 border-[var(--loft-border)] hover:text-cafe hover:border-cafe/40'
              }`}
            >
              {isRoomFull && !isRsvped ? 'Full' : isRsvped ? 'RSVP confirmed' : 'RSVP'}
            </button>
          )}
          {showJoinButton && (
            <button
              type="button"
              disabled={joinButtonDisabled || (isRoomFull && !isRsvped)}
              onClick={(e) => {
                e.stopPropagation();
                if (!joinButtonDisabled && !(isRoomFull && !isRsvped)) {
                  onNavigate(roomPath);
                }
              }}
              className={`text-[8px] font-semibold uppercase tracking-[0.3em] px-3 py-2 rounded-lg transition-all ${listRowCtaClasses}`}
            >
              {listRowCtaLabel}
            </button>
          )}
          {showEndButton && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                endRoom(room);
              }}
              className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.3em] text-red-500 transition-all hover:bg-red-500/18 dark:text-red-300"
            >
              End
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="px-4 pt-20 pb-6 md:px-12 md:py-10 max-w-7xl mx-auto space-y-6 md:space-y-10 bg-transparent relative z-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 text-center md:text-left">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-6xl font-black text-main uppercase tracking-tight drop-shadow-sm leading-none">
            Lobby
          </h1>
          <p className="text-[11px] md:text-[12px] font-bold uppercase tracking-[0.28em] text-muted leading-relaxed max-w-xl">
            Live tables, upcoming sessions, and the conversations you host or join.
          </p>
        </div>
        <div className="loft-panel flex rounded-xl p-1 shadow-lg border w-fit mx-auto md:mx-0">
          {(['all', 'live', 'upcoming', 'mine'] as const).map((f) => (
            <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 md:px-6 py-2.5 text-[9px] md:text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all duration-200 ${
                    filter === f ? 'bg-cafe text-white shadow-md' : 'text-main/50 dark:text-white/40 hover:text-cafe'
                }`}
            >
                {f}
            </button>
          ))}
        </div>
      </header>

      <div className="flex items-center gap-3">
        <div className="relative group flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-main/30 dark:text-white/20 group-focus-within:text-cafe transition-colors" />
            <input 
                type="text" 
                placeholder="SEARCH TOPICS..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-xl pl-12 pr-10 py-4 text-[10px] font-bold text-main dark:text-white focus:ring-2 focus:ring-cafe/30 outline-none transition-all placeholder:text-main/20 dark:placeholder:text-white/20 tracking-[0.2em] uppercase shadow-lg"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-main/30 hover:text-main/60 dark:text-white/30 dark:hover:text-white/60 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
        </div>
        <div className="loft-panel flex rounded-xl p-1 border shadow-lg">
            <button 
                onClick={() => setViewMode('card')}
                className={`p-2.5 rounded-lg transition-all ${viewMode === 'card' ? 'bg-cafe text-white shadow-md' : 'text-main/40 dark:text-white/30 hover:text-cafe'}`}
                aria-label="Grid View"
            >
                <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
                onClick={() => setViewMode('list')}
                className={`p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-cafe text-white shadow-md' : 'text-main/40 dark:text-white/30 hover:text-cafe'}`}
                aria-label="List View"
            >
                <List className="w-4 h-4" />
            </button>
        </div>
      </div>

      <section className="flex min-h-[34rem] flex-col gap-4 md:min-h-[36rem]">
        <div className={viewMode === 'card' ? "grid flex-1 content-start grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-3" : "loft-lobby-list flex-1 overflow-hidden rounded-2xl border border-[var(--loft-border)]"}>
          {loading ? (
              Array(6).fill(0).map((_, i) => (
                  <div key={i} className={`rounded-xl loft-card loft-card--flat animate-pulse ${viewMode === 'card' ? 'h-64' : 'h-24'}`} />
              ))
          ) : loadError ? (
              <div className="col-span-full py-16 flex justify-center">
                <div className="loft-card loft-card--flat max-w-xl px-6 py-7 text-center space-y-5 border-red-500/25">
                  <p className="mx-auto max-w-md text-sm font-semibold text-main leading-relaxed">{loadError}</p>
                  <button
                    type="button"
                    onClick={loadRooms}
                    className="rounded-xl bg-cafe px-5 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-white"
                  >
                    Retry
                  </button>
                </div>
              </div>
          ) : orderedRooms.length === 0 ? (
              <div className="col-span-full py-20 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-main/20 dark:text-white/20">No tables or sessions found</p>
              </div>
          ) : viewMode === 'card' ? (
            paginatedRooms.map(room => renderRoomCard(room))
          ) : (
            <>
              {/* Table Header */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 text-[9px] font-bold text-main/40 dark:text-white/40 uppercase tracking-[0.3em] border-b border-[var(--loft-border)]">
                <div className="col-span-5">Table</div>
                <div className="col-span-2">Host</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3 text-right">Actions</div>
              </div>

              {/* Table Rows */}
              {paginatedRooms.map(room => renderRoomRow(room))}
            </>
          )}
        </div>

        {orderedRooms.length > PAGE_SIZE && (
          <div className="mt-auto flex items-center justify-between gap-4 border-t border-black/5 pt-4 dark:border-white/10">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage === 1}
              className="px-4 py-2 rounded-xl font-bold uppercase tracking-[0.3em] text-[9px] bg-black/5 dark:bg-white/5 text-main/70 dark:text-white/70 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-main/60 dark:text-white/60">
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage === totalPages}
              className="px-4 py-2 rounded-xl font-bold uppercase tracking-[0.3em] text-[9px] bg-black/5 dark:bg-white/5 text-main/70 dark:text-white/70 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </section>

      {showMeetingLink && (
        <QuickMeetingLink onClose={() => setShowMeetingLink(false)} userName={profile?.name || 'Host'} />
      )}

      {editingRoom && (
        <LoftRoomForm
          onNavigate={() => {
            setEditingRoom(null);
            loadRooms();
          }}
          initialRoom={editingRoom}
        />
      )}
    </div>
  );
};

export default LoftLobbyPage;
