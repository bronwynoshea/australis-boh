import React, { useState, useEffect } from 'react';
import { supabaseDb } from '../services/supabaseDb';
import { SchedulingAvailabilityRule } from '../types';
import { CopyIcon, ClockIcon, MapPinIcon } from './Icons';
import TimePickerModal from './TimePickerModal';
import GlobalSettingsEditor from './GlobalSettingsEditor';

const formatDisplayTime = (timeStr: string): string => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 === 0 ? 12 : h % 12;
    const minute = m.toString().padStart(2, '0');
    return `${hour}:${minute} ${ampm}`;
};

const AvailabilityEditor: React.FC = () => {
    const [activeSection, setActiveSection] = useState<'schedule' | 'location'>('schedule');
    const [rules, setRules] = useState<SchedulingAvailabilityRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [pendingApplyDay, setPendingApplyDay] = useState<number | null>(null);
    const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<{ rule: SchedulingAvailabilityRule, field: 'start_time' | 'end_time'} | null>(null);

    useEffect(() => {
        let isMounted = true;
        const timeout = window.setTimeout(() => {
            if (isMounted) {
                setErrorMessage('Availability could not load. Please refresh or sign in again.');
                setIsLoading(false);
            }
        }, 8000);

        const loadRules = async () => {
            try {
                const data = await supabaseDb.getAvailabilityRules();
                // Create rules for all days, using defaults for missing ones
                const allDayRules = weekDays.map((_day, index) => {
                    const existingRule = data.find(rule => rule.day_of_week === index);
                    if (existingRule) {
                        return existingRule;
                    }
                    // Create a default rule for missing days
                    return {
                        id: `temp-${index}`,
                        staff_id: 'temp',
                        day_of_week: index,
                        start_time: '12:00:00',
                        end_time: '18:00:00',
                        is_enabled: false,
                        timezone: null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    } as SchedulingAvailabilityRule;
                });
                if (isMounted) {
                    setRules(allDayRules.sort((a,b) => a.day_of_week - b.day_of_week));
                    setErrorMessage(null);
                }
            } catch (error) {
                console.error('Error loading availability rules:', error);
                if (isMounted) {
                    setErrorMessage(error instanceof Error ? error.message : 'Availability could not load.');
                }
            } finally {
                window.clearTimeout(timeout);
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };
        loadRules();

        return () => {
            isMounted = false;
            window.clearTimeout(timeout);
        };
    }, []);

    const handleToggle = async (rule: SchedulingAvailabilityRule) => {
        const newIsEnabled = !rule.is_enabled;
        
        // If this is a temporary rule, create it in the database first
        if (rule.id.startsWith('temp-')) {
            try {
                const staffId = supabaseDb.getCurrentStaffId();
                if (!staffId) {
                    throw new Error('Staff session could not be restored. Please sign in again.');
                }
                const newRule = await supabaseDb.createAvailabilityRule({
                    staff_id: staffId,
                    day_of_week: rule.day_of_week,
                    start_time: rule.start_time,
                    end_time: rule.end_time,
                    is_enabled: newIsEnabled,
                    timezone: rule.timezone
                });
                
                // Replace the temporary rule with the real one
                setRules(rules.map(r => r.id === rule.id ? { ...newRule, is_enabled: newIsEnabled } : r));
            } catch (error) {
                console.error('Error creating availability rule:', error);
                return;
            }
        } else {
            // Update existing rule
            try {
                await supabaseDb.updateAvailabilityRule(rule.id, { is_enabled: newIsEnabled });
                setRules(rules.map(r => r.id === rule.id ? { ...r, is_enabled: newIsEnabled } : r));
                setErrorMessage(null);
            } catch (error) {
                console.error('Error updating availability rule:', error);
                setErrorMessage(error instanceof Error ? error.message : 'Availability could not be updated.');
            }
        }
    };

    const handleTimeChange = async (ruleId: string, field: 'start_time' | 'end_time', value: string) => {
        try {
            await supabaseDb.updateAvailabilityRule(ruleId, { [field]: value });
            setRules(rules.map(r => r.id === ruleId ? { ...r, [field]: value } : r));
            setErrorMessage(null);
        } catch (error) {
            console.error('Error updating availability time:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Availability time could not be updated.');
        }
    };

    const handleApplyToAll = async (sourceRule: SchedulingAvailabilityRule) => {
        const { start_time, end_time } = sourceRule;
        const updatedRules = rules.map(rule => ({ ...rule, start_time, end_time, is_enabled: true }));
        
        try {
            await Promise.all(
                rules
                    .filter(rule => !rule.id.startsWith('temp-'))
                    .map(rule => supabaseDb.updateAvailabilityRule(rule.id, { start_time, end_time, is_enabled: true }))
            );
            setRules(updatedRules);
            setErrorMessage(null);
            setPendingApplyDay(null);
        } catch (error) {
            console.error('Error applying availability to all days:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Availability could not be copied to all days.');
        }
    };

    const openTimePicker = (rule: SchedulingAvailabilityRule, field: 'start_time' | 'end_time') => {
        setEditingRule({ rule, field });
        setIsTimePickerOpen(true);
    };

    const onTimeSelect = (time: string) => {
        if (editingRule) {
            handleTimeChange(editingRule.rule.id, editingRule.field, time);
        }
        setIsTimePickerOpen(false);
        setEditingRule(null);
    };

    if (isLoading) {
        return (
            <div className="rounded-xl border border-primary-border bg-white p-8 text-center shadow-lg dark:border-primary/20 dark:bg-darkcard">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-sm font-medium text-[var(--text-muted)]">Loading availability...</p>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <TimePickerModal 
                isOpen={isTimePickerOpen}
                onClose={() => setIsTimePickerOpen(false)}
                onSelectTime={onTimeSelect}
                selectedValue={editingRule ? editingRule.rule[editingRule.field] : '09:00:00'}
            />
            <div className="mb-2 border-b border-primary-border dark:border-primary/20">
                <nav className="-mb-px flex gap-5" aria-label="Availability sections">
                <button
                    type="button"
                    onClick={() => setActiveSection('schedule')}
                    className={`flex min-h-9 items-center gap-2 border-b-2 px-1 text-sm font-semibold uppercase tracking-[0.12em] transition-colors ${
                        activeSection === 'schedule'
                            ? 'border-primary text-primary dark:text-white'
                            : 'border-transparent text-[var(--text-secondary)] hover:border-primary-border hover:text-primary dark:text-white/70 dark:hover:border-primary/30 dark:hover:text-white'
                    }`}
                >
                    <ClockIcon className="h-4 w-4" />
                    Work Schedule
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSection('location')}
                    className={`flex min-h-9 items-center gap-2 border-b-2 px-1 text-sm font-semibold uppercase tracking-[0.12em] transition-colors ${
                        activeSection === 'location'
                            ? 'border-primary text-primary dark:text-white'
                            : 'border-transparent text-[var(--text-secondary)] hover:border-primary-border hover:text-primary dark:text-white/70 dark:hover:border-primary/30 dark:hover:text-white'
                    }`}
                >
                    <MapPinIcon className="h-4 w-4" />
                    Location
                </button>
                </nav>
            </div>
            <div className="min-h-0 flex-1">
            {activeSection === 'location' ? (
                <GlobalSettingsEditor />
            ) : (
            <div className="flex h-full min-h-0 animate-fade-in flex-col overflow-hidden rounded-xl border border-primary-border bg-white shadow-lg dark:border-primary/20 dark:bg-darkcard">
                <div className="border-b border-primary-border/70 px-5 py-2.5 dark:border-primary/15">
                    <p className="text-sm font-medium text-[var(--text-muted)]">Set your standard weekly hours for public bookings.</p>
                    {errorMessage && (
                        <div role="alert" className="slotz-notice slotz-notice-error mt-3 px-3.5 py-2.5 text-sm font-medium">
                            {errorMessage}
                        </div>
                    )}
                </div>
                <div className="min-h-0 flex-1 divide-y divide-primary-border/50 overflow-y-auto dark:divide-primary/12">
                    {rules.map(rule => (
                        <div key={rule.id} className="min-h-[7rem] bg-transparent px-5 py-2.5 md:min-h-[3.625rem] md:py-2">
                            <div className="md:flex md:items-center md:justify-between md:gap-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <label className="relative inline-flex cursor-pointer items-center">
                                            <input type="checkbox" checked={rule.is_enabled} onChange={() => handleToggle(rule)} aria-label={`${weekDays[rule.day_of_week]} availability`} className="sr-only peer" />
                                            <div className="h-6 w-11 rounded-full border border-primary/25 bg-primary-light transition-colors peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/15 peer-checked:border-primary peer-checked:bg-primary dark:border-primary/30 dark:bg-primary/12 dark:peer-checked:bg-primary after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-primary/55 after:transition-all after:content-[''] peer-checked:after:translate-x-5 peer-checked:after:bg-white"></div>
                                        </label>
                                        <span className="min-w-24 text-sm font-semibold text-[var(--text-secondary)] dark:text-white">{weekDays[rule.day_of_week]}</span>
                                    </div>
                                    {rule.is_enabled && (
                                        <button onClick={() => setPendingApplyDay(rule.day_of_week)} aria-label={`Prepare to copy ${weekDays[rule.day_of_week]} hours to every day`} className="rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary transition-colors hover:border-primary/35 hover:bg-primary/15 dark:border-primary/25 dark:bg-primary/12 dark:text-primary-light dark:hover:bg-primary/18 md:hidden">
                                            <CopyIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {rule.is_enabled ? (
                                    <div className="mt-4 md:mt-0">
                                        {/* Mobile Time Buttons */}
                                        <div className="md:hidden space-y-2">
                                            <div className="grid grid-cols-[3.5rem_1fr] items-center gap-x-3">
                                                <label className="text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">From</label>
                                                <button type="button" onClick={() => openTimePicker(rule, 'start_time')} aria-label={`${weekDays[rule.day_of_week]} start time`} className="w-full rounded-lg border border-primary-border bg-white px-3 py-2 text-sm font-medium text-[var(--text-secondary)] dark:border-primary/20 dark:bg-darkbg/40 dark:text-white">{formatDisplayTime(rule.start_time)}</button>
                                            </div>
                                            <div className="grid grid-cols-[3.5rem_1fr] items-center gap-x-3">
                                                <label className="text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">To</label>
                                                <button type="button" onClick={() => openTimePicker(rule, 'end_time')} aria-label={`${weekDays[rule.day_of_week]} end time`} className="w-full rounded-lg border border-primary-border bg-white px-3 py-2 text-sm font-medium text-[var(--text-secondary)] dark:border-primary/20 dark:bg-darkbg/40 dark:text-white">{formatDisplayTime(rule.end_time)}</button>
                                            </div>
                                        </div>
                                        {/* Desktop Time Buttons */}
                                        <div className="hidden md:flex items-center gap-x-2">
                                            <button type="button" onClick={() => openTimePicker(rule, 'start_time')} aria-label={`${weekDays[rule.day_of_week]} start time`} className="w-28 rounded-lg border border-primary-border bg-primary-light/40 px-3 py-2 text-center text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-primary/35 dark:border-primary/20 dark:bg-primary/10 dark:text-white">{formatDisplayTime(rule.start_time)}</button>
                                            <span className="text-sm font-medium text-[var(--text-muted)]">to</span>
                                            <button type="button" onClick={() => openTimePicker(rule, 'end_time')} aria-label={`${weekDays[rule.day_of_week]} end time`} className="w-28 rounded-lg border border-primary-border bg-primary-light/40 px-3 py-2 text-center text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-primary/35 dark:border-primary/20 dark:bg-primary/10 dark:text-white">{formatDisplayTime(rule.end_time)}</button>
                                            {pendingApplyDay === rule.day_of_week ? (
                                                <div className="flex items-center gap-1.5">
                                                    <button onClick={() => handleApplyToAll(rule)} className="min-h-10 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-dark">
                                                        Apply
                                                    </button>
                                                    <button onClick={() => setPendingApplyDay(null)} className="min-h-10 rounded-lg border border-primary/20 bg-primary-light/30 px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-primary/35 dark:border-primary/20 dark:bg-primary/10 dark:text-white">
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={() => setPendingApplyDay(rule.day_of_week)} aria-label={`Prepare to copy ${weekDays[rule.day_of_week]} hours to every day`} className="flex min-h-10 items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:border-primary/35 hover:bg-primary/15 dark:border-primary/25 dark:bg-primary/12 dark:text-primary-light dark:hover:bg-primary/18">
                                                    <CopyIcon className="h-4 w-4" />
                                                    Copy hours
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-4 md:mt-0">
                                        <div className="md:hidden space-y-2">
                                            <div className="grid grid-cols-[3.5rem_1fr] items-center gap-x-3">
                                                <span className="text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">From</span>
                                                <span className="w-full rounded-lg border border-primary-border bg-primary-light/25 px-3 py-2 text-sm font-medium text-[var(--text-muted)] dark:border-primary/15 dark:bg-primary/[0.06]">Unavailable</span>
                                            </div>
                                            <div className="grid grid-cols-[3.5rem_1fr] items-center gap-x-3">
                                                <span className="text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">To</span>
                                                <span className="w-full rounded-lg border border-primary-border bg-primary-light/25 px-3 py-2 text-sm font-medium text-[var(--text-muted)] dark:border-primary/15 dark:bg-primary/[0.06]">Unavailable</span>
                                            </div>
                                        </div>
                                        <div className="hidden md:flex min-w-[23rem] items-center justify-end">
                                            <span className="rounded-lg border border-primary-border bg-primary-light/25 px-3 py-2 text-sm font-medium text-[var(--text-muted)] dark:border-primary/15 dark:bg-primary/[0.06]">Unavailable</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {rule.is_enabled && pendingApplyDay === rule.day_of_week && (
                                <div className="mt-3 rounded-lg border border-primary/20 bg-primary-light/35 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] dark:border-primary/20 dark:bg-primary/10 dark:text-white md:hidden">
                                    <p>Apply {formatDisplayTime(rule.start_time)} to {formatDisplayTime(rule.end_time)} to every day?</p>
                                    <div className="mt-2 flex gap-2">
                                        <button onClick={() => handleApplyToAll(rule)} className="min-h-9 rounded-lg bg-primary px-3 font-semibold text-white">Apply</button>
                                        <button onClick={() => setPendingApplyDay(null)} className="min-h-9 rounded-lg border border-primary/20 bg-primary-light/30 px-3 font-semibold text-[var(--text-secondary)] dark:border-primary/20 dark:bg-primary/10 dark:text-white">Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            )}
            </div>
        </div>
    );
};

export default AvailabilityEditor;
