import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { joinPersonalRoomBySlug } from '../lib/loftApi';
import type { PersonalRoomJoin } from '../types';

const explainError = (value: string) => {
  const messages: Record<string, string> = {
    room_not_found: 'Personal room not found or not available.',
    room_not_available: 'This Personal Room is not available.',
    room_private: 'This Personal Room is private. Ask the host for access.',
    room_ended: 'This Personal Room has ended.',
    rate_limit_exceeded: 'Too many requests. Please wait a minute before trying again.',
    server_not_configured: 'Loft join service is not configured in BOH-DEV yet.',
  };
  return messages[value] ?? value;
};

const PersonalRoomPublicJoinPage: React.FC = () => {
  const { slug = '' } = useParams();
  const normalizedSlug = useMemo(() => slug.toLowerCase().replace(/[^a-z0-9-_]/g, ''), [slug]);
  const [guestName, setGuestName] = useState('');
  const [joinResult, setJoinResult] = useState<PersonalRoomJoin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setJoinResult(null);
    setIsJoining(true);

    try {
      const result = await joinPersonalRoomBySlug(normalizedSlug, guestName.trim() || 'Guest');
      setJoinResult(result);
    } catch (err) {
      setError(explainError((err as Error).message));
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <main className="min-h-screen bg-boh-bg-light px-4 py-10 text-boh-text-light dark:bg-boh-bg dark:text-boh-text">
      <div className="mx-auto max-w-2xl rounded-3xl border border-boh-border-light bg-boh-card-light p-6 shadow-xl dark:border-boh-border dark:bg-boh-card sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-boh-primary-light dark:text-boh-primary">JOBZCAFE® Loft</p>
        <h1 className="mt-3 text-3xl font-semibold">Join a Personal Room</h1>
        <p className="mt-3 text-sm leading-6 text-boh-text-sub-light dark:text-boh-text-sub">
          You are joining through the BOH-owned Loft guest route. Enter the name the host should see before requesting access to the room.
        </p>

        <form onSubmit={handleJoin} className="mt-8 space-y-5">
          <div>
            <label htmlFor="slug" className="text-sm font-semibold">Room code</label>
            <input
              id="slug"
              type="text"
              value={normalizedSlug}
              readOnly
              className="mt-2 w-full rounded-xl border border-boh-border-light bg-white/60 px-4 py-3 font-mono text-sm outline-none dark:border-boh-border dark:bg-white/5"
            />
          </div>
          <div>
            <label htmlFor="guestName" className="text-sm font-semibold">Your name</label>
            <input
              id="guestName"
              type="text"
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="Guest name"
              className="mt-2 w-full rounded-xl border border-boh-border-light bg-white px-4 py-3 text-sm outline-none transition focus:border-boh-primary dark:border-boh-border dark:bg-white/5"
              maxLength={50}
            />
          </div>
          {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 dark:text-rose-100">{error}</div>}
          {joinResult && (
            <div className="rounded-2xl border border-boh-primary/30 bg-boh-primary/10 px-4 py-4 text-sm leading-6">
              <div className="font-semibold">Room token issued for {joinResult.roomTitle}.</div>
              <div className="mt-2 text-boh-text-sub-light dark:text-boh-text-sub">
                Daily room: <span className="font-mono">{joinResult.dailyRoomName}</span>. The next frontend step is wiring this token into the approved Daily call component; this page does not print or expose the token.
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={isJoining || normalizedSlug.length < 3}
            className="w-full rounded-xl bg-boh-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isJoining ? 'Requesting access…' : 'Join Personal Room'}
          </button>
        </form>
      </div>
    </main>
  );
};

export default PersonalRoomPublicJoinPage;
