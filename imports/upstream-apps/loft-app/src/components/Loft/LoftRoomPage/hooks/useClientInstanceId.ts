import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { LOFT_CLIENT_INSTANCE_KEY } from '../utils/loftConstants';
import { generateInstanceId } from '../utils/loftUtils';

export function useClientInstanceId(clientInstanceIdRef: MutableRefObject<string | null>) {
  useEffect(() => {
    if (clientInstanceIdRef.current) return;

    let storedId: string | null = null;
    try {
      storedId = localStorage.getItem(LOFT_CLIENT_INSTANCE_KEY);
    } catch {
      storedId = null;
    }

    const nextId = storedId || generateInstanceId();
    clientInstanceIdRef.current = nextId;

    if (!storedId) {
      try {
        localStorage.setItem(LOFT_CLIENT_INSTANCE_KEY, nextId);
      } catch {
        // ignore
      }
    }
  }, [clientInstanceIdRef]);
}
