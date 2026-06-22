import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { supabaseDb } from '../services/supabaseDb';
import { COMMON_TIMEZONES } from '../constants/timezones';
import { ChevronDownIcon, MapPinIcon } from './Icons';

const GlobalSettingsEditor: React.FC = () => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedTimezone, setSelectedTimezone] = useState<string>('UTC');
    const [isLoading, setIsLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const profile = await supabaseDb.getStaffProfile();
                setSelectedTimezone(profile?.timezone || 'UTC');
            } catch (error) {
                console.error('Error loading location settings:', error);
                setErrorMessage(error instanceof Error ? error.message : 'Location settings could not load.');
            } finally {
                setIsLoading(false);
            }
        };
        loadSettings();
    }, []);

    useEffect(() => {
        if (!isDropdownOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!dropdownRef.current?.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isDropdownOpen]);

    const handleTimezoneSelect = async (timezone: string) => {
        setSelectedTimezone(timezone);
        setStatusMessage(null);
        setErrorMessage(null);

        try {
            const staffId = supabaseDb.getCurrentStaffId();
            if (!staffId) {
                throw new Error('Staff profile is not available. Please sign in again.');
            }

            const { error } = await supabase
                .from('scheduling_staff_profiles')
                .update({ timezone })
                .eq('id', staffId);

            if (error) throw error;

            setStatusMessage('Timezone saved.');
        } catch (error) {
            console.error('Failed to update timezone:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Timezone could not be updated.');
        }

        setIsDropdownOpen(false);
    };

    const selectedTimezoneLabel = COMMON_TIMEZONES.find(tz => tz.value === selectedTimezone)?.label || selectedTimezone;

    if (isLoading) {
        return (
            <div className="rounded-xl border border-primary-border bg-white p-10 text-center shadow-lg dark:border-primary/20 dark:bg-darkcard">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
                <p className="mt-4 text-sm text-primary-text-muted">Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 animate-fade-in flex-col overflow-hidden rounded-xl border border-primary-border bg-white shadow-lg dark:border-primary/20 dark:bg-darkcard">
            <div className="flex flex-col justify-between gap-4 border-b border-primary-border/70 px-5 py-3 dark:border-primary/15 md:flex-row md:items-center">
                <div>
                    <p className="text-sm font-medium text-[var(--text-muted)]">
                        Set the timezone SLOTZ uses for your scheduling workspace.
                    </p>
                </div>
                <div className="slotz-settings-control flex items-center gap-3 rounded-lg px-3 py-2">
                    <MapPinIcon className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                        <p className="slotz-settings-label text-[10px] font-semibold uppercase tracking-[0.16em]">Current timezone</p>
                        <p className="mt-0.5 truncate text-sm font-medium text-[var(--text-secondary)] dark:text-white">{selectedTimezoneLabel}</p>
                    </div>
                </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(20rem,1fr)]">
                <div className="slotz-settings-row flex flex-col justify-between p-4">
                    <div>
                        <h4 className="text-base font-semibold tracking-tight text-[var(--text-secondary)] dark:text-white">Scheduling Location</h4>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--text-muted)]">
                            This timezone controls staff availability, manual booking times, calendar views, and public booking slots.
                        </p>
                    </div>
                    <p className="slotz-settings-label mt-6 text-xs font-medium leading-relaxed">
                        Keep this aligned with the calendar account you connect in Integrations.
                    </p>
                </div>

                <div className="slotz-settings-row p-4">
                    <label className="slotz-settings-label mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em]">Timezone</label>
                    <div className="relative" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="flex min-h-12 w-full items-center justify-between rounded-xl border border-primary-border bg-primary-light/50 px-4 py-3 text-left text-base font-normal text-[var(--text-secondary)] outline-none transition-all hover:border-primary/40 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 dark:border-primary/25 dark:bg-darkbg/50 dark:text-white"
                            aria-haspopup="listbox"
                            aria-expanded={isDropdownOpen}
                        >
                            <span className="truncate pr-4">{selectedTimezoneLabel}</span>
                            <ChevronDownIcon className={`h-4 w-4 text-primary-text-muted transition-transform dark:text-white/60 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isDropdownOpen && (
                            <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-primary-border bg-white p-1 shadow-xl shadow-black/10 dark:border-primary/25 dark:bg-[#201936] dark:shadow-black/30" role="listbox">
                                {COMMON_TIMEZONES.map(timezone => {
                                    const isSelected = timezone.value === selectedTimezone;
                                    return (
                                        <button
                                            key={timezone.value}
                                            type="button"
                                            onClick={() => handleTimezoneSelect(timezone.value)}
                                            className={`min-h-10 w-full rounded-lg px-3 py-2 text-left text-sm font-normal transition-colors ${
                                                isSelected
                                                    ? 'bg-primary text-white'
                                                    : 'text-[var(--text-secondary)] hover:bg-primary-light dark:text-white/80 dark:hover:bg-primary/15'
                                            }`}
                                            role="option"
                                            aria-selected={isSelected}
                                        >
                                            {timezone.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {statusMessage && (
                        <div role="status" className="slotz-notice mt-3 px-3 py-2 text-xs font-medium">
                            {statusMessage}
                        </div>
                    )}
                    {errorMessage && (
                        <div role="alert" className="slotz-notice slotz-notice-error mt-3 px-3 py-2 text-xs font-medium">
                            {errorMessage}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GlobalSettingsEditor;
