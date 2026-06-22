import { supabaseDb } from './supabaseDb';

export enum SyncStatus {
    NOT_CONNECTED = 'not_connected',
    CONNECTED = 'connected',
    PENDING = 'pending',
    ERROR = 'error'
}

class OutlookService {
    public clearBrowserAuthState(): void {
        if (typeof window === 'undefined') return;

        const clearOutlookStorage = (storage: Storage) => {
            const keysToRemove: string[] = [];
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (!key) continue;
                if (key === 'postOutlookRedirect' || key.startsWith('msal.')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach((key) => storage.removeItem(key));
        };

        clearOutlookStorage(window.localStorage);
        clearOutlookStorage(window.sessionStorage);
    }

    async disconnectOutlook(): Promise<void> {
        await supabaseDb.clearOutlookTokens();
        this.clearBrowserAuthState();

        try {
            await supabaseDb.updateOutlookSync({ is_enabled: false });
        } catch (error) {
            console.warn('Could not update Outlook sync:', error);
        }
    }
}

export const outlook = new OutlookService();
