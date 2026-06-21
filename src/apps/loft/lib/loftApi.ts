import { supabase } from '../../../lib/supabase';
import type {
  LoftFunctionError,
  LoftJoinToken,
  PersonalRoom,
  PersonalRoomJoin,
  WaitlistEntry,
} from '../types';

type InvokeOptions = {
  body?: Record<string, unknown>;
};

const asErrorMessage = (error: unknown, fallback: string) => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const err = error as LoftFunctionError & { message?: string };
    return err.message || err.error || fallback;
  }
  return fallback;
};

async function invokeLoftFunction<T>(name: string, options: InvokeOptions = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T | LoftFunctionError>(name, {
    body: options.body ?? {},
  });

  if (error) {
    throw new Error(asErrorMessage(error, `${name} failed`));
  }

  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(asErrorMessage(data, `${name} failed`));
  }

  return data as T;
}

export const getOrCreatePersonalRoom = () =>
  invokeLoftFunction<PersonalRoom>('get-or-create-personal-room');

export const joinLoftRoom = (loftRoomId: string) =>
  invokeLoftFunction<LoftJoinToken>('loft-join-token', {
    body: { loftRoomId, appContext: 'cafe' },
  });

export const joinPersonalRoomBySlug = (slug: string, guestName: string) =>
  invokeLoftFunction<PersonalRoomJoin>('join-personal-room-by-slug', {
    body: { slug, guestName },
  });

export const getPersonalRoomWaitlist = async (personalRoomId: string) => {
  const response = await invokeLoftFunction<{ waitlist: WaitlistEntry[] }>('get-personal-room-waitlist', {
    body: { personalRoomId },
  });
  return response.waitlist ?? [];
};

export const approveWaitlistEntry = (waitlistEntryId: string) =>
  invokeLoftFunction<{ success: boolean; message?: string }>('approve-waitlist-entry', {
    body: { waitlistEntryId },
  });

export const rejectWaitlistEntry = (waitlistEntryId: string) =>
  invokeLoftFunction<{ success: boolean; message?: string }>('reject-waitlist-entry', {
    body: { waitlistEntryId },
  });
