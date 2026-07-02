import { supabase } from './supabaseClient';

type InvokeOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
};

export async function invokeStaffFunction<T = unknown>(
  functionName: string,
  options: InvokeOptions = {}
) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    return {
      data: null as T | null,
      error: sessionError || new Error('Missing staff session. Please sign in again.'),
    };
  }

  return supabase.functions.invoke<T>(functionName, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${session.access_token}`,
    },
  });
}
