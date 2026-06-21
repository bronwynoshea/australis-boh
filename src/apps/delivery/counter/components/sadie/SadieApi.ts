// Sadie API calls

import type { SadieSessionResponse, SadieTranscribeResponse, SadieMessage, SadieSlots } from './SadieTypes';
import { supabase } from '../../../../../lib/supabase';

const SADIE_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

 const SADIE_SESSION_TIMEOUT_MS = 30000;

 function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
   let timeoutId: ReturnType<typeof setTimeout> | undefined;
   const timeoutPromise = new Promise<T>((_, reject) => {
     timeoutId = setTimeout(() => reject(new Error(message)), ms);
   });

   return Promise.race([promise, timeoutPromise]).finally(() => {
     if (timeoutId !== undefined) {
       clearTimeout(timeoutId);
     }
   }) as Promise<T>;
 }

async function getAuthHeaders(extra: Record<string, string> = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Sadie requires a logged-in user');
  }

  return {
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    Authorization: `Bearer ${session.access_token}`,
    ...extra,
  };
}

export async function sendToSadieSession(
  history: SadieMessage[],
  slots: SadieSlots
): Promise<SadieSessionResponse> {
  try {
    const invokePromise = supabase.functions.invoke<SadieSessionResponse>('sadie-session', {
      body: {
        history: history.map((msg) => ({ role: msg.role, content: msg.content })),
        slots,
      },
    });

    const { data, error } = await withTimeout(
      invokePromise,
      SADIE_SESSION_TIMEOUT_MS,
      'Sadie took too long to respond. Please try again.'
    );

    if (error) {
      throw new Error(error.message || 'Sadie session invocation failed');
    }

    if (!data) {
      throw new Error('Sadie session returned no data');
    }

    return data;
  } catch (error) {
    console.error('Error calling sadie-session:', error);
    throw error;
  }
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  try {
    const response = await fetch(`${SADIE_BASE_URL}/sadie-transcribe`, {
      method: 'POST',
      headers: await getAuthHeaders({
        'Content-Type': 'audio/webm',
      }),
      body: blob,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Sadie transcribe API error: ${response.status} – ${text || response.statusText}`,
      );
    }

    const data: SadieTranscribeResponse = await response.json();
    return data.transcript;
  } catch (error) {
    console.error('Error calling sadie-transcribe:', error);
    throw error;
  }
}

