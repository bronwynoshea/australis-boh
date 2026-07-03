import React, { useState, useEffect } from 'react';
import { SchedulingBooking, SchedulingMeetingType } from '../types';
import { supabaseDb } from '../services/supabaseDb';
import { formatDate, formatTime } from '../utils/dateUtils';
import IntegratedFooter from '../components/IntegratedFooter';
import { InfoIcon, SettingsIcon, CalendarIcon, ClockIcon, MailIcon, CalendarPlusIcon } from '../components/Icons';

interface ConfirmationPageProps {
    lastBooking: SchedulingBooking | null;
    handleBookAnother: () => void;
    isReschedule: boolean;
}

const createCalendarReminderArtifacts = (
    booking: SchedulingBooking | null,
    meetingType: SchedulingMeetingType | null,
    staffProfile: any
) => {
    if (!booking) return null;

    const startDate = new Date(booking.start_time);
    const endDate = new Date(booking.end_time);
    const hostName = staffProfile?.full_name || booking.scheduling_staff_profiles?.full_name;
    const reminderName = meetingType?.name || booking.scheduling_meeting_types?.name;
    const timezone = booking.guest_timezone;
    if (!timezone || !reminderName || !hostName) return null;

    const meetingLink = staffProfile?.meeting_link || booking.video_url || '';
    const manageUrl = `${window.location.origin}/#manage-${booking.id}`;
    const reminderTitle = `${reminderName} with ${hostName}`;
    const reminderDetails = [
        'Calendar reminder only.',
        `To reschedule or cancel, use SLOTZ: ${manageUrl}`,
        'Moving this calendar entry will not update SLOTZ or notify staff.',
        meetingLink ? `Join link: ${meetingLink}` : null,
        booking.agenda_notes ? `Notes: ${booking.agenda_notes}` : null
    ].filter(Boolean).join('\n\n');

    const sanitizeICS = (value: string) =>
        value
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/,/g, '\\,')
            .replace(/;/g, '\\;');

    const formatDateUTC = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//JOBZ CAFE//SLOTZ Calendar Reminder//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${booking.id}-reminder@jobzcafe.com`,
        `DTSTART:${formatDateUTC(startDate)}`,
        `DTEND:${formatDateUTC(endDate)}`,
        `DTSTAMP:${formatDateUTC(new Date(booking.updated_at || booking.created_at || booking.start_time))}`,
        `SUMMARY:${sanitizeICS(reminderTitle)}`,
        `DESCRIPTION:${sanitizeICS(reminderDetails)}`,
        'STATUS:CONFIRMED',
        'SEQUENCE:0',
        `LOCATION:${sanitizeICS(meetingLink || manageUrl)}`,
        `URL:${sanitizeICS(manageUrl)}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    const fileName = `SLOTZ_${reminderName.replace(/\s+/g, '_')}_${startDate.toISOString().split('T')[0]}_reminder.ics`;

    return { icsContent, fileName };
};

const ConfirmationPage: React.FC<ConfirmationPageProps> = ({ lastBooking, handleBookAnother, isReschedule }) => {
    const [meetingType, setMeetingType] = useState<SchedulingMeetingType | null>(null);
    const [staffProfile, setStaffProfile] = useState<any>(null);
    const [calendarReminderUrl, setCalendarReminderUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!lastBooking) return;

        const joinedMeetingType = lastBooking.scheduling_meeting_types || null;
        const joinedStaffProfile = lastBooking.scheduling_staff_profiles || null;
        setMeetingType(joinedMeetingType);
        setStaffProfile(joinedStaffProfile);

        if (joinedMeetingType && joinedStaffProfile) return;

        const loadData = async () => {
            try {
                if (supabaseDb.getCurrentStaffId()) {
                    const meetingTypes = await supabaseDb.getMeetingTypes(false);
                    const foundMeetingType = meetingTypes.find(m => m.id === lastBooking.meeting_type_id);
                    setMeetingType(joinedMeetingType || foundMeetingType || null);
                    
                    const staff = await supabaseDb.getStaffProfile();
                    setStaffProfile(joinedStaffProfile || staff);
                }
            } catch (error) {
                console.error('Error loading confirmation data:', error);
            }
        };
        loadData();
    }, [lastBooking]);

    const calendarReminderArtifacts = createCalendarReminderArtifacts(lastBooking, meetingType, staffProfile);

    useEffect(() => {
        if (!calendarReminderArtifacts?.icsContent) {
            setCalendarReminderUrl(null);
            return;
        }

        const blob = new Blob([calendarReminderArtifacts.icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        setCalendarReminderUrl(url);

        return () => URL.revokeObjectURL(url);
    }, [calendarReminderArtifacts?.icsContent]);

    if (!lastBooking) {
        return (
            <div className="max-w-2xl mx-auto py-20 px-4 text-center">
                <h1 className="text-2xl font-semibold mb-4">No booking information found.</h1>
                <p className="text-primary-text-muted">Please start a new booking.</p>
            </div>
        );
    }

    const guestTimezone = lastBooking.guest_timezone;
    const meetingName = meetingType?.name || lastBooking.scheduling_meeting_types?.name;

    return (
        <div className="w-full px-4 py-4 md:px-6 lg:px-8 lg:py-6 animate-fade-in flex flex-col flex-grow">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-stretch">
                <section className="h-full rounded-xl border border-primary-border bg-white p-5 shadow-sm dark:border-white/10 dark:bg-darkcard md:p-6">
                    <div className="mb-5 flex flex-col gap-3 border-b border-primary-border/70 pb-5 dark:border-white/10 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                                {isReschedule ? 'Session Updated' : 'Session Booked'}
                            </p>
                            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[var(--text-secondary)] dark:text-white md:text-4xl">
                                {isReschedule ? 'Your session is rescheduled.' : 'Your session is booked.'}
                            </h1>
                        </div>
                        <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-primary dark:border-primary/30 dark:bg-primary/15 dark:text-white">
                            <span className="h-2 w-2 rounded-full bg-primary" />
                            Confirmed
                        </div>
                    </div>

                    <p className="mb-6 max-w-2xl text-sm font-normal leading-relaxed text-[var(--text-muted)] dark:text-white/70">
                        {isReschedule
                            ? 'We have updated your session and sent the new details to your email.'
                            : 'We have sent the session details to your email. Use the SLOTZ link in that email if you need to make changes.'
                        }
                    </p>

                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl border border-primary-border/70 bg-primary-light/40 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <SettingsIcon className="h-4 w-4" />
                            </div>
                            <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)] dark:text-white/55">Type</p>
                            {meetingName ? (
                                <p className="text-base font-medium leading-snug text-[var(--text-secondary)] dark:text-white">{meetingName}</p>
                            ) : (
                                <p className="text-sm font-medium text-[var(--danger)]">Session type unavailable. Please refresh the manage link.</p>
                            )}
                        </div>
                        <div className="rounded-xl border border-primary-border/70 bg-primary-light/40 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <CalendarIcon className="h-4 w-4" />
                            </div>
                            <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)] dark:text-white/55">Date</p>
                            <p className="text-base font-medium leading-snug text-[var(--text-secondary)] dark:text-white">
                                {guestTimezone ? formatDate(new Date(lastBooking.start_time), guestTimezone) : 'Guest timezone unavailable'}
                            </p>
                        </div>
                        <div className="rounded-xl border border-primary-border/70 bg-primary-light/40 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <ClockIcon className="h-4 w-4" />
                            </div>
                            <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)] dark:text-white/55">Time</p>
                            <p className="text-base font-medium leading-snug text-[var(--text-secondary)] dark:text-white">
                                {guestTimezone ? formatTime(new Date(lastBooking.start_time), guestTimezone) : 'Guest timezone unavailable'}
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 dark:border-primary/25 dark:bg-primary/10">
                        <MailIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <div>
                            <p className="text-sm font-medium text-[var(--text-secondary)] dark:text-white">Confirmation sent to {lastBooking.guest_email}</p>
                            <p className="text-xs font-normal text-[var(--text-muted)] dark:text-white/65">If it is not in your inbox, check spam or promotions.</p>
                        </div>
                    </div>
                </section>

                <aside className="flex h-full flex-col gap-4">
                    <div className="rounded-xl border border-primary-border bg-white p-5 shadow-sm dark:border-white/10 dark:bg-darkcard lg:flex-1">
                        <h2 className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)] dark:text-white/60">
                            <InfoIcon className="h-4 w-4 text-primary" />
                            Next
                        </h2>
                        <div className="space-y-3 text-sm font-normal leading-relaxed text-[var(--text-muted)] dark:text-white/70">
                            <p>Join details and change options are in your SLOTZ confirmation email.</p>
                            <p>Calendar reminders are optional. Moving a reminder will not update the SLOTZ booking.</p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-primary-border bg-white p-5 shadow-sm dark:border-white/10 dark:bg-darkcard">
                        <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)] dark:text-white/60">Calendar Reminder</h2>
                        {!calendarReminderArtifacts && (
                            <div className="mb-3 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger)]/5 px-3 py-2 text-xs font-medium text-[var(--danger)]">
                                Calendar reminders are unavailable because required session data is missing.
                            </div>
                        )}
                        <p className="mb-3 text-sm font-normal leading-relaxed text-[var(--text-muted)] dark:text-white/70">
                            Download a reminder file for Apple Calendar, Outlook, Google Calendar, or another calendar app.
                        </p>
                        <a
                            href={calendarReminderUrl || undefined}
                            download={calendarReminderArtifacts?.fileName}
                            aria-disabled={!calendarReminderUrl}
                            className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary-border bg-primary-light/45 px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-all hover:bg-primary-light active:scale-95 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.07] ${!calendarReminderUrl ? 'pointer-events-none opacity-50' : ''}`}
                        >
                            <CalendarPlusIcon className="h-4 w-4 text-primary" />
                            Download Calendar Reminder
                        </a>
                    </div>

                    <button
                        onClick={handleBookAnother}
                        className="mt-auto w-full rounded-xl bg-primary px-4 py-3 text-base font-medium tracking-tight text-white shadow-sm shadow-primary/10 transition-all hover:bg-primary-dark active:scale-[0.99]"
                    >
                        Book Another Session
                    </button>
                </aside>
            </div>
            <IntegratedFooter className="mt-8 shrink-0" />
        </div>
    );
};

export default ConfirmationPage;
