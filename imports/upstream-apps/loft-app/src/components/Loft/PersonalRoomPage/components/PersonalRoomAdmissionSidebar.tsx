import React, { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle, XCircle, Loader2, Pin, Trash2 } from 'lucide-react';
import { callEdgeFunction } from '@/services/supabaseApi';

interface WaitlistEntry {
  id: string;
  guestName: string;
  guestEmail?: string | null;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface PersonalRoomAdmissionSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  isHost: boolean;
  keepOpen?: boolean;
  onKeepOpenChange?: (keepOpen: boolean) => void;
  onPendingCountChange?: (count: number) => void;
  onClearAll?: () => void;
  onGuestRemoved?: (entry: WaitlistEntry) => void;
}

const PersonalRoomAdmissionSidebar: React.FC<PersonalRoomAdmissionSidebarProps> = ({
  isOpen,
  onClose,
  roomId,
  isHost,
  keepOpen = false,
  onKeepOpenChange,
  onPendingCountChange,
  onClearAll,
  onGuestRemoved,
}) => {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [actionEntryId, setActionEntryId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Fetch waitlist
  useEffect(() => {
    if (!isHost || !roomId) return;
    
    const fetchWaitlist = async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
      if (showLoading) setIsLoading(true);
      try {
        const response = await callEdgeFunction<{ waitlist: WaitlistEntry[] }>(
          'get_personal_room_waitlist',
          { personalRoomId: roomId }
        );
        const list = response.waitlist || [];
        setWaitlist(list);
        setFeedback(null);
        
        // 🔥 FIX: Notify parent of pending count for visual indicator
        const pendingCount = list.filter(e => e.status === 'pending').length;
        onPendingCountChange?.(pendingCount);
      } catch (error) {
        console.error('[Sidebar] Failed to fetch guest requests:', error);
        setFeedback('Guest requests could not refresh. We will keep trying.');
      } finally {
        if (showLoading) setIsLoading(false);
      }
    };

    // Fetch on open or when sidebar should stay open
    if (isOpen || keepOpen) {
      fetchWaitlist({ showLoading: waitlist.length === 0 });
      
      // 🔥 FIX: Poll for updates every 5 seconds when sidebar is open or pinned
      const interval = setInterval(fetchWaitlist, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, isHost, roomId, keepOpen, onPendingCountChange, waitlist.length]);

  const handleApprove = useCallback(async (entryId: string) => {
    setActionEntryId(entryId);
    setFeedback(null);
    try {
      await callEdgeFunction('approve_waitlist_entry', {
        waitlistEntryId: entryId,
      });
      
      // Update local waitlist
      setWaitlist(prev =>
        prev.map(entry =>
          entry.id === entryId ? { ...entry, status: 'approved' } : entry
        )
      );
      onPendingCountChange?.(waitlist.filter(entry => entry.status === 'pending' && entry.id !== entryId).length);
      setActiveTab('approved');
      setFeedback('Guest welcomed. Their waiting request will clear when they enter the table.');
      
    } catch (error) {
      console.error('[Sidebar] Failed to welcome guest:', error);
      setFeedback('Loft could not welcome that guest. Please try again.');
    } finally {
      setActionEntryId(null);
    }
  }, [onPendingCountChange, waitlist]);

  const handleReject = useCallback(async (entryId: string) => {
    const targetEntry = waitlist.find(entry => entry.id === entryId);
    setActionEntryId(entryId);
    setFeedback(null);
    try {
      await callEdgeFunction('reject_waitlist_entry', {
        waitlistEntryId: entryId,
      });
      setWaitlist(prev =>
        prev.map(entry =>
          entry.id === entryId ? { ...entry, status: 'rejected' } : entry
        )
      );
      onPendingCountChange?.(waitlist.filter(entry => entry.status === 'pending' && entry.id !== entryId).length);
      setActiveTab('rejected');
      if (targetEntry?.status === 'approved') {
        onGuestRemoved?.(targetEntry);
      }
      setFeedback('Guest declined.');
    } catch (error) {
      console.error('[Sidebar] Failed to decline guest:', error);
      setFeedback('Loft could not decline that guest. Please try again.');
    } finally {
      setActionEntryId(null);
    }
  }, [onGuestRemoved, onPendingCountChange, waitlist]);

  // 🔥 FIX: Allow toggling approval/rejection status for already-decided guests
  const handleToggleApproval = useCallback(async (entryId: string, currentStatus: 'approved' | 'rejected') => {
    const targetEntry = waitlist.find(entry => entry.id === entryId);
    setActionEntryId(entryId);
    setFeedback(null);
    try {
      if (currentStatus === 'approved') {
        // Change from welcomed to declined
        await callEdgeFunction('reject_waitlist_entry', {
          waitlistEntryId: entryId,
        });
        setWaitlist(prev =>
          prev.map(entry =>
            entry.id === entryId ? { ...entry, status: 'rejected' } : entry
          )
        );
        setActiveTab('rejected');
        if (targetEntry) {
          onGuestRemoved?.(targetEntry);
        }
        setFeedback('Guest moved to declined.');
      } else {
        // Change from declined to welcomed
        await callEdgeFunction('approve_waitlist_entry', {
          waitlistEntryId: entryId,
        });
        setWaitlist(prev =>
          prev.map(entry =>
            entry.id === entryId ? { ...entry, status: 'approved' } : entry
          )
        );
        setActiveTab('approved');
        setFeedback('Guest welcomed. Their waiting request will clear when they enter the table.');
      }
    } catch (error) {
      console.error('[Sidebar] Failed to update guest status:', error);
      setFeedback('Loft could not update that guest. Please try again.');
    } finally {
      setActionEntryId(null);
    }
  }, [onGuestRemoved, waitlist]);

  const filteredWaitlist = waitlist.filter(entry => entry.status === activeTab);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1200]"
        onClick={onClose}
      />

      {/* Desktop side drawer / mobile bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 max-h-[82dvh] rounded-t-3xl border-t loft-glass-strong border-loft-border shadow-2xl z-[1201] flex flex-col overflow-hidden sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-[360px] sm:rounded-none sm:border-t-0 sm:border-l">
        {/* Header */}
        <div className="p-4 border-b border-loft-border">
          <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-[var(--loft-border)] sm:hidden" />
          <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-main uppercase tracking-wider">
              Guest Requests
            </h2>
            <p className="text-[10px] text-muted uppercase tracking-[0.24em] sm:hidden">
              Guest entry
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 🔥 FIX: Clear all waitlist entries */}
            {onClearAll && (
              <button
                onClick={onClearAll}
                className="p-1 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                aria-label="Clear guest requests"
                data-loft-tooltip="Clear guest requests"
                data-loft-tooltip-placement="bottom"
                data-loft-tooltip-align="end"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            {/* 🔥 FIX: Pin toggle to keep sidebar open */}
            <button
              onClick={() => onKeepOpenChange?.(!keepOpen)}
              className={`hidden sm:inline-flex p-1 rounded-lg transition-colors ${
                keepOpen
                  ? 'bg-cafe/20 text-cafe hover:bg-cafe/30'
                  : 'hover:bg-loft-surface-2 text-muted'
              }`}
              aria-label={keepOpen ? 'Unpin guest requests' : 'Pin guest requests open'}
              data-loft-tooltip={keepOpen ? 'Let guest requests close with the drawer' : 'Keep guest requests open'}
              data-loft-tooltip-placement="bottom"
              data-loft-tooltip-align="end"
            >
              <Pin className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-loft-surface-2 transition-colors"
              aria-label="Close"
              data-loft-tooltip="Close"
              data-loft-tooltip-placement="bottom"
              data-loft-tooltip-align="end"
            >
              <X className="w-5 h-5 text-[var(--loft-text)]" />
            </button>
          </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-loft-border">
          {(['pending', 'approved', 'rejected'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === tab
                  ? 'text-cafe border-b-2 border-cafe bg-cafe/5'
                  : 'text-muted hover:text-main'
              }`}
            >
              <span className="flex flex-col items-center justify-center gap-1 leading-none">
                <span>{tab === 'pending' ? 'Waiting' : tab === 'approved' ? 'Welcomed' : 'Declined'}</span>
                <span className="text-[11px] tracking-[0.12em] opacity-75">
                  {tab === 'pending' && waitlist.filter(e => e.status === 'pending').length}
                  {tab === 'approved' && waitlist.filter(e => e.status === 'approved').length}
                  {tab === 'rejected' && waitlist.filter(e => e.status === 'rejected').length}
                </span>
              </span>
            </button>
          ))}
        </div>

        {feedback && (
          <div className="border-b border-loft-border px-4 py-3 text-xs font-semibold leading-5 text-muted">
            {feedback}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-cafe animate-spin" />
            </div>
          ) : filteredWaitlist.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center p-4">
              <p className="text-sm text-muted">
                {activeTab === 'pending' && 'No guests waiting'}
                {activeTab === 'approved' && 'No welcomed guests'}
                {activeTab === 'rejected' && 'No declined guests'}
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {filteredWaitlist.map(entry => (
                <div
                  key={entry.id}
                  className="p-3 loft-glass border border-loft-border rounded-lg space-y-3"
                >
                  <div>
                    <p className="text-sm font-bold text-[var(--loft-text)]">{entry.guestName}</p>
                    {entry.guestEmail && (
                      <p className="text-[11px] text-muted truncate">{entry.guestEmail}</p>
                    )}
                    <p className="text-xs text-muted">
                      {new Date(entry.requestedAt).toLocaleString()}
                    </p>
                  </div>

                  {activeTab === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(entry.id)}
                        disabled={actionEntryId === entry.id}
                        className="flex-1 py-2 px-3 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-bold uppercase hover:bg-green-500/30 transition-all flex items-center justify-center gap-1"
                      >
                        {actionEntryId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        {actionEntryId === entry.id ? 'Welcoming' : 'Welcome'}
                      </button>
                      <button
                        onClick={() => handleReject(entry.id)}
                        disabled={actionEntryId === entry.id}
                        className="flex-1 py-2 px-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold uppercase hover:bg-red-500/30 transition-all flex items-center justify-center gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        Decline
                      </button>
                    </div>
                  )}

                  {activeTab !== 'pending' && (
                    <div className="flex gap-2">
                      {/* 🔥 FIX: Allow toggling between approved and rejected */}
                      {activeTab === 'approved' && (
                        <>
                          <button
                            disabled
                            className="flex-1 py-2 px-3 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-1 cursor-default"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Welcomed
                          </button>
                          <button
                            onClick={() => handleToggleApproval(entry.id, 'approved')}
                            className="flex-1 py-2 px-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold uppercase hover:bg-red-500/30 transition-all flex items-center justify-center gap-1"
                            aria-label="Move guest to declined"
                            data-loft-tooltip="Move guest to declined"
                          >
                            <XCircle className="w-3 h-3" />
                            Decline
                          </button>
                        </>
                      )}
                      {activeTab === 'rejected' && (
                        <>
                          <button
                            onClick={() => handleToggleApproval(entry.id, 'rejected')}
                            className="flex-1 py-2 px-3 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-bold uppercase hover:bg-green-500/30 transition-all flex items-center justify-center gap-1"
                            aria-label="Move guest to welcomed"
                            data-loft-tooltip="Move guest to welcomed"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Welcome
                          </button>
                          <button
                            disabled
                            className="flex-1 py-2 px-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-1 cursor-default"
                          >
                            <XCircle className="w-3 h-3" />
                            Declined
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PersonalRoomAdmissionSidebar;
