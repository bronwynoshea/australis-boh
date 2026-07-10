import React, { useEffect, useMemo, useState } from 'react';
import {
  approveWaitlistEntry,
  getOrCreatePersonalRoom,
  getPersonalRoomWaitlist,
  joinLoftRoom,
  rejectWaitlistEntry,
} from '../lib/loftApi';
import type { LoftJoinToken, PersonalRoom, WaitlistEntry } from '../types';

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const statusCopy: Record<string, string> = {
  daily_not_configured: 'Daily API key is not configured in BOH-DEV Supabase function secrets.',
  server_not_configured: 'BOH-DEV Supabase function environment is missing required variables.',
  permission_denied: 'Your profile is not enabled for Personal Room hosting yet.',
  profile_not_found: 'No legacy Loft profile row was found for this BOH session.',
  room_not_open_yet: 'The host has not opened this room yet.',
};

const explainError = (error: string) => statusCopy[error] ?? error;

const LoftDashboardPage: React.FC = () => {
  const [personalRoom, setPersonalRoom] = useState<PersonalRoom | null>(null);
  const [joinState, setJoinState] = useState<LoftJoinToken | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [joining, setJoining] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const inviteUrl = useMemo(() => {
    if (!personalRoom?.inviteCode || !personalRoom?.tenantSlug) return '';
    return `${window.location.origin}/t/${personalRoom.tenantSlug.toLowerCase()}/loft/join/${personalRoom.inviteCode.toLowerCase()}?guest=new`;
  }, [personalRoom]);

  const refreshWaitlist = async (roomId: string) => {
    setWaitlistLoading(true);
    try {
      const entries = await getPersonalRoomWaitlist(roomId);
      setWaitlist(entries);
    } catch (err) {
      setNotice(`Waitlist unavailable: ${explainError((err as Error).message)}`);
    } finally {
      setWaitlistLoading(false);
    }
  };

  const handlePrepareRoom = async () => {
    setError(null);
    setNotice(null);
    setLoadingRoom(true);
    setJoinState(null);

    try {
      const room = await getOrCreatePersonalRoom();
      setPersonalRoom(room);
      setNotice(room.isNew ? 'Personal Room created in BOH-DEV.' : 'Existing Personal Room loaded.');
      void refreshWaitlist(room.roomId);
    } catch (err) {
      setError(explainError((err as Error).message));
    } finally {
      setLoadingRoom(false);
    }
  };

  useEffect(() => {
    void handlePrepareRoom();
  }, []);

  const handleOpenRoom = async () => {
    if (!personalRoom?.roomId) return;
    setJoining(true);
    setError(null);
    setNotice(null);

    try {
      const token = await joinLoftRoom(personalRoom.roomId);
      setJoinState(token);
      setNotice('Host token issued and room marked open/live. Daily embed wiring can now consume the token.');
      void refreshWaitlist(personalRoom.roomId);
    } catch (err) {
      setError(explainError((err as Error).message));
    } finally {
      setJoining(false);
    }
  };

  const handleWaitlistAction = async (entryId: string, action: 'approve' | 'reject') => {
    if (!personalRoom?.roomId) return;
    setNotice(null);
    setError(null);

    try {
      if (action === 'approve') {
        await approveWaitlistEntry(entryId);
      } else {
        await rejectWaitlistEntry(entryId);
      }
      setNotice(`Waitlist entry ${action === 'approve' ? 'approved' : 'rejected'}.`);
      await refreshWaitlist(personalRoom.roomId);
    } catch (err) {
      setError(explainError((err as Error).message));
    }
  };

  return (
    <div className="min-h-screen bg-boh-bg-light p-6 text-boh-text-light dark:bg-boh-bg dark:text-boh-text">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-boh-border-light bg-boh-card-light p-6 shadow-sm dark:border-boh-border dark:bg-boh-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-boh-primary-light dark:text-boh-primary">BOH Suite Module</p>
              <h1 className="mt-2 text-3xl font-semibold">Loft</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-boh-text-sub-light dark:text-boh-text-sub">
                Personal Rooms, host controls, guest waitlist operations, and Daily token readiness now live inside BOH. This migration keeps the existing profile-based Loft functions as a transition boundary while BOH identity ownership is finalized.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handlePrepareRoom}
                disabled={loadingRoom}
                className="rounded-xl bg-boh-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingRoom ? 'Loading…' : personalRoom ? 'Refresh Room' : 'Prepare Personal Room'}
              </button>
              <button
                type="button"
                onClick={handleOpenRoom}
                disabled={!personalRoom || joining}
                className="rounded-xl border border-boh-border-light px-4 py-2 text-sm font-semibold text-boh-text-light transition hover:border-boh-primary-light disabled:cursor-not-allowed disabled:opacity-50 dark:border-boh-border dark:text-boh-text dark:hover:border-boh-primary"
              >
                {joining ? 'Opening…' : 'Open Host Room'}
              </button>
            </div>
          </div>
          {(error || notice) && (
            <div className="mt-5 grid gap-3">
              {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 dark:text-rose-100">{error}</div>}
              {notice && <div className="rounded-2xl border border-boh-primary/30 bg-boh-primary/10 px-4 py-3 text-sm text-boh-text-light dark:text-boh-text">{notice}</div>}
            </div>
          )}
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-boh-border-light bg-boh-card-light p-6 shadow-sm dark:border-boh-border dark:bg-boh-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-boh-text-sub-light dark:text-boh-text-sub">Personal Room</p>
                <h2 className="mt-2 text-xl font-semibold">{personalRoom?.title ?? 'Not prepared yet'}</h2>
              </div>
              <span className="rounded-full border border-boh-border-light px-3 py-1 text-xs text-boh-text-sub-light dark:border-boh-border dark:text-boh-text-sub">
                {personalRoom?.isNew ? 'New' : personalRoom ? 'Existing' : 'Pending'}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-boh-border-light p-4 dark:border-boh-border">
                <div className="text-xs uppercase tracking-[0.18em] text-boh-text-sub-light dark:text-boh-text-sub">Room ID</div>
                <div className="mt-2 break-all font-mono text-sm">{personalRoom?.roomId ?? '—'}</div>
              </div>
              <div className="rounded-2xl border border-boh-border-light p-4 dark:border-boh-border">
                <div className="text-xs uppercase tracking-[0.18em] text-boh-text-sub-light dark:text-boh-text-sub">Daily Room</div>
                <div className="mt-2 break-all font-mono text-sm">{personalRoom?.dailyRoomName ?? '—'}</div>
              </div>
              <div className="rounded-2xl border border-boh-border-light p-4 dark:border-boh-border">
                <div className="text-xs uppercase tracking-[0.18em] text-boh-text-sub-light dark:text-boh-text-sub">Invite Code</div>
                <div className="mt-2 font-mono text-lg font-semibold">{personalRoom?.inviteCode ?? '—'}</div>
              </div>
              <div className="rounded-2xl border border-boh-border-light p-4 dark:border-boh-border">
                <div className="text-xs uppercase tracking-[0.18em] text-boh-text-sub-light dark:text-boh-text-sub">Public Join Route</div>
                <div className="mt-2 break-all text-sm">{inviteUrl || 'Generated after room preparation'}</div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-boh-border-light bg-white/40 p-4 text-sm leading-6 text-boh-text-sub-light dark:border-boh-border dark:bg-white/5 dark:text-boh-text-sub">
              Daily token state: {joinState ? `issued for ${joinState.roomTitle} as ${joinState.role}` : 'not issued in this browser session yet.'}
              {joinState?.members?.length ? ` ${joinState.members.length} member record(s) hydrated.` : ''}
            </div>
          </section>

          <section className="rounded-3xl border border-boh-border-light bg-boh-card-light p-6 shadow-sm dark:border-boh-border dark:bg-boh-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-boh-text-sub-light dark:text-boh-text-sub">Waitlist</p>
                <h2 className="mt-2 text-xl font-semibold">Guest requests</h2>
              </div>
              <button
                type="button"
                disabled={!personalRoom || waitlistLoading}
                onClick={() => personalRoom && refreshWaitlist(personalRoom.roomId)}
                className="rounded-xl border border-boh-border-light px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-boh-border"
              >
                {waitlistLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            <div className="mt-5 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
              {waitlist.length === 0 && (
                <div className="rounded-2xl border border-dashed border-boh-border-light p-5 text-sm text-boh-text-sub-light dark:border-boh-border dark:text-boh-text-sub">
                  No waitlist entries returned for this Personal Room.
                </div>
              )}
              {waitlist.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-boh-border-light p-4 dark:border-boh-border">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{entry.guestName}</div>
                      <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{entry.guestEmail || 'No email supplied'}</div>
                    </div>
                    <span className="rounded-full bg-boh-primary/10 px-2 py-1 text-xs">{entry.status}</span>
                  </div>
                  <div className="mt-3 text-xs text-boh-text-sub-light dark:text-boh-text-sub">Requested {formatDateTime(entry.requestedAt)}</div>
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={() => handleWaitlistAction(entry.id, 'approve')} className="rounded-lg bg-boh-primary px-3 py-1.5 text-xs font-semibold text-white">Approve</button>
                    <button type="button" onClick={() => handleWaitlistAction(entry.id, 'reject')} className="rounded-lg border border-boh-border-light px-3 py-1.5 text-xs font-semibold dark:border-boh-border">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default LoftDashboardPage;
