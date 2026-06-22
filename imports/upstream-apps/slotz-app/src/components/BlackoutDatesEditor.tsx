import React, { useState, useEffect } from 'react';
import { supabaseDb } from '../services/supabaseDb';
import { SchedulingBlackoutDate } from '../types';
import { formatDate, addDays } from '../utils/dateUtils';
import { TrashIcon, CalendarOffIcon, PlusIcon } from './Icons';
import Calendar from './Calendar';
import PublicHolidaysModal from './PublicHolidaysModal';

interface BlackoutDatesEditorProps {
    setFeedback: (message: string) => void;
}

const BlackoutDatesEditor: React.FC<BlackoutDatesEditorProps> = ({ setFeedback }) => {
    const [blackoutDates, setBlackoutDates] = useState<SchedulingBlackoutDate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [rangeStart, setRangeStart] = useState<Date | null>(null);
    const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
    const [isHolidaysModalOpen, setIsHolidaysModalOpen] = useState(false);
    const [confirmClearAll, setConfirmClearAll] = useState(false);
    const [timeOffMessage, setTimeOffMessage] = useState<string | null>(null);

    useEffect(() => {
        const loadBlackoutDates = async () => {
            try {
                const dates = await supabaseDb.getBlackoutDates();
                setBlackoutDates(dates);
            } catch (error) {
                console.error('Error loading blackout dates:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadBlackoutDates();
    }, []);

    const handleDateSelect = (date: Date) => {
        if (!rangeStart || (rangeStart && rangeEnd && rangeStart !== rangeEnd)) {
            setRangeStart(date);
            setRangeEnd(date);
        } else if (rangeStart && rangeEnd && isSameDay(rangeStart, rangeEnd)) {
            if (date < rangeStart) {
                setRangeStart(date);
            } else {
                setRangeEnd(date);
            }
        }
    };
    
    const isSameDay = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();
    
    const handleAddRange = async () => {
        if (!rangeStart || !rangeEnd) return;
        
        let current = new Date(rangeStart);
        let addedCount = 0;
        
        while (current <= rangeEnd) {
            const dateString = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
            const existing = blackoutDates.some(bd => bd.date === dateString);
            if (!existing) {
                await supabaseDb.addBlackoutDate(dateString);
                addedCount++;
            }
            current = addDays(current, 1);
        }
        
        const updatedDates = await supabaseDb.getBlackoutDates();
        setBlackoutDates(updatedDates);
        setTimeOffMessage(null);
        setRangeStart(null);
        setRangeEnd(null);
        
        if (addedCount > 0) {
            setFeedback(`${addedCount} day(s) added to time off.`);
        } else {
            setFeedback(`Selected dates are already blocked.`);
        }
    };

    const handleDeleteDate = async (id: string) => {
        await supabaseDb.deleteBlackoutDate(id);
        const updatedDates = await supabaseDb.getBlackoutDates();
        setBlackoutDates(updatedDates);
        setTimeOffMessage("Time off removed.");
    };

    const handleClearAll = async () => {
        if (!confirmClearAll) {
            setConfirmClearAll(true);
            return;
        }

        await supabaseDb.deleteAllBlackoutDates();
        setBlackoutDates([]);
        setRangeStart(null);
        setRangeEnd(null);
        setConfirmClearAll(false);
        setTimeOffMessage("All time off entries removed.");
    };
    
    const handleAddSelectedHolidays = async (dates: Date[]) => {
        if (dates.length === 0) return;

        let addedCount = 0;
        
        for (const date of dates) {
            const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const existing = blackoutDates.some(bd => bd.date === dateString);
            if (!existing) {
                await supabaseDb.addBlackoutDate(dateString);
                addedCount++;
            }
        }

        if (addedCount > 0) {
            const updatedDates = await supabaseDb.getBlackoutDates();
            setBlackoutDates(updatedDates);
            setTimeOffMessage(`${addedCount} public holiday(s) added as time off.`);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-darkcard p-10 rounded-3xl border border-primary-border dark:border-white/5 shadow-lg text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-sm text-primary-text-muted">Loading time off...</p>
            </div>
        );
    }

    return (
        <>
            <PublicHolidaysModal
                isOpen={isHolidaysModalOpen}
                onClose={() => setIsHolidaysModalOpen(false)}
                onAddHolidays={handleAddSelectedHolidays}
                year={new Date().getFullYear()}
                existingBlackoutDates={blackoutDates}
            />
            <div className="flex h-full min-h-0 animate-fade-in flex-col overflow-hidden rounded-xl border border-primary-border bg-white shadow-lg dark:border-primary/20 dark:bg-darkcard">
                <div className="flex flex-col justify-between gap-4 border-b border-primary-border/70 px-5 py-4 dark:border-primary/15 md:flex-row md:items-center">
                    <div>
                        <h3 className="text-xl font-semibold tracking-tight leading-none text-[var(--text-secondary)] dark:text-white">Time Off</h3>
                        <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">Block full days when you are unavailable for public bookings.</p>
                    </div>
                    <button onClick={() => setIsHolidaysModalOpen(true)} className="slotz-settings-control flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition-colors dark:text-white">
                        Add US Public Holidays
                    </button>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
                    <div className="min-w-0">
                        <h4 className="slotz-settings-label mb-2 text-[10px] font-semibold uppercase tracking-[0.16em]">Select date or range</h4>
                        <Calendar selectedDate={null} onSelectDate={handleDateSelect} rangeStartDate={rangeStart} rangeEndDate={rangeEnd} disablePastDates={false}/>
                    </div>
                    <div className="flex min-h-0 flex-col gap-3 lg:h-[24rem]">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="slotz-settings-control rounded-lg px-3 py-2">
                                <p className="slotz-settings-label text-[10px] font-semibold uppercase tracking-[0.16em]">From</p>
                                <p className="mt-1 truncate text-sm font-semibold text-[var(--text-secondary)] dark:text-white">
                                    {rangeStart ? formatDate(rangeStart) : <span className="text-primary-text-muted/70 dark:text-white/55">Select start</span>}
                                </p>
                            </div>
                            <div className="slotz-settings-control rounded-lg px-3 py-2">
                                <p className="slotz-settings-label text-[10px] font-semibold uppercase tracking-[0.16em]">To</p>
                                <p className="mt-1 truncate text-sm font-semibold text-[var(--text-secondary)] dark:text-white">
                                    {rangeEnd ? formatDate(rangeEnd) : <span className="text-primary-text-muted/70 dark:text-white/55">Select end</span>}
                                </p>
                            </div>
                        </div>

                        <button onClick={handleAddRange} disabled={!rangeStart} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">
                            <PlusIcon className="w-4 h-4"/> Add Selected Dates
                        </button>

                        <div className="slotz-settings-row flex min-h-0 flex-1 basis-0 flex-col overflow-hidden p-3">
                            <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
                                <h4 className="slotz-settings-label flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
                                    <CalendarOffIcon className="w-4 h-4" />
                                    Upcoming Time Off
                                </h4>
                                {blackoutDates.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleClearAll}
                                        onBlur={() => setConfirmClearAll(false)}
                                        className="slotz-danger-action rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors"
                                    >
                                        {confirmClearAll ? 'Confirm clear' : 'Clear all'}
                                    </button>
                                )}
                            </div>
                            {timeOffMessage && (
                                <div role="status" className="slotz-notice mb-2 shrink-0 px-3 py-2 text-xs font-medium">
                                    {timeOffMessage}
                                </div>
                            )}
                            {blackoutDates.length > 0 ? (
                                <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-2 pr-1">
                                    {blackoutDates
                                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                        .map(bd => (
                                        <li key={bd.id} className="slotz-settings-control flex items-center justify-between rounded-lg px-3 py-2">
                                            <span className="text-sm font-semibold text-[var(--text-secondary)] dark:text-white">{formatDate(new Date(bd.date + 'T00:00:00'))}</span>
                                            <button onClick={() => handleDeleteDate(bd.id)} aria-label={`Remove time off for ${formatDate(new Date(bd.date + 'T00:00:00'))}`} className="slotz-danger-action rounded-lg p-1.5 transition-colors">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="slotz-settings-control flex min-h-0 flex-1 items-center justify-center rounded-lg px-4 py-6 text-center text-sm font-medium text-[var(--text-muted)]">
                                    No time off scheduled.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default BlackoutDatesEditor;
