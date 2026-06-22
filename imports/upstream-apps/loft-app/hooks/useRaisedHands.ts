import { useCallback, useEffect, useRef, useState } from 'react';
import { callEdgeFunction } from '../services/supabaseApi';
import { LoftRole } from '../types';

export interface HandRaiseRequest {
  profileId: string;
  userId?: string;
  displayName: string;
  avatarUrl?: string;
  role?: LoftRole;
  raisedAt?: string;
}

interface Options {
  pollIntervalMs?: number;
  profileId?: string | null;
}

interface HandRaiseResponse {
  requests?: Array<{
    profileId: string;
    userId?: string;
    displayName: string;
    avatarUrl?: string;
    role?: LoftRole;
    raisedAt?: string;
    handRaisedAt?: string;
    joinedAt?: string;
  }>;
}

export const useRaisedHands = (
  loftRoomId: string | null | undefined,
  isHostOrCohost: boolean,
  options?: Options
) => {
  const pollIntervalMs = Math.max(2000, options?.pollIntervalMs ?? 4000);
  const enabled = Boolean(loftRoomId && isHostOrCohost);

  const [handRaiseRequests, setHandRaiseRequests] = useState<HandRaiseRequest[]>([]);
  const [isHandsLoading, setIsHandsLoading] = useState(false);
  const [handsLastUpdatedAt, setHandsLastUpdatedAt] = useState<number | null>(null);
  const inFlightRef = useRef(false);

  const refreshHandRaises = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!enabled || !loftRoomId) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (!opts?.silent) {
        setIsHandsLoading(true);
      }

      try {
        const response = await callEdgeFunction<HandRaiseResponse>('loft_list_hand_raises', {
          loftRoomId,
        });

        const normalized = (response?.requests || []).map((item) => ({
          profileId: item.profileId,
          userId: item.userId,
          displayName: item.displayName,
          avatarUrl: item.avatarUrl,
          role: item.role,
          raisedAt: item.handRaisedAt || item.raisedAt || item.joinedAt,
        }));

        setHandRaiseRequests(normalized);
        setHandsLastUpdatedAt(Date.now());
      } catch (err) {
        if (!opts?.silent) {
          // eslint-disable-next-line no-console
          console.error('[Loft] Failed to refresh raised hands', err);
        }
      } finally {
        inFlightRef.current = false;
        if (!opts?.silent) {
          setIsHandsLoading(false);
        }
      }
    },
    [enabled, loftRoomId]
  );

  useEffect(() => {
    if (!enabled) {
      setHandRaiseRequests([]);
      setHandsLastUpdatedAt(null);
      return;
    }
    refreshHandRaises({ silent: true }).catch(() => undefined);
  }, [enabled, refreshHandRaises]);

  useEffect(() => {
    if (!enabled || !loftRoomId) return;
    if (typeof window === 'undefined') return;

    const intervalId = window.setInterval(() => {
      refreshHandRaises({ silent: true }).catch(() => undefined);
    }, pollIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, loftRoomId, pollIntervalMs, refreshHandRaises]);

  return {
    handRaiseRequests,
    isHandsLoading,
    handsLastUpdatedAt,
    refreshHandRaises,
  };
};
