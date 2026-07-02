import React, { useState } from 'react';
import { callEdgeFunction } from '@/services/supabaseApi';
import { AppContext, CreateRoomPayload, LoftVisibility } from '@/types';
import { Link, Copy, Check, Video, X } from 'lucide-react';

interface QuickMeetingLinkProps {
  onClose: () => void;
  userName?: string;
}

const QuickMeetingLink: React.FC<QuickMeetingLinkProps> = ({ onClose, userName = 'Host' }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [meetingLink, setMeetingLink] = useState<string | null>(null);
  const [dailyLink, setDailyLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMeetingLink = async () => {
    setIsCreating(true);
    setError(null);
    
    try {
      const payload: CreateRoomPayload = {
        title: `Meeting with ${userName}`,
        description: 'Quick meeting room',
        visibility: LoftVisibility.UNLISTED,
        isRecorded: false,
        tags: ['meeting'],
        appContext: AppContext.CAFE,
        scheduledStartAt: new Date().toISOString(),
      };

      const newRoom = await callEdgeFunction<{ id: string; dailyRoomName?: string }>('create_loft_room', {
        payload,
        appContext: payload.appContext,
      });

      const roomId = newRoom.id;
      const appLink = `${window.location.origin}/#/room/${roomId}?prebuilt=true`;
      setMeetingLink(appLink);
      
      // Using Daily prebuilt UI via query parameter
      setDailyLink(appLink);
      
    } catch (err) {
      console.error('Failed to create meeting link:', err);
      setError('Failed to create meeting link. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md loft-card p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-main/40 hover:text-main dark:text-white/40 dark:hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-cafe/10 text-cafe">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-main dark:text-white uppercase tracking-tight">
                Quick Meeting Link
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-main/50 dark:text-white/50">
                Reusable • Unlisted
              </p>
            </div>
          </div>
        </div>

        {!meetingLink ? (
          <div className="space-y-4">
            <p className="text-sm text-main/70 dark:text-white/70">
              Generate a reusable meeting link that you can share with anyone. 
              Only people with the link can join.
            </p>
            
            <button
              onClick={createMeetingLink}
              disabled={isCreating}
              className="w-full py-4 px-6 bg-cafe text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-cafe/90 disabled:opacity-50 transition-all shadow-lg"
            >
              {isCreating ? 'Creating Link...' : 'Generate Meeting Link'}
            </button>

            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-main/60 dark:text-white/60">
                Guest Meeting Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={meetingLink}
                  readOnly
                  className="flex-1 px-4 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-sm text-main dark:text-white font-mono"
                />
                <button
                  onClick={() => copyToClipboard(meetingLink)}
                  className="p-3 bg-cafe text-white rounded-xl hover:bg-cafe/90 transition-all shadow-lg"
                  aria-label="Copy link"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="p-4 bg-cafe/5 border border-cafe/20 rounded-xl space-y-2">
              <div className="flex items-start gap-2">
                <Link className="w-4 h-4 text-cafe mt-0.5 shrink-0" />
                <div className="text-xs text-main/70 dark:text-white/70 space-y-1">
                  <p className="font-semibold">This link is reusable!</p>
                  <p>Save it in your calendar, email signature, or share it with clients. Anyone with the link can join your meeting room.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  const roomId = meetingLink.split('/room/')[1]?.split('?')[0];
                  if (roomId) {
                    window.location.hash = `/room/${roomId}`;
                  }
                }}
                className="py-3 px-4 bg-cafe text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-cafe/90 transition-all shadow-lg"
              >
                Join as Host
              </button>
              <button
                onClick={onClose}
                className="py-3 px-4 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-main dark:text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-black/10 dark:hover:bg-white/10 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickMeetingLink;
