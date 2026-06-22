import React, { useState, useEffect } from 'react';
import { useSupabaseUser, callEdgeFunction } from '../../../../services/supabaseApi';
import AnimatedBackgroundBlobs from '../../AnimatedBackgroundBlobs';
import { clearPersonalGuestAccessState } from '../utils/personalRoomGuestStorage';

interface PersonalRoomHostGateProps {
  roomId: string;
  onNavigate: (path: string) => void;
}

const PersonalRoomHostGate: React.FC<PersonalRoomHostGateProps> = ({ roomId: propRoomId, onNavigate }) => {
  const [roomTitle, setRoomTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'auto'>('dark');

  useEffect(() => {
    // Load theme from localStorage
    try {
      const savedTheme = localStorage.getItem('loft-theme') as 'light' | 'dark' | 'auto';
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'auto')) {
        setThemeMode(savedTheme);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Since we have the roomId directly, we don't need to fetch room details here
    setIsLoading(false);
  }, [propRoomId]);

  const handleStartRoom = async () => {
    if (propRoomId) {
      setIsJoining(true);
      try {
        // Check if we already have a token from PersonalRoomLandingPage
        const existingToken = sessionStorage.getItem('personalRoomToken');
        const isHost = sessionStorage.getItem('personalRoomIsHost') === 'true';
        
        let data;
        if (existingToken && isHost) {
          // Use existing token
          data = JSON.parse(existingToken);
          console.log('[PersonalRoomHostGate] Using existing token from sessionStorage');
        } else {
          // Fetch host token from loft-join-token
          data = await callEdgeFunction('loft-join-token', { 
            loftRoomId: propRoomId,
          });
          console.log('[PersonalRoomHostGate] Fetched new token from edge function');
        }
        
        // Store token data in sessionStorage for PersonalRoomPage to use
        try {
          clearPersonalGuestAccessState();
          sessionStorage.setItem('personalRoomToken', JSON.stringify(data));
          sessionStorage.setItem('personalRoomIsHost', 'true');
          sessionStorage.setItem('personalRoomHostGatePassed', 'true');
          // Do NOT use localStorage for personalRoomIsHost - it contaminates guest sessions
        } catch (error) {
          console.error('[PersonalRoomHostGate] Failed to store token:', error);
        }
        
        // Navigate to personal room live route in the same window
        onNavigate(`/personal-room/live/${propRoomId}`);
      } catch (err) {
        console.error('[PersonalRoomHostGate] Failed to get host token:', err);
        setError('Failed to start room. Please try again.');
        setIsJoining(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--loft-bg)] text-[var(--loft-text)] text-xs tracking-[0.4em] uppercase">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4">
        <div className="loft-card p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold text-[var(--loft-text)]">Room Not Found</h2>
          <p className="text-[var(--loft-text-subtle)]">{error}</p>
          <button 
            onClick={() => onNavigate('/lobby')} 
            className="px-6 py-3 bg-cafe text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-cafe/90 transition-all"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--loft-bg)] relative overflow-hidden">
      <AnimatedBackgroundBlobs />
      <div className="relative z-10 w-full max-w-md">
        <div className="loft-card loft-card--flat px-8 sm:px-10 py-10 sm:py-12 shadow-2xl max-w-lg mx-6 text-center bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-[2.5rem] space-y-6 text-main dark:text-white">
          <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto">
            <img 
              src="/brand/loft-icon-signal-final-light.svg" 
              alt="Loft" 
              className="w-full h-full animate-pulse drop-shadow-[0_0_25px_rgba(37,99,235,0.28)] dark:hidden" 
            />
            <img 
              src="/brand/loft-icon-signal-final-dark.svg" 
              alt="Loft" 
              className="hidden w-full h-full animate-pulse drop-shadow-[0_0_25px_rgba(103,214,255,0.2)] dark:block" 
            />
          </div>
          
          <div className="space-y-2">
            <div className="text-xl font-black text-main dark:text-white uppercase tracking-tight">
              {roomTitle ? roomTitle.replace("'s Personal Room", "'s") : 'PERSONAL'} 
            </div>
            <div className="text-xl font-black text-main dark:text-white uppercase tracking-tight">
              {roomTitle && roomTitle.includes("'s Personal Room") ? 'Personal Room' : 'Room'}
            </div>
          </div>
          
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleStartRoom}
              disabled={isJoining}
              className={`w-full font-bold py-4 rounded-2xl text-[11px] uppercase tracking-[0.3em] shadow-lg transition-all ${
                isJoining
                  ? 'bg-[var(--loft-text)]/20 text-[var(--loft-text)]/60 cursor-not-allowed shadow-none'
                  : 'bg-cafe text-white shadow-cafe/30 hover:bg-cafe/90 active:scale-95'
              }`}
            >
              {isJoining ? 'Starting...' : 'Start Room'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalRoomHostGate;
