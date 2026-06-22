import React, { useState, useEffect } from 'react';
import { outlook, SyncStatus } from '../services/outlookService';
import { supabase } from '../services/supabaseClient';
import { supabaseDb } from '../services/supabaseDb';
import { invokeStaffFunction } from '../services/slotzFunctions';
import { PowerIcon, CheckCircleIcon, ClockIcon } from './Icons';

interface TokenStatus {
    isValid: boolean;
    expiresAt: Date | null;
    daysUntilExpiry: number | null;
    needsRefresh: boolean;
    accountEmail: string | null;
}

interface IntegrationsViewProps {
    setFeedback: (message: string) => void;
    initialStatusMessage?: string | null;
}

const IntegrationsView: React.FC<IntegrationsViewProps> = ({ setFeedback, initialStatusMessage }) => {
    const [activeProvider, setActiveProvider] = useState<'outlook' | 'google'>('outlook');
    const [status, setStatus] = useState<SyncStatus>(SyncStatus.PENDING);
    void setFeedback;
    const [tokenStatus, setTokenStatus] = useState<TokenStatus>({
        isValid: false,
        expiresAt: null,
        daysUntilExpiry: null,
        needsRefresh: false,
        accountEmail: null
    });
    const [syncError, setSyncError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
    const [syncSummary, setSyncSummary] = useState<string | null>(null);
    const [isSyncingNow, setIsSyncingNow] = useState(false);
    const [googleTokenStatus, setGoogleTokenStatus] = useState<TokenStatus>({
        isValid: false,
        expiresAt: null,
        daysUntilExpiry: null,
        needsRefresh: false,
        accountEmail: null
    });
    const [googleSyncError, setGoogleSyncError] = useState<string | null>(null);
    const [googleStatusMessage, setGoogleStatusMessage] = useState<string | null>(null);
    const [googleLastSyncAt, setGoogleLastSyncAt] = useState<string | null>(null);
    const [googleSyncSummary, setGoogleSyncSummary] = useState<string | null>(null);
    const [isGoogleSyncingNow, setIsGoogleSyncingNow] = useState(false);

    const checkTokenStatus = async (): Promise<TokenStatus> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return {
                    isValid: false,
                    expiresAt: null,
                    daysUntilExpiry: null,
                    needsRefresh: false,
                    accountEmail: null
                };
            }

            const { data: staffProfile } = await supabase
                .from('scheduling_staff_profiles')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!staffProfile) {
                return {
                    isValid: false,
                    expiresAt: null,
                    daysUntilExpiry: null,
                    needsRefresh: false,
                    accountEmail: null
                };
            }

            const { data: token } = await supabase
                .from('outlook_oauth_tokens')
                .select('*')
                .eq('staff_id', staffProfile.id)
                .eq('is_active', true)
                .maybeSingle();

            if (!token) {
                return {
                    isValid: false,
                    expiresAt: null,
                    daysUntilExpiry: null,
                    needsRefresh: false,
                    accountEmail: null
                };
            }

            const refreshExpiresAt = new Date(token.refresh_token_expires_at || token.created_at);

            // If refresh_token_expires_at doesn't exist, calculate from created_at + 90 days
            if (!token.refresh_token_expires_at) {
                const createdAt = new Date(token.created_at);
                refreshExpiresAt.setTime(createdAt.getTime() + (90 * 24 * 60 * 60 * 1000));
            }

            const now = new Date();
            const msUntilExpiry = refreshExpiresAt.getTime() - now.getTime();
            const daysUntilExpiry = Math.floor(msUntilExpiry / (1000 * 60 * 60 * 24));
            const isValid = refreshExpiresAt > now;
            const needsRefresh = daysUntilExpiry < 7 && isValid; // Warn if < 7 days

            return {
                isValid,
                expiresAt: refreshExpiresAt,
                daysUntilExpiry,
                needsRefresh,
                accountEmail: token.account_username
            };
        } catch (error) {
            console.error('Error checking token status:', error);
            return {
                isValid: false,
                expiresAt: null,
                daysUntilExpiry: null,
                needsRefresh: false,
                accountEmail: null
            };
        }
    };

    const checkGoogleTokenStatus = async (): Promise<TokenStatus> => {
        try {
            const { data, error } = await invokeStaffFunction<any>('slotz-google-status');
            if (error || data?.error || !data?.connected) {
                return {
                    isValid: false,
                    expiresAt: null,
                    daysUntilExpiry: null,
                    needsRefresh: false,
                    accountEmail: null
                };
            }

            if (data.lastSyncAt) {
                setGoogleLastSyncAt(data.lastSyncAt);
            }

            if (data.lastSyncError) {
                setGoogleSyncError(data.lastSyncError);
            }

            const expiresAt = data.refreshTokenExpiresAt ? new Date(data.refreshTokenExpiresAt) : null;
            const now = new Date();
            const msUntilExpiry = expiresAt ? expiresAt.getTime() - now.getTime() : null;
            const daysUntilExpiry = msUntilExpiry === null ? null : Math.floor(msUntilExpiry / (1000 * 60 * 60 * 24));
            const isValid = expiresAt ? expiresAt > now : true;

            return {
                isValid,
                expiresAt,
                daysUntilExpiry,
                needsRefresh: daysUntilExpiry !== null && daysUntilExpiry < 7 && isValid,
                accountEmail: data.accountEmail
            };
        } catch (error) {
            console.warn('Google Calendar status unavailable:', error);
            return {
                isValid: false,
                expiresAt: null,
                daysUntilExpiry: null,
                needsRefresh: false,
                accountEmail: null
            };
        }
    };

    useEffect(() => {
        let isMounted = true;

        const loadInitialStatus = async () => {
            try {
                const tokenInfo = await checkTokenStatus();
                if (!isMounted) return;

                setTokenStatus(tokenInfo);
                const sync = await supabaseDb.getOutlookSync();
                const syncStatusError = sync?.last_sync_status === 'error' && sync.last_sync_error ? sync.last_sync_error : null;
                if (isMounted) {
                    setLastSyncAt(sync?.last_sync_at || null);
                }

                if (!tokenInfo.accountEmail) {
                    setStatus(SyncStatus.NOT_CONNECTED);
                } else if (!tokenInfo.isValid) {
                    setStatus(SyncStatus.ERROR);
                    setSyncError('Outlook connection needs attention. Please reconnect.');
                } else if (tokenInfo.needsRefresh) {
                    setStatus(SyncStatus.CONNECTED);
                    setSyncError('Outlook token will expire soon. Please refresh.');
                } else {
                    setStatus(SyncStatus.CONNECTED);
                    setSyncError(syncStatusError);
                }

                const googleTokenInfo = await checkGoogleTokenStatus();
                if (!isMounted) return;
                setGoogleTokenStatus(googleTokenInfo);
                const googleSync = await supabaseDb.getGoogleSync();
                const googleSyncStatusError = googleSync?.last_sync_status === 'error' && googleSync.last_sync_error ? googleSync.last_sync_error : null;
                setGoogleSyncError(googleTokenInfo.accountEmail && !googleTokenInfo.isValid
                    ? 'Google Calendar connection needs attention. Please reconnect.'
                    : googleSyncStatusError
                );
            } catch (error) {
                console.warn('Initial token check failed (expected if not connected):', error);
                if (!isMounted) return;
                setStatus(SyncStatus.NOT_CONNECTED);
            }
        };

        loadInitialStatus();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (initialStatusMessage) {
            if (initialStatusMessage.toLowerCase().includes('google')) {
                setActiveProvider('google');
                setGoogleStatusMessage(initialStatusMessage);
            } else {
                setActiveProvider('outlook');
                setStatusMessage(initialStatusMessage);
            }
        }
    }, [initialStatusMessage]);

    useEffect(() => {
        if (!statusMessage || isConnectionSuccessMessage(statusMessage)) return;

        const timeoutId = window.setTimeout(() => setStatusMessage(null), 4500);
        return () => window.clearTimeout(timeoutId);
    }, [statusMessage]);

    useEffect(() => {
        if (!googleStatusMessage || isConnectionSuccessMessage(googleStatusMessage)) return;

        const timeoutId = window.setTimeout(() => setGoogleStatusMessage(null), 4500);
        return () => window.clearTimeout(timeoutId);
    }, [googleStatusMessage]);

    const showSyncSummary = (provider: 'outlook' | 'google', message: string) => {
        if (provider === 'outlook') {
            setSyncSummary(message);
            window.setTimeout(() => setSyncSummary(null), 4500);
            return;
        }

        setGoogleSyncSummary(message);
        window.setTimeout(() => setGoogleSyncSummary(null), 4500);
    };

    const handleConnect = async () => {
        setStatus(SyncStatus.PENDING);
        setSyncError(null);
        setStatusMessage(null);
        outlook.clearBrowserAuthState();

        const { data, error } = await invokeStaffFunction<any>('slotz-outlook-connect', {
            body: { appUrl: window.location.origin },
        });
        if (error || data?.error || !data?.authUrl) {
            setStatus(SyncStatus.ERROR);
            setSyncError(data?.error || error?.message || 'Failed to start Outlook setup. Please try again.');
            return;
        }

        window.location.assign(data.authUrl);
    };

    const handleDisconnect = async () => {
        await outlook.disconnectOutlook();
        setTokenStatus({
            isValid: false,
            expiresAt: null,
            daysUntilExpiry: null,
            needsRefresh: false,
            accountEmail: null
        });
        setStatus(SyncStatus.NOT_CONNECTED);
        setSyncError(null);
        setStatusMessage('Outlook has been disconnected.');
    };

    const handleSyncNow = async () => {
        setIsSyncingNow(true);
        setSyncError(null);
        setStatusMessage(null);

        try {
            const { data, error } = await invokeStaffFunction<any>('slotz-calendar-sync');
            if (error || data?.success === false) {
                throw new Error(data?.error || error?.message || 'Calendar sync failed.');
            }

            const results = (Array.isArray(data?.results) ? data.results : [])
                .filter((result: any) => !result.provider || result.provider === 'outlook');
            const syncedCount = results.reduce((total: number, result: any) => total + Number(result.events_synced || 0), 0);
            const failedResult = results.find((result: any) => result.success === false);
            if (failedResult) {
                throw new Error(failedResult.error || 'Calendar sync failed for this account.');
            }

            const sync = await supabaseDb.getOutlookSync();
            setLastSyncAt(sync?.last_sync_at || data?.synced_at || new Date().toISOString());
            showSyncSummary('outlook', `${syncedCount} external ${syncedCount === 1 ? 'booking' : 'bookings'} synced.`);
        } catch (error) {
            console.error('Outlook sync failed:', error);
            setSyncError(error instanceof Error ? error.message : 'Calendar sync failed. Please try again.');
        } finally {
            setIsSyncingNow(false);
        }
    };

    const handleConnectGoogle = async () => {
        setGoogleSyncError(null);
        setGoogleStatusMessage(null);

        const { data, error } = await invokeStaffFunction<any>('slotz-google-connect', {
            body: { appUrl: window.location.origin },
        });
        if (error || data?.error || !data?.authUrl) {
            setGoogleSyncError(data?.error || error?.message || 'Google Calendar setup needs attention.');
            return;
        }

        window.location.assign(data.authUrl);
    };

    const handleDisconnectGoogle = async () => {
        const { data, error } = await invokeStaffFunction<any>('slotz-google-disconnect');
        if (error || data?.error) {
            setGoogleSyncError(data?.error || error?.message || 'Google Calendar disconnect needs attention.');
            return;
        }

        setGoogleTokenStatus({
            isValid: false,
            expiresAt: null,
            daysUntilExpiry: null,
            needsRefresh: false,
            accountEmail: null
        });
        setGoogleSyncError(null);
        setGoogleStatusMessage('Google Calendar is disconnected.');
    };

    const handleGoogleSyncNow = async () => {
        setIsGoogleSyncingNow(true);
        setGoogleSyncError(null);
        setGoogleStatusMessage(null);

        try {
            const { data, error } = await invokeStaffFunction<any>('slotz-calendar-sync');
            if (error || data?.success === false) {
                throw new Error(data?.error || error?.message || 'Calendar sync failed.');
            }

            const results = Array.isArray(data?.results) ? data.results : [];
            const googleResults = results.filter((result: any) => result.provider === 'google');
            const syncedCount = googleResults.reduce((total: number, result: any) => total + Number(result.events_synced || 0), 0);
            const failedResult = googleResults.find((result: any) => result.success === false);
            if (failedResult) {
                throw new Error(failedResult.error || 'Google Calendar sync failed for this account.');
            }

            const googleSync = await supabaseDb.getGoogleSync();
            setGoogleLastSyncAt(googleSync?.last_sync_at || data?.synced_at || new Date().toISOString());
            showSyncSummary('google', `${syncedCount} external ${syncedCount === 1 ? 'booking' : 'bookings'} synced.`);
        } catch (error) {
            console.error('Google sync failed:', error);
            setGoogleSyncError(error instanceof Error ? error.message : 'Google Calendar sync failed. Please try again.');
        } finally {
            setIsGoogleSyncingNow(false);
        }
    };

    const formatExpiryDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const formatLastSync = (value: string | null) => {
        if (!value) return 'Not synced yet';
        return new Date(value).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const isConnectionSuccessMessage = (message: string | null) => {
        const normalized = message?.toLowerCase() || '';
        return normalized.includes('first sync completed')
            || (normalized.includes('calendar') && normalized.includes('connected') && normalized.includes('synced'));
    };

    const renderContent = () => {
        const visibleOutlookStatusMessage = statusMessage && !isConnectionSuccessMessage(statusMessage)
            ? statusMessage
            : null;

        switch (status) {
            case SyncStatus.CONNECTED:
                const { isValid, expiresAt, daysUntilExpiry, needsRefresh, accountEmail } = tokenStatus;

                return (
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                            <div className="mb-6 flex items-start gap-3">
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                                    isValid ? 'bg-emerald-500/10 dark:bg-emerald-400/15' : 'bg-primary/10 dark:bg-primary/15'
                                }`}>
                                    {isValid ? (
                                        <CheckCircleIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
                                    ) : (
                                        <ClockIcon className="h-6 w-6 text-primary dark:text-primary-light" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="mb-1 text-sm font-medium text-[var(--text-secondary)] dark:text-white">
                                        {isValid ? 'Connected' : 'Expiring soon'}
                                    </p>
                                    <p className="text-sm text-primary-text-muted dark:text-white/50">{accountEmail}</p>
                                </div>
                            </div>

                            {isValid && expiresAt && (
                                <div className={`
                                    mb-6 rounded-lg border p-4
                                    bg-primary-light/50 dark:bg-white/5 border-primary-border dark:border-white/10
                                `}>
                                    <div className="mb-2 flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-primary-text-muted dark:text-white/50" />
                                        <span className="text-xs font-medium uppercase tracking-wider text-primary-text-muted dark:text-white/50">
                                            Connection Renewal
                                        </span>
                                    </div>
                                    <p className="text-sm text-[var(--text-secondary)] dark:text-white/80">
                                        {needsRefresh ? (
                                            daysUntilExpiry !== null && (
                                                daysUntilExpiry < 1 ? (
                                                    <>Expires in <strong className="text-primary dark:text-primary-light">
                                                        {Math.max(0, Math.floor((expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60)))} hours
                                                    </strong></>
                                                ) : (
                                                    <>Expires in <strong className="text-primary dark:text-primary-light">{daysUntilExpiry} days</strong></>
                                                )
                                            )
                                        ) : (
                                            <>Renewal valid through {formatExpiryDate(expiresAt)}</>
                                        )}
                                    </p>
                                    {needsRefresh && (
                                        <p className="mt-2 text-xs text-primary-text-muted dark:text-white/60">
                                            Expiring soon. Reconnect Outlook to renew.
                                        </p>
                                    )}
                                </div>
                            )}

                            {visibleOutlookStatusMessage && (
                                <div className="slotz-notice mb-6 px-3 py-2 text-xs font-medium">
                                    {visibleOutlookStatusMessage}
                                </div>
                            )}

                            {syncError && (
                                <div className="relative z-10 mb-6 rounded-lg border border-rose-500/20 bg-rose-500/8 p-4 dark:border-rose-400/25 dark:bg-rose-400/10">
                                    <p className="mb-2 text-sm font-medium text-rose-700 dark:text-rose-300">
                                        Sync needs attention
                                    </p>
                                    <p className="text-xs text-rose-700/70 dark:text-rose-200/70">
                                        {syncError}
                                    </p>
                                </div>
                            )}

                            {!isValid && (
                                <div className="mb-6 rounded-lg border border-rose-500/20 bg-rose-500/8 p-4 dark:border-rose-400/25 dark:bg-rose-400/10">
                                    <p className="mb-2 text-sm font-medium text-rose-700 dark:text-rose-300">
                                        Reconnect required
                                    </p>
                                    <p className="text-xs text-rose-700/70 dark:text-rose-200/70">
                                        Your Outlook connection needs to be renewed before SLOTZ can continue syncing calendar changes.
                                    </p>
                                </div>
                            )}

                            {isValid && (
                                <div className="rounded-lg border border-primary-border bg-primary-light/40 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-text-muted dark:text-white/50">
                                        Last Sync
                                    </p>
                                    <div className="mt-1 flex min-h-5 flex-wrap items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-[var(--text-secondary)] dark:text-white/80">
                                            {formatLastSync(lastSyncAt)}
                                        </p>
                                        <p className={`text-xs font-medium text-primary transition-opacity dark:text-primary-light ${syncSummary ? 'opacity-100' : 'opacity-0'}`}>
                                            {syncSummary || 'Sync complete'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-3">
                            {isValid ? (
                                <>
                                    <button
                                        onClick={handleSyncNow}
                                        disabled={isSyncingNow}
                                        className="inline-flex items-center justify-center rounded-lg border border-primary/25 bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-dark active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isSyncingNow ? 'Syncing...' : 'Sync now'}
                                    </button>
                                    {needsRefresh && (
                                        <button
                                            onClick={handleConnect}
                                            className="inline-flex rounded-lg border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition-all hover:bg-primary/15 disabled:opacity-50 dark:border-primary/30 dark:bg-primary/15 dark:text-white dark:hover:bg-primary/25"
                                        >
                                            Reconnect Outlook
                                        </button>
                                    )}
                                    <button
                                        onClick={handleDisconnect}
                                        className="inline-flex bg-primary-light/50 dark:bg-white/10 text-[var(--text-secondary)] dark:text-white px-4 py-2.5 rounded-lg font-medium hover:bg-primary-light dark:hover:bg-white/20 transition-all active:scale-95 text-sm items-center justify-center gap-2 border border-primary-border dark:border-white/20"
                                    >
                                        <PowerIcon className="w-4 h-4" />
                                        Disconnect
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={handleConnect}
                                    className="inline-flex bg-primary-light border border-primary/20 text-[var(--text-secondary)] px-4 py-2.5 rounded-lg font-medium shadow-sm hover:bg-primary-border/70 transition-all active:scale-95 text-sm dark:bg-primary/15 dark:text-white dark:border-primary/30 dark:hover:bg-primary/25"
                                >
                                    Reconnect Outlook
                                </button>
                            )}
                        </div>
                    </div>
                );

            case SyncStatus.PENDING:
                return (
                    <div className="flex justify-center items-center h-24">
                        <svg className="animate-spin h-8 w-8 text-primary dark:text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                );

            case SyncStatus.ERROR:
                return (
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                            <div className="rounded-lg border border-rose-500/20 bg-rose-500/8 p-4 dark:border-rose-400/25 dark:bg-rose-400/10">
                                <p className="mb-2 text-sm font-medium text-rose-700 dark:text-rose-300">
                                    {tokenStatus.accountEmail ? 'Reconnect required' : 'Authentication failed'}
                                </p>
                                <p className="text-xs text-rose-700/70 dark:text-rose-200/70">
                                    {tokenStatus.accountEmail
                                        ? 'Your previous Outlook connection is no longer active. Please reconnect to continue syncing.'
                                        : 'Unable to authenticate. Please try again.'
                                    }
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-3">
                            <button
                                onClick={handleConnect}
                                className="inline-flex bg-primary text-white px-4 py-2.5 rounded-lg font-medium shadow-sm hover:bg-primary-dark dark:bg-primary/20 dark:text-white dark:border dark:border-primary/30 dark:hover:bg-primary/30 transition-all active:scale-95 text-sm"
                            >
                                Reconnect Outlook
                            </button>
                        </div>
                    </div>
                );

            case SyncStatus.NOT_CONNECTED:
            default:
                return (
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-normal leading-relaxed text-primary-text-muted dark:text-white/70">
                                Real-time calendar synchronization via Microsoft Graph.
                            </p>
                            {visibleOutlookStatusMessage && (
                                <div className="slotz-notice mt-4 px-3 py-2 text-xs font-medium">
                                    {visibleOutlookStatusMessage}
                                </div>
                            )}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-3">
                            <button
                                onClick={handleConnect}
                                className="inline-flex bg-primary text-white px-4 py-2.5 rounded-lg font-medium shadow-sm hover:bg-primary-dark dark:bg-primary/20 dark:text-white dark:border dark:border-primary/30 dark:hover:bg-primary/30 transition-all active:scale-95 text-sm"
                            >
                                Authenticate with Outlook
                            </button>
                        </div>
                    </div>
                );
        }
    };

    const renderGoogleContent = () => {
        const { isValid, expiresAt, daysUntilExpiry, needsRefresh, accountEmail } = googleTokenStatus;
        const visibleGoogleStatusMessage = isConnectionSuccessMessage(googleStatusMessage) ? null : googleStatusMessage;

        return (
            <>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                        <div className="mb-6 flex items-start gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                                isValid ? 'bg-emerald-500/10 dark:bg-emerald-400/15' : 'bg-primary/10 dark:bg-primary/15'
                            }`}>
                                {isValid ? (
                                    <CheckCircleIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
                                ) : (
                                    <ClockIcon className="h-6 w-6 text-primary dark:text-primary-light" />
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="mb-1 text-sm font-medium text-[var(--text-secondary)] dark:text-white">
                                    {isValid ? 'Connected' : 'Not connected'}
                                </p>
                                <p className="text-sm text-primary-text-muted dark:text-white/50">
                                    {accountEmail || 'Connect a Google account'}
                                </p>
                            </div>
                        </div>

                        {isValid && (
                            <div className={`
                                mb-6 rounded-lg border p-4
                                bg-primary-light/50 dark:bg-white/5 border-primary-border dark:border-white/10
                            `}>
                                <div className="mb-2 flex items-center gap-2">
                                    <ClockIcon className="h-4 w-4 text-primary-text-muted dark:text-white/50" />
                                    <span className="text-xs font-medium uppercase tracking-wider text-primary-text-muted dark:text-white/50">
                                        Connection Renewal
                                    </span>
                                </div>
                                <p className="text-sm text-[var(--text-secondary)] dark:text-white/80">
                                    {expiresAt && needsRefresh ? (
                                        daysUntilExpiry !== null && (
                                            daysUntilExpiry < 1 ? (
                                                <>Expires in <strong className="text-primary dark:text-primary-light">
                                                    {Math.max(0, Math.floor((expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60)))} hours
                                                </strong></>
                                            ) : (
                                                <>Expires in <strong className="text-primary dark:text-primary-light">{daysUntilExpiry} days</strong></>
                                            )
                                        )
                                    ) : expiresAt ? (
                                        <>Renewal valid through {formatExpiryDate(expiresAt)}</>
                                    ) : (
                                        <>Connection stays active unless access is revoked.</>
                                    )}
                                </p>
                                {expiresAt && needsRefresh && (
                                    <p className="mt-2 text-xs text-primary-text-muted dark:text-white/60">
                                        Expiring soon. Reconnect Google Calendar to renew.
                                    </p>
                                )}
                            </div>
                        )}

                        {visibleGoogleStatusMessage && (
                            <div className="slotz-notice mb-6 px-3 py-2 text-xs font-medium">
                                {visibleGoogleStatusMessage}
                            </div>
                        )}
                        {googleSyncError && (
                            <div className="slotz-notice slotz-notice-error mb-6 px-3 py-2 text-xs font-medium">
                                {googleSyncError}
                            </div>
                        )}

                        {isValid && (
                            <div className="rounded-lg border border-primary-border bg-primary-light/40 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-text-muted dark:text-white/50">
                                    Last Sync
                                </p>
                                <div className="mt-1 flex min-h-5 flex-wrap items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-[var(--text-secondary)] dark:text-white/80">
                                        {formatLastSync(googleLastSyncAt)}
                                    </p>
                                    <p className={`text-xs font-medium text-primary transition-opacity dark:text-primary-light ${googleSyncSummary ? 'opacity-100' : 'opacity-0'}`}>
                                        {googleSyncSummary || 'Sync complete'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-3">
                        {isValid ? (
                            <>
                                <button
                                    onClick={handleGoogleSyncNow}
                                    disabled={isGoogleSyncingNow}
                                    className="inline-flex items-center justify-center rounded-lg border border-primary/25 bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-dark active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isGoogleSyncingNow ? 'Syncing...' : 'Sync now'}
                                </button>
                                <button
                                    onClick={handleDisconnectGoogle}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary-border bg-primary-light/50 px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-all hover:bg-primary-light active:scale-95 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                                >
                                    <PowerIcon className="h-4 w-4" />
                                    Disconnect
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleConnectGoogle}
                                className="inline-flex rounded-lg border border-primary/20 bg-primary-light px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] shadow-sm transition-all hover:bg-primary-border/70 active:scale-95 dark:border-primary/30 dark:bg-primary/15 dark:text-white dark:hover:bg-primary/25"
                            >
                                Connect Google
                            </button>
                        )}
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className="flex h-full min-h-0 animate-fade-in flex-col overflow-hidden rounded-xl border border-primary-border bg-white shadow-lg dark:border-primary/20 dark:bg-darkcard">
            <div className="border-b border-primary-border/70 px-5 py-4 dark:border-primary/15">
                <h3 className="text-xl font-semibold tracking-tight leading-none text-[var(--text-secondary)] dark:text-white">
                    Calendar Integrations
                </h3>
                <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">
                    Keep external bookings visible in SLOTZ so you can avoid double-booking.
                </p>
            </div>
            <div className="border-b border-primary-border px-5 dark:border-primary/20">
                <nav className="-mb-px flex gap-5" aria-label="Calendar providers">
                    <button
                        type="button"
                        onClick={() => setActiveProvider('outlook')}
                        className={`flex min-h-10 items-center border-b-2 px-1 text-sm font-semibold uppercase tracking-[0.12em] transition-colors ${
                            activeProvider === 'outlook'
                                ? 'border-primary text-primary dark:text-white'
                                : 'border-transparent text-[var(--text-secondary)] hover:border-primary-border hover:text-primary dark:text-white/70 dark:hover:border-primary/30 dark:hover:text-white'
                        }`}
                    >
                        Outlook
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveProvider('google')}
                        className={`flex min-h-10 items-center border-b-2 px-1 text-sm font-semibold uppercase tracking-[0.12em] transition-colors ${
                            activeProvider === 'google'
                                ? 'border-primary text-primary dark:text-white'
                                : 'border-transparent text-[var(--text-secondary)] hover:border-primary-border hover:text-primary dark:text-white/70 dark:hover:border-primary/30 dark:hover:text-white'
                        }`}
                    >
                        Google
                    </button>
                </nav>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {activeProvider === 'outlook' ? renderContent() : renderGoogleContent()}
            </div>
        </div>
    );
};

export default IntegrationsView;
