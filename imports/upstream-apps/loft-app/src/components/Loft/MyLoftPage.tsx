import React, { useEffect, useState, useCallback } from 'react';
import { fetchRooms, callEdgeFunction, useSupabaseUser } from '@/services/supabaseApi';
import { getLoftRoomSummary } from '@/services/geminiService';
import { LoftRoom, LoftRoomStatus } from '@/types';
import { Calendar, Video, Clock, X, Sparkles, Loader2, FileText, CheckCircle, HelpCircle } from 'lucide-react';

type ActivityRoom = LoftRoom & { __source?: 'host' | 'rsvp' };
const getCanonicalHostId = (room: LoftRoom): string =>
    String(room.host_boh_user_id || room.hostBohUserId || room.host_profile_id || room.hostProfileId || '').trim();
const isRoomHost = (room: LoftRoom, profileId?: string | null): boolean =>
    !!profileId && getCanonicalHostId(room) === String(profileId).trim();

const MyLoftPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
    const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
    const [history, setHistory] = useState<ActivityRoom[]>([]);
    const [reserved, setReserved] = useState<ActivityRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSummaryRoom, setSelectedSummaryRoom] = useState<ActivityRoom | null>(null);
    const [summaryText, setSummaryText] = useState<string>('');
    const [loadingSummary, setLoadingSummary] = useState(false);
    const { profile } = useSupabaseUser();

    const loadRooms = useCallback(async () => {
        setLoading(true);
        const [mine, registered] = await Promise.all([
            fetchRooms('mine'),
            fetchRooms('registered', { includeEnded: true }),
        ]);

        const decorate = (rooms: LoftRoom[], source: ActivityRoom['__source']): ActivityRoom[] =>
            (rooms || []).map((room) => ({
                ...room,
                __source: source,
                ...(source === 'rsvp' ? { is_registered: true } : {}),
            }));

        const dedupeById = (groups: ActivityRoom[][]) => {
            const priority = (status?: LoftRoomStatus) => {
                if (status === LoftRoomStatus.LIVE) return 0;
                if (status === LoftRoomStatus.SCHEDULED) return 1;
                return 2;
            };
            const map = new Map<string, ActivityRoom>();
            groups.flat().forEach((room) => {
                if (!room?.id) return;
                const existing = map.get(room.id);
                if (!existing || priority(room.status) < priority(existing.status)) {
                    map.set(room.id, room);
                }
            });
            return Array.from(map.values());
        };

        const combined = dedupeById([decorate(mine as LoftRoom[], 'host'), decorate(registered as LoftRoom[], 'rsvp')]);
        const getStartTime = (room: LoftRoom) => {
            const ts = room.scheduled_start_at || room.started_at || room.created_at;
            return ts ? new Date(ts).getTime() : Number.POSITIVE_INFINITY;
        };

        const reservedRooms = combined
            .filter((room) => {
                if (room.status === LoftRoomStatus.ENDED) return false;
                // Exclude Personal Rooms (they're always live, not truly "reserved")
                if (room.tags?.includes('personal-room')) return false;
                return room.status === LoftRoomStatus.LIVE || room.status === LoftRoomStatus.SCHEDULED;
            })
            .sort((a, b) => {
                const statusRank = (status: LoftRoomStatus) =>
                    status === LoftRoomStatus.LIVE ? 0 : status === LoftRoomStatus.SCHEDULED ? 1 : 2;
                const diff = statusRank(a.status) - statusRank(b.status);
                if (diff !== 0) return diff;
                return getStartTime(a) - getStartTime(b);
            });

        const historyRooms = combined
            .filter((room) => room.status === LoftRoomStatus.ENDED)
            .sort((a, b) => getStartTime(b) - getStartTime(a));

        setReserved(reservedRooms);
        setHistory(historyRooms);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadRooms();
    }, [loadRooms]);

    const handleEndRoom = useCallback(async (roomId: string) => {
        await callEdgeFunction('end_loft_room', { loftRoomId: roomId });
        await loadRooms();
    }, [loadRooms]);

    const handleViewSummary = async (room: ActivityRoom) => {
        setSelectedSummaryRoom(room);
        setLoadingSummary(true);
        setSummaryText('');
        const mockTranscript = `Discussion transcript placeholder for ${room.title}. Host and participants explored the main theme in depth with shared perspectives.`;
        try {
            const text = await getLoftRoomSummary(mockTranscript);
            setSummaryText((text || '').trim() || 'No Summary generated at this table.');
        } catch (e) {
            setSummaryText('No Summary generated at this table.');
        } finally {
            setLoadingSummary(false);
        }
    };

    const closeSummary = () => {
        setSelectedSummaryRoom(null);
        setSummaryText('');
    };

    return (
        <div className="min-h-screen bg-transparent p-4 pb-28 md:p-12 transition-colors duration-300 loft-scope">
            <div className="max-w-4xl mx-auto space-y-10">
                <h1 className="text-2xl md:text-4xl font-medium text-main uppercase tracking-tighter">My Activity</h1>
                
                <div className="flex gap-10">
                    <button 
                        onClick={() => setActiveTab('upcoming')}
                        className={`pb-5 px-2 text-[11px] font-semibold uppercase tracking-[0.3em] border-b-4 transition-all duration-200 ${activeTab === 'upcoming' ? 'border-cafe text-cafe' : 'border-transparent text-muted hover:text-main'}`}
                    >
                        Reserved
                        {reserved.length > 0 && <span className="ml-3 loft-chip text-cafe px-2 py-0.5 text-[9px] shadow-sm">{reserved.length}</span>}
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`pb-5 px-2 text-[11px] font-semibold uppercase tracking-[0.3em] border-b-4 transition-all duration-200 ${activeTab === 'history' ? 'border-cafe text-cafe' : 'border-transparent text-muted hover:text-main'}`}
                    >
                        History
                    </button>
                </div>
                
                <div className="loft-card loft-card--flat rounded-[2rem] shadow-2xl border border-[var(--loft-border)] overflow-hidden min-h-[400px] bg-[var(--loft-surface)]">
                    {loading ? (
                        <div className="p-20 text-center text-muted font-medium uppercase tracking-[0.4em] text-[10px] animate-pulse">Syncing...</div>
                    ) : (
                        <ul className="divide-y divide-[color:var(--loft-border)]">
                            {(activeTab === 'upcoming' ? reserved : history).length === 0 && (
                                <div className="p-24 text-center text-muted">
                                    <p className="font-semibold uppercase tracking-[0.2em] text-[11px] opacity-40 mb-8">
                                        {activeTab === 'upcoming'
                                            ? "No upcoming sessions at this time"
                                            : 'No history available at this time'}
                                    </p>
                                    {activeTab === 'upcoming' && (
                                        <button 
                                            onClick={() => onNavigate('/')} 
                                            className="bg-cafe text-white font-bold py-4 px-10 rounded-xl text-[10px] uppercase tracking-[0.3em] hover:bg-cafe/90 active:scale-95 transition-all shadow-xl"
                                        >
                                            Discover Tables
                                        </button>
                                    )}
                                </div>
                            )}

                            {(activeTab === 'upcoming' ? reserved : history).map((room, idx) => {
                                const isHost = isRoomHost(room, profile?.id);
                                const isRsvped = !isHost && (room.__source === 'rsvp' || room.is_registered);
                                const showJoinButton = isHost
                                    ? room.status === LoftRoomStatus.LIVE || room.status === LoftRoomStatus.SCHEDULED
                                    : !!room.is_open || !!room.is_registered;
                                const joinDisabled = !isHost && !room.is_open;
                                const joinLabel = isHost && room.status === LoftRoomStatus.SCHEDULED ? 'Start' : 'Join';
                                const joinButtonLabel = joinDisabled ? 'Waiting for host' : joinLabel;
                                const showEndButton = isHost && room.status === LoftRoomStatus.LIVE;

                                return (
                                <li
                                    key={room.id}

                                    className={`loft-row border-b border-[var(--loft-border)] last:border-b-0 flex flex-row items-center justify-between group gap-3 ${
                                        activeTab === 'history' ? 'p-3 md:p-4' : 'p-4 md:p-6'
                                    }`}
                                >
                                    <div className={`flex items-start ${activeTab === 'history' ? 'gap-3' : 'gap-4'}`}>
                                        <div
                                            className={`mt-1 rounded-lg flex items-center justify-center shrink-0 shadow-inner border border-[var(--loft-border)] ${
                                                activeTab === 'history' ? 'w-9 h-9' : 'w-10 h-10'
                                            } ${room.status === LoftRoomStatus.LIVE ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-[var(--loft-surface)] text-muted opacity-70'}`}
                                        >
                                            {activeTab === 'upcoming' ? <Calendar className="w-5 h-5" /> : <Video className={activeTab === 'history' ? 'w-4 h-4' : 'w-5 h-5'} />}
                                        </div>
                                        <div className={activeTab === 'history' ? 'space-y-1' : 'space-y-1.5'}>
                                            <h3 className={`${activeTab === 'history' ? 'text-[12px]' : 'text-sm'} font-semibold text-main group-hover:text-cafe transition-colors uppercase tracking-tight leading-none`}>
                                                {room.title}
                                            </h3>
                                            <div className="space-y-0.5 text-[9px] font-semibold text-muted uppercase tracking-[0.15em] opacity-60">
                                                {room.host_name && <div>{room.host_name}</div>}
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="w-3 h-3" />
                                                    {(() => {
                                                        const when = room.scheduled_start_at || room.started_at || room.created_at;
                                                        if (!when) {
                                                            return 'TBD';
                                                        }
                                                        const date = new Date(when);
                                                        if (Number.isNaN(date.getTime())) {
                                                            return 'TBD';
                                                        }
                                                        return date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                                                    })()}
                                                </div>
                                            </div>
                                            
                                            {activeTab === 'upcoming' && room.tags?.includes('ask-sadie') && (
                                                <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.1em] loft-chip text-indigo-300 p-4 rounded-xl flex items-start gap-4 shadow-inner">
                                                    <HelpCircle className="w-4 h-4 mt-0.5 shrink-0 opacity-40" />
                                                    <p className="leading-relaxed"><span className="opacity-40">Your query:</span> "Inquiry regarding career trajectory optimization."</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4 self-end sm:self-auto">
                                        {activeTab === 'upcoming' ? (
                                            <div className="flex items-center gap-3 flex-wrap justify-end">
                                                {isHost && (
                                                    <span className="flex items-center gap-2 text-[10px] text-cafe font-semibold uppercase tracking-[0.25em] loft-chip px-4 py-2 shadow-inner">
                                                        <FileText className="w-4 h-4" /> Host
                                                    </span>
                                                )}
                                                {!isHost && isRsvped && (
                                                    <span className="flex items-center gap-2 text-[10px] text-green-400 font-semibold uppercase tracking-[0.25em] loft-chip px-4 py-2 shadow-inner">
                                                        <CheckCircle className="w-4 h-4" /> RSVP Verified
                                                    </span>
                                                )}

                                                {showJoinButton && (
                                                    <button
                                                        type="button"
                                                        disabled={joinDisabled}
                                                        aria-disabled={joinDisabled}
                                                        onClick={() => {
                                                            if (joinDisabled) return;
                                                            onNavigate(`/room/${room.id}`);
                                                        }}
                                                        className={`text-[10px] font-semibold uppercase tracking-[0.3em] px-4 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 shadow-xl active:scale-95 ${
                                                            joinDisabled
                                                                ? 'bg-[var(--loft-surface-2)] text-main/40 dark:text-white/40 border border-[var(--loft-border)] cursor-not-allowed'
                                                                : 'bg-cafe text-white hover:brightness-110'
                                                        }`}
                                                    >
                                                        {joinButtonLabel}
                                                    </button>
                                                )}

                                                {showEndButton && (
                                                    <button
                                                        onClick={() => handleEndRoom(room.id)}
                                                        className="text-[10px] font-semibold uppercase tracking-[0.3em] bg-red-600 text-white px-4 py-2 rounded-xl transition-all duration-200 hover:bg-red-500 flex items-center gap-2 shadow-xl active:scale-95"
                                                    >
                                                        End
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleViewSummary(room)}
                                                className="text-[10px] font-semibold uppercase tracking-[0.3em] bg-cafe text-white px-4 py-2 rounded-xl transition-all duration-200 hover:brightness-110 flex items-center gap-2 shadow-xl active:scale-95"
                                            >
                                                <Sparkles className="w-3.5 h-3.5" />
                                                Summary
                                            </button>
                                        )}
                                    </div>
                                </li>
                            )})}
                        </ul>
                    )}
                </div>
            </div>

            {selectedSummaryRoom && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300 loft-scope">
                    <div className="loft-card loft-card--flat w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-[var(--loft-border)] bg-[var(--loft-surface)]">
                        <div className="p-6 border-b border-[var(--loft-border)] flex justify-between items-center bg-[var(--loft-surface-2)]">
                            <h3 className="font-semibold text-main text-[11px] uppercase tracking-[0.3em] flex items-center gap-3">
                                <Sparkles className="w-5 h-5 text-indigo-500" />
                                Summary
                            </h3>
                            <button onClick={closeSummary} className="p-2 hover:bg-surface rounded-lg transition-all active:scale-90">
                                <X className="w-6 h-6 text-muted" />
                            </button>
                        </div>
                        
                        <div className="p-8 md:p-12 space-y-8">
                            <div className="space-y-2">
                                <h4 className="text-2xl font-semibold text-main tracking-tight uppercase">{selectedSummaryRoom.title}</h4>
                                <p className="text-[10px] text-muted font-semibold uppercase tracking-[0.4em] opacity-40">Processed by Sadie AI</p>
                            </div>
                            
                            {loadingSummary ? (
                                <div className="py-16 flex flex-col items-center justify-center text-muted gap-6 animate-pulse">
                                    <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.4em]">Synthesizing records...</p>
                                </div>
                            ) : (
                                <div className="loft-card loft-card--flat p-8 rounded-xl border border-[var(--loft-border)] shadow-inner bg-[var(--loft-surface)]">
                                    <div className="whitespace-pre-wrap text-[11px] font-semibold uppercase tracking-[0.15em] text-subtle leading-loose opacity-70">
                                        {summaryText}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="p-6 border-t border-[var(--loft-border)] bg-[var(--loft-surface-2)] flex justify-end">
                            <button 
                                onClick={closeSummary} 
                                className="px-10 py-4 bg-cafe text-white rounded-xl text-[10px] font-semibold uppercase tracking-[0.4em] shadow-xl transition-all duration-200 hover:brightness-110 active:scale-95"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyLoftPage;