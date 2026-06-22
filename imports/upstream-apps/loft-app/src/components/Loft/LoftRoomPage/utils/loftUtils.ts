import { Participant } from '../types';
import { WAITING_ERROR_CODES } from './loftConstants';

export const safeJsonParse = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

export const generateInstanceId = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `inst_${Date.now().toString(36)}_${Math.random().toString(16).slice(2)}`;
};

export const sanitizeAvatarUrl = (value?: string | null) => {
  if (!value) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.toLowerCase().startsWith('data:')) return undefined;
  return trimmed;
};

export const formatTimeAgo = (value?: string | number | null) => {
  if (!value) return 'Just now';
  const ms = typeof value === 'number' ? value : new Date(value).getTime();
  if (!Number.isFinite(ms)) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
};

export const pickPreferredParticipant = (
  current: Participant,
  candidate: Participant,
  localInstanceId: string | null
) => {
  const currentMatchesLocal = !!localInstanceId && current.instanceId === localInstanceId;
  const candidateMatchesLocal = !!localInstanceId && candidate.instanceId === localInstanceId;
  if (candidateMatchesLocal && !currentMatchesLocal) return true;
  if (!candidateMatchesLocal && currentMatchesLocal) return false;
  if (candidate.isLocal && !current.isLocal) return true;
  if (!candidate.isLocal && current.isLocal) return false;
  const currentJoined = current.joinedAt ?? 0;
  const candidateJoined = candidate.joinedAt ?? 0;
  if (candidateJoined !== currentJoined) return candidateJoined > currentJoined;
  return (candidate.id || '').localeCompare(current.id || '') > 0;
};

export const dedupeParticipantsList = (list: Participant[], localInstanceId: string | null) => {
  const orderedKeys: string[] = [];
  const byProfile = new Map<string, Participant>();
  const withoutProfile: Participant[] = [];

  list.forEach((participant) => {
    const key = participant.profileId;
    if (!key) {
      withoutProfile.push(participant);
      return;
    }
    const existing = byProfile.get(key);
    if (!existing) {
      byProfile.set(key, participant);
      orderedKeys.push(key);
      return;
    }
    if (pickPreferredParticipant(existing, participant, localInstanceId)) {
      byProfile.set(key, participant);
    }
  });

  const deduped = orderedKeys.map((key) => byProfile.get(key)!).filter(Boolean);
  return [...deduped, ...withoutProfile];
};

export const getEdgeErrorCode = (err: any): string | null => {
  if (!err) return null;
  const rawBody = typeof err?.body === 'string' ? safeJsonParse(err.body) : err?.body;
  if (rawBody?.error) return String(rawBody.error);
  if (rawBody?.code) return String(rawBody.code);
  return null;
};

export const isWaitingEdgeError = (err: any) => {
  const code = getEdgeErrorCode(err);
  if (code && WAITING_ERROR_CODES.includes(code)) return true;
  const message = typeof err?.message === 'string' ? err.message : '';
  return WAITING_ERROR_CODES.some((keyword) => message.includes(keyword));
};
