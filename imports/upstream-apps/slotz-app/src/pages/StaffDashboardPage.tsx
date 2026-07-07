import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Page, SettingsPage } from '../App';
import { supabaseDb } from '../services/supabaseDb';
import { supabase } from '../services/supabaseClient';
import { invokeStaffFunction } from '../services/slotzFunctions';
import { SchedulingBooking, BookingStatus, SchedulingMeetingType, SchedulingStaffProfile } from '../types';
import { isSameDay, getWeekStartDate, addDays, getMonthStartDate, addMonths } from '../utils/dateUtils';
import { AlertTriangleIcon, CalendarIcon, ChevronLeft, ChevronRight, PlusIcon, HistoryIcon } from '../components/Icons';
import WeeklyCalendar from '../components/WeeklyCalendar';
import MobileWeeklyAgenda from '../components/MobileWeeklyAgenda';
import MonthlyCalendar from '../components/MonthlyCalendar';
import Legends from '../components/Legends';
import BookingDetailModal from '../components/BookingDetailModal';
import IntegratedFooter from '../components/IntegratedFooter';
import ManualBookingModal from '../components/ManualBookingModal';
import BookingHistoryList from '../components/BookingHistoryList';
import AngledLogo from '../components/AngledLogo';

type CalendarView = 'day' | 'week' | 'month';
type BookingFilter = 'calendar' | 'upcoming' | 'history';
type OutlookHealth = {
    status: 'connected' | 'needs_attention' | 'not_connected';
    message: string;
    accountEmail?: string | null;
    lastSyncAt?: string | null;
};

const getRescheduleSourceKey = (booking: SchedulingBooking) => {
    if (!booking.previous_start_time) return null;
    return [
        (booking.guest_email || '').trim().toLowerCase(),
        booking.meeting_type_id,
        new Date(booking.previous_start_time).toISOString(),
        booking.previous_end_time ? new Date(booking.previous_end_time).toISOString() : ''
    ].join('|');
};

const getBookingInstanceKey = (booking: SchedulingBooking) => [
    (booking.guest_email || '').trim().toLowerCase(),
    booking.meeting_type_id,
    new Date(booking.start_time).toISOString(),
    booking.end_time ? new Date(booking.end_time).toISOString() : ''
].join('|');

const filterSupersededReschedules = (bookings: SchedulingBooking[]) => {
    const supersededKeys = new Set(
        bookings
            .map(getRescheduleSourceKey)
            .filter((key): key is string => Boolean(key))
    );

    return bookings.filter(booking => {
        const normalizedStatus = String(booking.status || '').trim().toLowerCase();
        if (normalizedStatus === BookingStatus.RESCHEDULED) return false;
        return !supersededKeys.has(getBookingInstanceKey(booking));
    });
};

const isExternalCalendarOnlyEvent = (booking: SchedulingBooking) => (
    Boolean(booking.external_event_id) &&
    booking.external_calendar_provider === 'outlook' &&
    (!booking.guest_name || booking.guest_name.trim() === '')
);

interface StaffDashboardPageProps {
    setFeedback: (message: string) => void;
    navigate: (page: Page) => void;
    setInitialTab: (tab: SettingsPage) => void;
    onRescheduleBooking: (booking: SchedulingBooking, meetingType: SchedulingMeetingType | null) => void;
}

const StaffDashboardPage: React.FC<StaffDashboardPageProps> = ({ setFeedback, navigate, setInitialTab, onRescheduleBooking }) => {
    const [calendarView, setCalendarView] = useState<CalendarView>('week');
    const [selectedDayDate, setSelectedDayDate] = useState(new Date());
    const [bookingFilter, setBookingFilter] = useState<BookingFilter>('calendar');
    const [weekStartDate, setWeekStartDate] = useState(getWeekStartDate(new Date()));
    const [currentMonthDate, setCurrentMonthDate] = useState(getMonthStartDate(new Date()));
    const [selectedBooking, setSelectedBooking] = useState<SchedulingBooking | null>(null);
    const [selectedDayItemKey, setSelectedDayItemKey] = useState<string | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isManualBookingOpen, setIsManualBookingOpen] = useState(false);
    const [dataVersion, setDataVersion] = useState(0);
    const [allBookings, setAllBookings] = useState<SchedulingBooking[]>([]);
    const [outlookEvents, setOutlookEvents] = useState<any[]>([]);
    const [meetingTypes, setMeetingTypes] = useState<SchedulingMeetingType[]>([]);
    const [availabilityRules, setAvailabilityRules] = useState<any[]>([]);
    const [staffProfile, setStaffProfile] = useState<SchedulingStaffProfile | null>(null);
    const [outlookHealth, setOutlookHealth] = useState<OutlookHealth | null>(null);
    const lastAutoSyncAttemptRef = useRef(0);

    useEffect(() => {
        const loadBookings = async () => {
            try {
                const [bookings, outlookSyncEvents] = await Promise.all([
                    supabaseDb.getBookings(),
                    supabaseDb.getOutlookEvents()
                ]);
                setAllBookings(bookings);
                setOutlookEvents(outlookSyncEvents);
            } catch (error) {
                console.error('Error loading bookings:', error);
            }
        };
        loadBookings();
    }, [dataVersion]);

    useEffect(() => {
        const loadStaffProfile = async () => {
            try {
                const profile = await supabaseDb.getStaffProfile();
                setStaffProfile(profile);
            } catch (error) {
                console.error('Error loading staff profile:', error);
            }
        };
        loadStaffProfile();
    }, []);

    useEffect(() => {
        const loadMeetingTypes = async () => {
            try {
                const types = await supabaseDb.getMeetingTypes();
                setMeetingTypes(types);
            } catch (error) {
                console.error('Error loading meeting types:', error);
            }
        };
        loadMeetingTypes();
    }, [dataVersion]);

    useEffect(() => {
        const loadAvailabilityRules = async () => {
            try {
                const rules = await supabaseDb.getAvailabilityRules();
                setAvailabilityRules(rules);
            } catch (error) {
                console.error('Error loading availability rules:', error);
            }
        };
        loadAvailabilityRules();
    }, [dataVersion]);

    useEffect(() => {
        const loadOutlookHealth = async () => {
            try {
                const [sync, token] = await Promise.all([
                    supabaseDb.getOutlookSync(),
                    supabaseDb.getOutlookTokens()
                ]);

                if (!sync?.is_enabled || !token) {
                    setOutlookHealth({
                        status: 'not_connected',
                        message: 'Outlook is not connected. Bookings still work, but calendar create, reschedule, and cancel updates will not sync.'
                    });
                    return;
                }

                const now = new Date();
                const accessExpiresAt = token.expires_at ? new Date(token.expires_at) : null;
                const refreshExpiresAt = token.refresh_token_expires_at ? new Date(token.refresh_token_expires_at) : null;

                if ((refreshExpiresAt && refreshExpiresAt <= now) || (!refreshExpiresAt && accessExpiresAt && accessExpiresAt <= now)) {
                    setOutlookHealth({
                        status: 'needs_attention',
                        message: 'Outlook sync needs reconnecting. Calendar changes may not reach Outlook until staff reconnects.',
                        accountEmail: token.account_username
                    });
                    return;
                }

                setOutlookHealth({
                    status: 'connected',
                    message: 'Outlook sync is connected.',
                    accountEmail: token.account_username,
                    lastSyncAt: sync.last_sync_at
                });
            } catch (error) {
                console.error('Error checking Outlook sync health:', error);
                setOutlookHealth({
                    status: 'needs_attention',
                    message: 'Outlook sync status could not be checked. Please review Integrations before relying on calendar sync.'
                });
            }
        };

        loadOutlookHealth();
    }, [dataVersion]);

    useEffect(() => {
        if (!staffProfile || outlookHealth?.status !== 'connected') return;

        let isCancelled = false;

        const runExternalCalendarSync = async () => {
            const now = Date.now();
            if (now - lastAutoSyncAttemptRef.current < 2 * 60 * 1000) return;
            lastAutoSyncAttemptRef.current = now;

            try {
                const { data, error } = await invokeStaffFunction<any>('slotz-calendar-sync');
                if (error || data?.success === false) {
                    throw new Error(data?.error || error?.message || 'External calendar sync failed.');
                }
                if (!isCancelled) {
                    setDataVersion(v => v + 1);
                }
            } catch (error) {
                console.error('External calendar sync failed:', error);
                if (!isCancelled) {
                    setOutlookHealth(prev => ({
                        status: 'needs_attention',
                        accountEmail: prev?.accountEmail,
                        lastSyncAt: prev?.lastSyncAt,
                        message: 'External calendar sync failed. Use Settings > Integrations > Sync now, or reconnect if this continues.'
                    }));
                }
            }
        };

        runExternalCalendarSync();
        const intervalId = window.setInterval(runExternalCalendarSync, 5 * 60 * 1000);
        const handleFocus = () => runExternalCalendarSync();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') runExternalCalendarSync();
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            isCancelled = true;
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [staffProfile, outlookHealth?.status]);

    const today = new Date();

    const { upcomingBookings, pastBookings, periodLabel, periodTitle, totalUpcomingBookings, todayBookings, weekBookingsCount, periodBookings, periodOutlookEvents } = useMemo(() => {
        const now = new Date();
        const displayBookings = filterSupersededReschedules(allBookings).filter(booking => !isExternalCalendarOnlyEvent(booking));
        const futureOutlookEvents = outlookEvents.filter(event => {
            const end = new Date(event.event_end_time || event.event_start_time);
            return !isNaN(end.getTime()) && end >= now;
        });
        const upcoming = displayBookings
            .filter(b => b.status === BookingStatus.CONFIRMED && new Date(b.end_time) > now)
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        
        const past = displayBookings
            .filter(b => {
                const bookingEnd = new Date(b.end_time);
                const normalizedStatus = String(b.status || '').trim().toLowerCase();
                const isCanceled = normalizedStatus.includes('cancel') || Boolean(b.cancellation_reason);
                return isCanceled || bookingEnd <= now; // All canceled bookings plus bookings that have ended
            })
            .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

        const todayBookings = upcoming.filter(b => isSameDay(new Date(b.start_time), today));
        
        let bookingsForPeriod: SchedulingBooking[];
        let outlookForPeriod: any[];
        let periodLabelText: string;
        let periodTitleText: string;

        if (calendarView === 'day') {
            const dayStart = new Date(selectedDayDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = addDays(dayStart, 1);
            bookingsForPeriod = displayBookings.filter(b => {
                if (b.status !== BookingStatus.CONFIRMED) return false;
                const bookingDate = new Date(b.start_time);
                return bookingDate >= dayStart && bookingDate < dayEnd;
            });
            outlookForPeriod = futureOutlookEvents.filter(event => {
                const eventDate = new Date(event.event_start_time);
                return eventDate >= dayStart && eventDate < dayEnd;
            });
            periodLabelText = "Selected Day";
            periodTitleText = selectedDayDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        } else if (calendarView === 'week') {
            const weekEndDate = addDays(weekStartDate, 7);
            // Show ALL confirmed bookings for the week (past, present, future)
            bookingsForPeriod = displayBookings.filter(b => {
                if (b.status !== BookingStatus.CONFIRMED) return false;
                
                const bookingDate = new Date(b.start_time);
                const isInWeek = bookingDate >= weekStartDate && bookingDate < weekEndDate;
                
                return isInWeek;
            });
            outlookForPeriod = futureOutlookEvents.filter(event => {
                const eventDate = new Date(event.event_start_time);
                return eventDate >= weekStartDate && eventDate < weekEndDate;
            });
            periodLabelText = "This Week";
            periodTitleText = `${weekStartDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${addDays(weekStartDate, 6).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } else { // month view
            const monthEndDate = addDays(addMonths(currentMonthDate, 1), 0);
            // Show ALL confirmed bookings for the month
            bookingsForPeriod = displayBookings.filter(b => {
                if (b.status !== BookingStatus.CONFIRMED) return false;
                
                const bookingDate = new Date(b.start_time);
                return bookingDate >= currentMonthDate && bookingDate < monthEndDate;
            });
            outlookForPeriod = futureOutlookEvents.filter(event => {
                const eventDate = new Date(event.event_start_time);
                return eventDate >= currentMonthDate && eventDate < monthEndDate;
            });
            periodLabelText = "This Month";
            periodTitleText = currentMonthDate.toLocaleDateString([], { month: 'long', year: 'numeric' });
        }

        return {
            upcomingBookings: upcoming,
            pastBookings: past,
            periodLabel: periodLabelText,
            periodTitle: periodTitleText,
            totalUpcomingBookings: upcoming.length,
            todayBookings: todayBookings.length,
            weekBookingsCount: bookingsForPeriod.length,
            periodBookings: bookingsForPeriod,
            periodOutlookEvents: outlookForPeriod
        };
    }, [allBookings, outlookEvents, calendarView, selectedDayDate, weekStartDate, currentMonthDate, today]);

    const handlePrev = () => {
        if (calendarView === 'day') setSelectedDayDate(addDays(selectedDayDate, -1));
        else if (calendarView === 'week') setWeekStartDate(addDays(weekStartDate, -7));
        else setCurrentMonthDate(addMonths(currentMonthDate, -1));
    };
    const handleNext = () => {
        if (calendarView === 'day') setSelectedDayDate(addDays(selectedDayDate, 1));
        else if (calendarView === 'week') setWeekStartDate(addDays(weekStartDate, 7));
        else setCurrentMonthDate(addMonths(currentMonthDate, 1));
    };
    const handleGoToToday = () => {
        setSelectedDayDate(new Date());
        setWeekStartDate(getWeekStartDate(new Date()));
        setCurrentMonthDate(getMonthStartDate(new Date()));
    };
    const handleDateSelectFromMonth = (date: Date) => {
        setSelectedDayDate(date);
        setCalendarView('day');
        setWeekStartDate(getWeekStartDate(date));
    };
    const handleViewBookingDetails = (booking: SchedulingBooking) => {
        setSelectedBooking(booking);
        setIsDetailModalOpen(true);
    };
    const handleCloseModal = () => {
        setIsDetailModalOpen(false);
        setSelectedBooking(null);
    };
    const handleCancelBooking = async (bookingId: string) => {
        try {
            const cancelledBooking = await supabaseDb.cancelBooking(bookingId);
            if (!cancelledBooking) {
                setFeedback('We could not cancel this appointment. Please try again.');
                return;
            }
            setFeedback('Appointment canceled. Guest has been notified where email delivery is configured.');
            setDataVersion(v => v + 1);
            handleCloseModal();
            return;
        } catch (error) {
            console.error('Error cancelling booking:', error);
            setFeedback('We could not cancel this appointment. Please try again.');
            return;
        }

        const booking = await supabaseDb.getBookingById(bookingId);
        if (!booking) return;

        if (booking.external_event_id && booking.external_calendar_provider === 'outlook') {
            // TODO: Implement deleteOutlookEvent in outlookService
            console.log('🗑️ Outlook event deletion not yet implemented:', booking.external_event_id);
        }
        
        // Send cancellation notice via Edge Function
        try {
            const { data, error } = await supabase.functions.invoke('slotz-send-cancellation-notice', {
                body: { bookingId }
            });
            
            if (error) {
                console.error('❌ Failed to send cancellation notice:', error);
                setFeedback('Appointment canceled, but email notification failed. Please notify the guest manually.');
            } else {
                console.log('✅ Cancellation notice sent:', data);
                setFeedback('Appointment canceled. Guest has been notified.');
            }
        } catch (error) {
            console.error('❌ Error calling cancellation Edge Function:', error);
            setFeedback('Appointment canceled, but email notification failed. Please notify the guest manually.');
        }
        
        await supabaseDb.updateBookingStatus(bookingId, BookingStatus.CANCELLED);
        setDataVersion(v => v + 1);
        handleCloseModal();
    };

    const handleRescheduleBooking = (booking: SchedulingBooking, meetingType: SchedulingMeetingType | null) => {
        handleCloseModal();
        onRescheduleBooking(booking, meetingType);
    };

    const renderMainContent = () => {
        const dayCalendarItems = [
            ...periodBookings.map(booking => ({
                kind: 'slotz' as const,
                id: booking.id,
                key: `slotz-${booking.id}`,
                start: new Date(booking.start_time),
                end: new Date(booking.end_time),
                title: booking.guest_name || 'SLOTZ booking',
                subtitle: 'SLOTZ booking',
                booking,
            })),
            ...periodOutlookEvents.map(event => ({
                kind: 'outlook' as const,
                id: event.id || event.outlook_event_id || `${event.event_start_time}-${event.event_subject}`,
                key: `external-${event.id || event.outlook_event_id || `${event.event_start_time}-${event.event_subject}`}`,
                start: new Date(event.event_start_time),
                end: new Date(event.event_end_time),
                title: event.event_subject || 'External Booking',
                subtitle: 'External Booking',
            })),
        ].sort((a, b) => a.start.getTime() - b.start.getTime());
        const selectedDayItem = dayCalendarItems.find(item => item.key === selectedDayItemKey) || dayCalendarItems[0] || null;
        const selectedDayMeetingType = selectedDayItem?.kind === 'slotz'
            ? meetingTypes.find(type => type.id === selectedDayItem.booking.meeting_type_id)
            : null;

        if (bookingFilter === 'calendar') {
            return (
                <div className="flex h-full min-h-0 flex-col gap-4">
                    <div className="flex flex-col gap-3 rounded-xl border border-primary-border bg-white/80 p-3 dark:border-primary/20 dark:bg-darkcard/80 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary-text-muted dark:text-white/50">{periodLabel}</p>
                            <h2 className="mt-1 text-base font-semibold text-[var(--text-secondary)] dark:text-white">{periodTitle}</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1 rounded-lg bg-primary-light p-1 dark:bg-white/5">
                                <button
                                    type="button"
                                    onClick={() => setCalendarView('day')}
                                    className={`min-h-8 rounded-md px-3 text-xs font-semibold transition-colors ${calendarView === 'day' ? 'bg-white text-[var(--text-secondary)] dark:bg-darkcard dark:text-white' : 'text-primary-text-muted dark:text-white/70'}`}
                                >
                                    Day
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCalendarView('week')}
                                    className={`min-h-8 rounded-md px-3 text-xs font-semibold transition-colors ${calendarView === 'week' ? 'bg-white text-[var(--text-secondary)] dark:bg-darkcard dark:text-white' : 'text-primary-text-muted dark:text-white/70'}`}
                                >
                                    Week
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCalendarView('month')}
                                    className={`min-h-8 rounded-md px-3 text-xs font-semibold transition-colors ${calendarView === 'month' ? 'bg-white text-[var(--text-secondary)] dark:bg-darkcard dark:text-white' : 'text-primary-text-muted dark:text-white/70'}`}
                                >
                                    Month
                                </button>
                            </div>
                            <div className="flex items-center gap-1">
                                <button type="button" onClick={handlePrev} className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary-border text-primary-text-muted transition-colors hover:bg-primary-light hover:text-primary dark:border-primary/25 dark:text-white/70 dark:hover:bg-primary/15" aria-label="Previous period">
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={handleGoToToday} className="slotz-today-button min-h-9 rounded-lg border px-3 text-xs font-semibold transition-colors">
                                    Today
                                </button>
                                <button type="button" onClick={handleNext} className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary-border text-primary-text-muted transition-colors hover:bg-primary-light hover:text-primary dark:border-primary/25 dark:text-white/70 dark:hover:bg-primary/15" aria-label="Next period">
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {calendarView === 'day' ? (
                        <div className="slotz-dashboard-panel grid overflow-hidden rounded-xl border border-primary-border bg-white shadow-lg dark:border-primary/20 dark:bg-darkcard lg:grid-cols-[minmax(0,1fr)_22rem]">
                            <div className="flex min-h-0 flex-col overflow-hidden border-b border-primary-border/60 dark:border-primary/20 lg:border-b-0 lg:border-r">
                                <div className="shrink-0 border-b border-primary-border/60 px-4 py-3 dark:border-primary/20">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-text-muted dark:text-white/50">
                                        {dayCalendarItems.length} {dayCalendarItems.length === 1 ? 'appt' : 'appts'}
                                    </p>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4">
                                    {dayCalendarItems.length > 0 ? (
                                        <ul className="space-y-3">
                                            {dayCalendarItems.map(item => {
                                                const isSelected = selectedDayItem?.key === item.key;
                                                return (
                                                    <li key={item.key} className="grid grid-cols-[4.5rem_1fr] gap-4">
                                                        <div className="pt-3 text-right text-xs font-semibold text-primary-text-muted dark:text-white/60">
                                                            {item.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedDayItemKey(item.key)}
                                                            className={`rounded-lg p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/18 dark:focus-visible:ring-primary/24 ${
                                                                item.kind === 'slotz'
                                                                    ? `border bg-primary-light/40 hover:bg-primary-light dark:bg-white/5 dark:hover:bg-primary/12 ${isSelected ? 'border-primary/45 dark:border-primary/45' : 'border-primary-border hover:border-primary/30 dark:border-primary/20'}`
                                                                    : `border slotz-external-row ${isSelected ? 'slotz-external-row-selected' : ''}`
                                                            }`}
                                                        >
                                                            <p className="text-sm font-normal">{item.title}</p>
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    ) : (
                                        <div className="py-16 text-center">
                                            <p className="text-sm font-semibold text-[var(--text-secondary)] dark:text-white">No calendar items on this day.</p>
                                            <p className="mt-2 text-sm font-medium text-primary-text-muted dark:text-white/55">Use Manual Booking to place a SLOTZ appointment, including times outside public availability.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <aside className="min-h-0 overflow-y-auto bg-primary-light/35 p-5 dark:bg-white/[0.03]">
                                {selectedDayItem ? (
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                                            {selectedDayItem.subtitle}
                                        </p>
                                        <h3 className="mt-2 text-xl font-medium tracking-tight text-[var(--text-secondary)]">
                                            {selectedDayItem.title}
                                        </h3>
                                        <p className="mt-2 text-sm font-normal text-[var(--text-muted)]">
                                            {selectedDayItem.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {selectedDayItem.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                        </p>

                                        {selectedDayItem.kind === 'slotz' ? (
                                            <div className="mt-6 space-y-4 text-sm">
                                                <div>
                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-text-muted dark:text-white/45">Meeting</p>
                                                    <p className="mt-1 font-medium text-[var(--text-secondary)] dark:text-white/86">{selectedDayMeetingType?.name || 'SLOTZ booking'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-text-muted dark:text-white/45">Guest</p>
                                                    <p className="mt-1 font-medium text-[var(--text-secondary)] dark:text-white/86">{selectedDayItem.booking.guest_email || 'No email recorded'}</p>
                                                </div>
                                                {selectedDayItem.booking.agenda_notes && (
                                                    <div>
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-text-muted dark:text-white/45">Notes</p>
                                                        <p className="mt-1 leading-relaxed text-primary-text-muted dark:text-white/72">{selectedDayItem.booking.agenda_notes}</p>
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleViewBookingDetails(selectedDayItem.booking)}
                                                    className="mt-2 min-h-10 w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                                                >
                                                    Open booking details
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="slotz-external-detail-note mt-6 rounded-lg border p-4 text-sm font-normal leading-relaxed">
                                                External Booking details are synced as availability context only. Manage this item in the connected calendar.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="py-12 text-center text-sm font-medium text-primary-text-muted dark:text-white/55">
                                        Select a calendar item to view details.
                                    </div>
                                )}
                            </aside>
                        </div>
                    ) : calendarView === 'week' ? (
                        <>
                            <div className="hidden md:block">
                                <WeeklyCalendar
                                    date={weekStartDate}
                                    bookings={periodBookings}
                                    outlookEvents={periodOutlookEvents}
                                    meetingTypes={meetingTypes}
                                    availabilityRules={availabilityRules}
                                    onSelectBooking={handleViewBookingDetails}
                                    timezone={staffProfile?.timezone || 'UTC'}
                                />
                            </div>
                            <div className="md:hidden">
                                <MobileWeeklyAgenda
                                    startDate={weekStartDate}
                                    bookings={periodBookings}
                                    onViewBookingDetails={handleViewBookingDetails}
                                />
                            </div>
                        </>
                    ) : (
                        <MonthlyCalendar
                            date={currentMonthDate}
                            bookings={periodBookings}
                            outlookEvents={periodOutlookEvents}
                            meetingTypes={meetingTypes}
                            onSelectDate={handleDateSelectFromMonth}
                        />
                    )}
                </div>
            );
        }

        if (bookingFilter === 'history') {
            return <BookingHistoryList bookings={pastBookings} onViewBookingDetails={handleViewBookingDetails} />;
        }

        return <BookingHistoryList bookings={upcomingBookings} onViewBookingDetails={handleViewBookingDetails} mode="upcoming" />;
    };

    return (
        <div className="w-full pt-4 px-4 md:px-8 animate-fade-in pb-8 flex flex-col flex-grow">
            <BookingDetailModal isOpen={isDetailModalOpen} booking={selectedBooking} onClose={handleCloseModal} onCancelBooking={handleCancelBooking} onRescheduleBooking={handleRescheduleBooking} />
            <ManualBookingModal 
                isOpen={isManualBookingOpen} 
                onClose={() => setIsManualBookingOpen(false)} 
                onBookingCreated={() => {
                    setDataVersion(v => v + 1);
                    setFeedback("Manual booking created successfully.");
                }}
            />
            
            {/* Show loading state until staff profile is loaded */}
            {!staffProfile ? (
                <div className="flex-grow flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-primary-text-muted">Loading profile...</p>
                    </div>
                </div>
            ) : (
                <div className="flex-grow">
                    <header className="flex flex-col md:flex-row md:items-end justify-between mb-4 gap-4 md:gap-8 text-[var(--text-secondary)] dark:text-white">
                        <div>
                            <div className="mb-2">
                                    <p className="text-sm font-medium text-[var(--text-muted)]">
                                        Welcome back, {staffProfile.full_name || 'Staff'}
                                    </p>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-none">
                                {bookingFilter === 'calendar' ? 'Schedule' : bookingFilter === 'upcoming' ? 'Upcoming Bookings' : 'Booking History'}
                            </h1>
                            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] md:text-sm">
                                {bookingFilter === 'calendar' ? 'SLOTZ and External Bookings in one calendar' : bookingFilter === 'upcoming' ? 'Confirmed SLOTZ bookings sorted by start time' : 'Past, canceled, and rescheduled SLOTZ bookings'}
                            </p>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center gap-4 md:justify-end">
                            <div className="flex flex-col md:flex-row items-center md:justify-start gap-4 order-2 md:order-1">
                                <div className="w-full md:w-auto flex items-center gap-1 bg-primary-light dark:bg-white/5 p-1 rounded-lg">
                                    <button onClick={() => setBookingFilter('calendar')} className={`min-h-8 flex-1 md:flex-none justify-center px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 ${bookingFilter === 'calendar' ? 'bg-white dark:bg-darkcard text-[var(--text-secondary)] dark:text-white' : 'text-primary-text-muted dark:!text-white/70'}`}>
                                        <CalendarIcon className="w-3 h-3"/>Calendar
                                    </button>
                                    <button onClick={() => setBookingFilter('upcoming')} className={`min-h-8 flex-1 md:flex-none justify-center px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 ${bookingFilter === 'upcoming' ? 'bg-white dark:bg-darkcard text-[var(--text-secondary)] dark:text-white' : 'text-primary-text-muted dark:!text-white/70'}`}>
                                        <CalendarIcon className="w-3 h-3"/>Upcoming
                                    </button>
                                    <button onClick={() => setBookingFilter('history')} className={`min-h-8 flex-1 md:flex-none justify-center px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 ${bookingFilter === 'history' ? 'bg-white dark:bg-darkcard text-[var(--text-secondary)] dark:text-white' : 'text-primary-text-muted dark:!text-white/70'}`}>
                                        <HistoryIcon className="w-3 h-3"/>History
                                    </button>
                                </div>

                            </div>
                        </div>
                    </header>

                    {outlookHealth && outlookHealth.status !== 'connected' && (
                        <div className="slotz-calendar-health-notice mb-6 rounded-2xl border p-4 shadow-sm">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="flex gap-3">
                                    <div className="mt-0.5 rounded-xl bg-white/15 p-2 text-white">
                                        <AlertTriangleIcon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">Calendar sync needs attention</p>
                                        <p className="mt-1 text-sm font-medium text-white/82">
                                            {outlookHealth.message}
                                        </p>
                                        {outlookHealth.accountEmail && (
                                            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/62">
                                                Account: {outlookHealth.accountEmail}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setInitialTab('integrations');
                                        navigate('staff-settings');
                                    }}
                                    className="self-start rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/12 md:self-center"
                                >
                                    Settings &gt; Integrations
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid min-h-0 grid-cols-1 items-stretch gap-6 md:gap-8 lg:grid-cols-12">
                        <div className="slotz-dashboard-sidebar flex min-h-0 flex-col lg:col-span-3">
                            <div className="slotz-today-card text-white p-6 rounded-xl shadow-xl relative overflow-hidden group">
                                <div className="relative z-10">
                                    <p className="text-white/50 font-semibold text-[10px] uppercase tracking-[0.3em] mb-2">Today</p>
                                    <h2 className="text-5xl md:text-6xl font-semibold tracking-tight leading-none">{todayBookings}</h2>
                                    <p className="text-white/80 font-medium mt-4 text-xs uppercase tracking-widest">{totalUpcomingBookings} Upcoming</p>
                                </div>
                                <div className="pointer-events-none absolute right-2 bottom-1 opacity-[0.28] transform rotate-6 scale-[2.25] group-hover:scale-[2.34] transition-transform duration-700">
                                    <AngledLogo size="lg" />
                                </div>
                            </div>
                            <button
                                onClick={() => setIsManualBookingOpen(true)}
                                className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] shadow-sm transition-all hover:border-primary/35 hover:bg-primary-light active:scale-95 dark:border-primary/25 dark:bg-white/5 dark:text-white dark:hover:bg-primary/12"
                            >
                                <PlusIcon className="w-4 h-4" />
                                Manual Booking
                            </button>
                            <div className="hidden lg:block">
                                <Legends />
                            </div>
                            <div className="hidden min-h-8 flex-1 lg:block" />
                            <div className="hidden border-t border-primary-border/30 pt-6 dark:border-primary/20 lg:block">
                                <IntegratedFooter alignment="left" />
                            </div>
                        </div>
                        <div className="flex h-full min-w-0 flex-col self-stretch lg:col-span-9">
                            {renderMainContent()}
                        </div>
                    </div>
                </div>
            )}
            <div className="lg:hidden">
                <IntegratedFooter className="mt-8" />
            </div>
        </div>
    );
};

export default StaffDashboardPage;
