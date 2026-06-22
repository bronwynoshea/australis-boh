import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabaseDb } from '../services/supabaseDb';
import { invokeStaffFunction } from '../services/slotzFunctions';
import { SchedulingMeetingType, SchedulingStaffProfile, BookingStatus } from '../types';
import { addMinutes, formatTime, getTimezoneOffsetString } from '../utils/dateUtils';
import { ChevronDownIcon, XIcon } from './Icons';
import Calendar from './Calendar';

interface ManualBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onBookingCreated: () => void;
    meetingTypes?: SchedulingMeetingType[];
}

interface DropdownOption {
    value: string;
    label: string;
}

const DropdownField: React.FC<{
    id: string;
    value: string;
    options: DropdownOption[];
    onChange: (value: string) => void;
    placeholder: string;
    openDropdown: string | null;
    setOpenDropdown: (id: string | null) => void;
    disabled?: boolean;
}> = ({ id, value, options, onChange, placeholder, openDropdown, setOpenDropdown, disabled = false }) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const isOpen = openDropdown === id;
    const selected = options.find(option => option.value === value);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!wrapperRef.current?.contains(event.target as Node)) {
                setOpenDropdown(null);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpenDropdown(null);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, setOpenDropdown]);

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                id={id}
                type="button"
                disabled={disabled}
                onClick={() => setOpenDropdown(isOpen ? null : id)}
                className="flex min-h-12 w-full items-center justify-between rounded-xl border border-primary-border bg-primary-light/50 px-4 py-3 text-left text-base font-normal text-[var(--text-secondary)] outline-none transition-all hover:border-primary/40 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-primary/25 dark:bg-darkbg/50 dark:text-white"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className={selected ? '' : 'text-primary-text-muted dark:text-white/50'}>
                    {selected?.label || placeholder}
                </span>
                <ChevronDownIcon className={`h-4 w-4 text-primary-text-muted transition-transform dark:text-white/60 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-primary-border bg-white p-1 shadow-xl shadow-black/10 dark:border-primary/25 dark:bg-[#201936] dark:shadow-black/30" role="listbox" aria-labelledby={id}>
                    {options.map(option => {
                        const isSelected = option.value === value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value);
                                    setOpenDropdown(null);
                                }}
                                className={`min-h-10 w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                    isSelected
                                        ? 'bg-primary text-white'
                                        : 'text-[var(--text-secondary)] hover:bg-primary-light dark:text-white/80 dark:hover:bg-primary/15'
                                }`}
                                role="option"
                                aria-selected={isSelected}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const ManualBookingModal: React.FC<ManualBookingModalProps> = ({ 
    isOpen, 
    onClose, 
    onBookingCreated,
    meetingTypes: propMeetingTypes 
}) => {
    const [step, setStep] = useState(1);
    const [meetingTypes, setMeetingTypes] = useState<SchedulingMeetingType[]>([]);
    const [staffProfile, setStaffProfile] = useState<SchedulingStaffProfile | null>(null);
    const [selectedMeetingType, setSelectedMeetingType] = useState<SchedulingMeetingType | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [selectedTimezone, setSelectedTimezone] = useState<string>('');
    const [customerInfo, setCustomerInfo] = useState({ 
        name: '', 
        email: '', 
        phone: '', 
        agenda_notes: '' 
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [existingBookings, setExistingBookings] = useState<any[]>([]);
    const [outlookEvents, setOutlookEvents] = useState<any[]>([]);

    const getCalendarDateKey = (date: Date, timeZone: string) => {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(date);

        const yearPart = parts.find(part => part.type === 'year')?.value;
        const monthPart = parts.find(part => part.type === 'month')?.value;
        const dayPart = parts.find(part => part.type === 'day')?.value;

        return `${yearPart}-${monthPart}-${dayPart}`;
    };

    // Common timezones for selection
    const commonTimezones = [
        { value: 'America/New_York', label: 'Eastern Time (ET)' },
        { value: 'America/Chicago', label: 'Central Time (CT)' },
        { value: 'America/Denver', label: 'Mountain Time (MT)' },
        { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
        { value: 'America/Phoenix', label: 'Arizona Time (MST)' },
        { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
        { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
        { value: 'Europe/London', label: 'London (GMT/BST)' },
        { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
        { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
        { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
        { value: 'UTC', label: 'UTC' }
    ];

    useEffect(() => {
        if (isOpen) {
            const loadData = async () => {
                setIsLoading(true);
                setErrorMessage(null);
                setEmailError(null);
                try {
                    const [types, profile, outlookSync] = await Promise.all([
                        propMeetingTypes ? Promise.resolve(propMeetingTypes) : supabaseDb.getMeetingTypes(),
                        supabaseDb.getStaffProfile(),
                        supabaseDb.getOutlookSync()
                    ]);

                    if (outlookSync?.is_enabled) {
                        const { data, error } = await invokeStaffFunction<any>('slotz-calendar-sync');
                        if (error || data?.success === false) {
                            throw new Error(data?.error || error?.message || 'External calendar sync failed. Please sync again from Integrations before creating a manual booking.');
                        }
                    }

                    const [bookings, events] = await Promise.all([
                        supabaseDb.getBookings(),
                        supabaseDb.getOutlookEvents()
                    ]);

                    setMeetingTypes(types);
                    setStaffProfile(profile);
                    setExistingBookings(bookings);
                    setOutlookEvents(events);
                    setSelectedMeetingType(types[0] || null);
                    
                    if (!profile?.timezone) {
                        throw new Error('Staff timezone is missing.');
                    }
                    setSelectedTimezone(profile.timezone);
                } catch (error) {
                    console.error('Error loading data:', error);
                    setErrorMessage(error instanceof Error ? error.message : 'Failed to load booking data. Please try again.');
                } finally {
                    setIsLoading(false);
                }
            };
            loadData();
        }
    }, [isOpen, propMeetingTypes]);

    const calendarEventBookings = useMemo(() => {
        const now = new Date();
        return existingBookings.filter(booking => {
            const status = String(booking.status || '').toLowerCase();
            const end = new Date(booking.end_time || booking.start_time);
            return status === 'confirmed' && !isNaN(end.getTime()) && end >= now;
        });
    }, [existingBookings]);

    const calendarOutlookEvents = useMemo(() => {
        const now = new Date();
        return outlookEvents.filter(event => {
            const end = new Date(event.event_end_time || event.event_start_time);
            return !isNaN(end.getTime()) && end >= now;
        });
    }, [outlookEvents]);

    const timeOptions = useMemo(() => {
        if (!selectedDate || !selectedTimezone || !selectedMeetingType) return [];
        
        try {
            const year = selectedDate.getFullYear();
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const day = String(selectedDate.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;
            
            const offsetString = getTimezoneOffsetString(selectedDate, selectedTimezone);
            
            const selectedCalendarDateKey = getCalendarDateKey(selectedDate, selectedTimezone);
            const internalBusyBlocks = existingBookings
                .filter(booking => {
                    const status = String(booking.status || '').toLowerCase();
                    return status === 'confirmed' && getCalendarDateKey(new Date(booking.start_time), selectedTimezone) === selectedCalendarDateKey;
                })
                .map(booking => ({
                    start: new Date(booking.start_time),
                    end: new Date(booking.end_time),
                    label: `SLOTZ: ${booking.guest_name || 'Booking'}`
                }));

            const outlookBusyBlocks = outlookEvents
                .filter(event => getCalendarDateKey(new Date(event.event_start_time), selectedTimezone) === selectedCalendarDateKey)
                .map(event => ({
                    start: new Date(event.event_start_time),
                    end: new Date(event.event_end_time),
                    label: `External Booking: ${event.event_subject || 'Busy'}`
                }));

            const busyBlocks = [...internalBusyBlocks, ...outlookBusyBlocks].filter(block => !isNaN(block.start.getTime()) && !isNaN(block.end.getTime()));
            const options = [];
            let currentHour = 0;
            let currentMinute = 0;
            
            while (currentHour < 24) {
                const hourStr = String(currentHour).padStart(2, '0');
                const minuteStr = String(currentMinute).padStart(2, '0');
                const isoString = `${dateString}T${hourStr}:${minuteStr}:00${offsetString}`;
                
                const timeDate = new Date(isoString);
                
                if (!isNaN(timeDate.getTime())) {
                    const endDate = addMinutes(timeDate, selectedMeetingType.duration_minutes);
                    const conflict = busyBlocks.find(block => timeDate < block.end && endDate > block.start);
                    options.push({
                        value: timeDate.toISOString(),
                        label: formatTime(timeDate, selectedTimezone),
                        isBusy: Boolean(conflict),
                        busyLabel: conflict?.label
                    });
                }
                
                currentMinute += 15;
                if (currentMinute >= 60) {
                    currentMinute = 0;
                    currentHour += 1;
                }
            }
            
            return options;
        } catch (error) {
            console.error('Error generating time options:', error);
            return [];
        }
    }, [selectedDate, selectedTimezone, selectedMeetingType, existingBookings, outlookEvents]);

    const selectedDateBusyBlocks = useMemo(() => {
        if (!selectedDate || !selectedTimezone) return [];
        const selectedDateKey = getCalendarDateKey(selectedDate, selectedTimezone);
        return [
            ...existingBookings
                .filter(booking => String(booking.status || '').toLowerCase() === 'confirmed' && getCalendarDateKey(new Date(booking.start_time), selectedTimezone) === selectedDateKey)
                .map(booking => ({
                    type: 'SLOTZ',
                    title: booking.guest_name || 'Booking',
                    start: new Date(booking.start_time),
                    end: new Date(booking.end_time)
                })),
            ...outlookEvents
                .filter(event => getCalendarDateKey(new Date(event.event_start_time), selectedTimezone) === selectedDateKey)
                .map(event => ({
                    type: 'External Booking',
                    title: event.event_subject || 'Busy',
                    start: new Date(event.event_start_time),
                    end: new Date(event.event_end_time)
                }))
        ].filter(block => !isNaN(block.start.getTime()) && !isNaN(block.end.getTime()));
    }, [existingBookings, outlookEvents, selectedDate, selectedTimezone]);

    const handleNextStep = () => {
        setErrorMessage(null);
        setEmailError(null);
        setOpenDropdown(null);
        if (step === 1 && (!selectedMeetingType || !selectedTimezone || !customerInfo.name || !customerInfo.email)) {
            setErrorMessage('Please enter the booking details before continuing.');
            return;
        }

        if (step === 1) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(customerInfo.email)) {
                setEmailError('Bad email');
                return;
            }
        }

        if (step === 2 && !selectedDate) {
            setErrorMessage('Please select a date before continuing.');
            return;
        }

        setStep(s => s + 1);
    };

    const handlePrevStep = () => {
        setOpenDropdown(null);
        setStep(s => s - 1);
    };

    const handleSubmit = async () => {
        setErrorMessage(null);
        setEmailError(null);
        if (!selectedMeetingType || !selectedTime || !customerInfo.name || !customerInfo.email || !staffProfile) {
            setErrorMessage('Please fill in all required fields.');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerInfo.email)) {
            setStep(1);
            setEmailError('Bad email');
            return;
        }

        setIsSubmitting(true);

        try {
            const startTime = new Date(selectedTime);
            const endTime = addMinutes(startTime, selectedMeetingType.duration_minutes);

            if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                throw new Error('Invalid date/time selected');
            }

            const newBooking = {
                staff_id: staffProfile.id,
                meeting_type_id: selectedMeetingType.id,
                guest_name: customerInfo.name,
                guest_email: customerInfo.email,
                guest_phone: customerInfo.phone || undefined,
                guest_notes: customerInfo.agenda_notes || undefined,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                guest_timezone: selectedTimezone,
                status: BookingStatus.CONFIRMED
            };

            const bookingData = newBooking;

            const newBookingCreated = await supabaseDb.addBooking(bookingData);

            if (!newBookingCreated) {
                throw new Error('Failed to create booking in database');
            }
            
            onBookingCreated();
            handleClose();
        } catch (error) {
            console.error('Error creating manual booking:', error);
            setErrorMessage(`Failed to create booking: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetState = () => {
        setStep(1);
        setSelectedMeetingType(meetingTypes[0] || null);
        setSelectedDate(null);
        setSelectedTime('');
        setCustomerInfo({ name: '', email: '', phone: '', agenda_notes: '' });
        setIsLoading(false);
        setErrorMessage(null);
        setEmailError(null);
        setOpenDropdown(null);
        setExistingBookings([]);
        setOutlookEvents([]);
    };

    const handleClose = () => {
        if (!isSubmitting) {
            onClose();
            setTimeout(resetState, 300);
        }
    };
    
    if (!isOpen) return null;

    const fieldClassName = "w-full rounded-xl border border-primary-border bg-primary-light/50 px-4 py-3 text-base font-normal text-[var(--text-secondary)] outline-none transition-all placeholder:text-primary-text-muted/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 dark:border-primary/25 dark:bg-darkbg/50 dark:text-white dark:placeholder:text-white/40 dark:focus:border-primary";
    const meetingTypeOptions = meetingTypes.length === 0
        ? [{ value: '', label: 'No meeting types available' }]
        : meetingTypes.map(mt => ({ value: mt.id, label: `${mt.name} (${mt.duration_minutes} min)` }));

    const renderStep = () => {
        if (isLoading) {
            return (
                <div className="py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-sm text-primary-text-muted">Loading...</p>
                </div>
            );
        }

        switch(step) {
            case 1:
                return (
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="manual-meeting-type" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-text-muted dark:text-white/50">
                                Meeting Type *
                            </label>
                            <DropdownField
                                id="meeting-type"
                                value={selectedMeetingType?.id || ''}
                                options={meetingTypeOptions}
                                onChange={(value) => setSelectedMeetingType(meetingTypes.find(mt => mt.id === value) || null)}
                                placeholder="Select a meeting type"
                                openDropdown={openDropdown}
                                setOpenDropdown={setOpenDropdown}
                                disabled={meetingTypes.length === 0}
                            />
                        </div>

                        <div>
                            <label htmlFor="manual-timezone" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-text-muted dark:text-white/50">
                                Timezone *
                            </label>
                            <DropdownField
                                id="timezone"
                                value={selectedTimezone}
                                options={commonTimezones}
                                onChange={(value) => {
                                    setSelectedTimezone(value);
                                    setSelectedTime('');
                                }}
                                placeholder="Select timezone"
                                openDropdown={openDropdown}
                                setOpenDropdown={setOpenDropdown}
                            />
                        </div>

                        <div>
                            <label htmlFor="manual-guest-name" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-text-muted dark:text-white/50">
                                Guest Name *
                            </label>
                            <input
                                id="manual-guest-name"
                                type="text"
                                autoComplete="name"
                                value={customerInfo.name}
                                onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                placeholder="Guest name"
                                className={fieldClassName}
                            />
                        </div>

                        <div>
                            <label htmlFor="manual-guest-email" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-text-muted dark:text-white/50">
                                Guest Email *
                            </label>
                            <input
                                id="manual-guest-email"
                                type="text"
                                inputMode="email"
                                autoComplete="email"
                                value={customerInfo.email}
                                onChange={e => {
                                    setCustomerInfo({ ...customerInfo, email: e.target.value });
                                    if (emailError) {
                                        setEmailError(null);
                                    }
                                }}
                                placeholder="guest@example.com"
                                aria-invalid={Boolean(emailError)}
                                aria-describedby={emailError ? 'manual-booking-email-error' : undefined}
                                className={`${fieldClassName} ${emailError ? 'border-[#b15b6b]/45 focus:border-[#b15b6b]/60 focus:ring-[#b15b6b]/10 dark:border-[#f0a7b4]/35 dark:focus:border-[#f0a7b4]/50' : ''}`}
                            />
                            <p
                                id="manual-booking-email-error"
                                className="mt-1 min-h-[1.125rem] text-xs font-medium text-[#8f3d50] dark:text-[#f0a7b4]"
                            >
                                {emailError || ''}
                            </p>
                        </div>

                        <div>
                            <label htmlFor="manual-guest-phone" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-text-muted dark:text-white/50">
                                Guest Phone
                            </label>
                            <input
                                id="manual-guest-phone"
                                type="tel"
                                autoComplete="tel"
                                value={customerInfo.phone}
                                onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                placeholder="+1 (555) 123-4567"
                                className={fieldClassName}
                            />
                        </div>

                        <div>
                            <label htmlFor="manual-booking-notes" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-text-muted dark:text-white/50">
                                Notes
                            </label>
                            <textarea
                                id="manual-booking-notes"
                                value={customerInfo.agenda_notes}
                                onChange={e => setCustomerInfo({ ...customerInfo, agenda_notes: e.target.value })}
                                rows={3}
                                placeholder="What should this booking cover?"
                                className={`${fieldClassName} resize-none`}
                            />
                        </div>

                    </div>
                );

            case 2:
                return (
                    <div className="space-y-4">
                        <div className="hidden">
                            <p className="text-sm font-medium text-[var(--text-muted)]">
                                <span className="font-semibold text-[var(--text-secondary)]">{selectedMeetingType?.name}</span>
                                <br />
                                {customerInfo.name} · {commonTimezones.find(tz => tz.value === selectedTimezone)?.label}
                            </p>
                        </div>

                        <div>
                            <label id="manual-date-label" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-text-muted dark:text-white/50">
                                Date *
                            </label>
                            <Calendar
                                selectedDate={selectedDate}
                                onSelectDate={(date) => {
                                    setSelectedDate(date);
                                    setSelectedTime('');
                                }}
                                disablePastDates
                                minimumNoticeHours={0}
                                allowUnavailableDates
                                eventBookings={calendarEventBookings}
                                eventOutlookEvents={calendarOutlookEvents}
                                eventTimeZone={selectedTimezone}
                                showPastEventDots={false}
                                showTodayMarker={false}
                            />
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-medium text-[var(--text-secondary)]">
                                <span className="inline-flex items-center gap-1.5"><span className="slotz-calendar-dot-booking h-2.5 w-2.5 rounded-full" /> SLOTZ booking</span>
                                <span className="inline-flex items-center gap-1.5"><span className="slotz-calendar-dot-external h-2.5 w-2.5 rounded-full border-2" /> External Booking</span>
                            </div>
                        </div>

                        {selectedDate && (
                            <div className="slotz-surface px-4 py-3 text-sm text-[var(--text-muted)]">
                                <p className="font-semibold text-[var(--text-secondary)]">Day Agenda</p>
                                {selectedDateBusyBlocks.length > 0 ? (
                                    <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto pr-1">
                                        {selectedDateBusyBlocks.map((block, index) => (
                                            <li key={`${block.type}-${index}`} className="flex items-center justify-between gap-3 text-xs">
                                                <span className="truncate">{block.type}: {block.title}</span>
                                                <span className="shrink-0 font-semibold">
                                                    {formatTime(block.start, selectedTimezone)} - {formatTime(block.end, selectedTimezone)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mt-2 text-xs font-medium text-[var(--text-muted)]">
                                        No SLOTZ or External Booking entries on this date.
                                    </p>
                                )}
                            </div>
                        )}

                    </div>
                );

            case 3:
                return (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-primary/15 bg-primary-light/30 p-3 dark:bg-white/5">
                            <p className="text-sm font-medium text-[var(--text-muted)]">
                                <span className="font-semibold text-[var(--text-secondary)]">{selectedDate?.toLocaleDateString()}</span>
                                <br />
                                {selectedMeetingType?.name} · {commonTimezones.find(tz => tz.value === selectedTimezone)?.label}
                            </p>
                        </div>

                        <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-[var(--text-muted)]">
                            Staff bookings can be placed outside public availability. Choose the actual start time you want on the calendar.
                        </div>

                        <div>
                            <label id="manual-time-label" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-text-muted dark:text-white/50">
                                Time *
                            </label>
                            <div className="max-h-72 overflow-y-auto rounded-xl border border-primary-border bg-primary-light/30 p-2 dark:border-primary/25 dark:bg-darkbg/40" role="group" aria-labelledby="manual-time-label">
                                <div className="grid grid-cols-3 gap-2">
                                    {timeOptions.map(opt => {
                                        const isSelected = selectedTime === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                disabled={opt.isBusy}
                                                onClick={() => setSelectedTime(opt.value)}
                                                aria-label={opt.busyLabel ? `${opt.label}, unavailable: ${opt.busyLabel}` : opt.label}
                                                className={`min-h-10 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                                    isSelected
                                                        ? 'bg-primary text-white'
                                                        : opt.isBusy
                                                            ? 'cursor-not-allowed border border-[#b15b6b]/25 bg-[#b15b6b]/10 text-[#9f4f5f] dark:text-[#f0a7b4]'
                                                            : 'bg-white text-[var(--text-secondary)] hover:bg-primary-light dark:bg-white/5 dark:text-white/80 dark:hover:bg-primary/15'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="slotz-surface px-4 py-3 text-sm text-[var(--text-muted)]">
                            <p className="font-semibold text-[var(--text-secondary)]">Confirm Booking</p>
                            <p className="mt-2">
                                {customerInfo.name} · {selectedTime ? formatTime(new Date(selectedTime), selectedTimezone) : 'Select a time'}
                            </p>
                            <p className="mt-1 text-xs">
                                {customerInfo.email}
                            </p>
                        </div>

                    </div>
                );

            default:
                return null;
        }
    };

    const renderFooter = () => {
        if (isLoading) return null;

        if (step === 1) {
            return (
                <button
                    onClick={handleNextStep}
                    disabled={!selectedMeetingType || !selectedTimezone || !customerInfo.name || !customerInfo.email}
                    className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Next: Choose Date
                </button>
            );
        }

        if (step === 2) {
            return (
                <div className="flex gap-3">
                    <button
                        onClick={handlePrevStep}
                        className="min-h-12 w-1/3 rounded-xl border border-primary-border bg-primary-light/50 px-4 py-3 font-semibold text-[var(--text-secondary)] transition-colors hover:bg-primary-light dark:border-primary/25 dark:bg-white/5 dark:text-white"
                    >
                        Back
                    </button>
                    <button
                        onClick={handleNextStep}
                        disabled={!selectedDate}
                        className="min-h-12 w-2/3 rounded-xl bg-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Next: Select Time
                    </button>
                </div>
            );
        }

        return (
            <div className="flex gap-3">
                <button
                    onClick={handlePrevStep}
                    disabled={isSubmitting}
                    className="min-h-12 w-1/3 rounded-xl border border-primary-border bg-primary-light/50 px-4 py-3 font-semibold text-[var(--text-secondary)] transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50 dark:border-primary/25 dark:bg-white/5 dark:text-white"
                >
                    Back
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={!selectedTime || isSubmitting}
                    className="flex min-h-12 w-2/3 items-center justify-center rounded-xl bg-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <>
                            <svg className="-ml-1 mr-3 h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Creating...
                        </>
                    ) : !selectedTime ? (
                        'Select Time to Continue'
                    ) : (
                        'Create Booking'
                    )}
                </button>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-stretch md:justify-end animate-fade-in">
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
                onClick={handleClose}
            ></div>
            <div className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-primary-border bg-white shadow-xl dark:border-white/10 dark:bg-darkcard md:h-full md:max-h-none md:w-[30rem] md:!rounded-none">
                <div className="p-6 border-b border-primary-border dark:border-white/5 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight text-[var(--text-secondary)] dark:text-white">
                            Manual Booking
                        </h2>
                        <p className="text-xs text-primary-text-muted dark:text-white/50 mt-1">
                            Step {step} of 3
                        </p>
                    </div>
                    <button 
                        onClick={handleClose} 
                        disabled={isSubmitting}
                        className="p-2 rounded-full hover:bg-primary-light dark:hover:bg-white/5 text-primary-text-muted hover:text-[var(--text-secondary)] dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Close modal"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                    {renderStep()}
                </div>
                {renderFooter() && (
                    <div className="shrink-0 border-t border-primary-border bg-white/95 p-4 dark:border-white/5 dark:bg-darkcard/95">
                        {errorMessage && (
                            <div
                                role="alert"
                                className="slotz-notice slotz-notice-error mb-3 px-3.5 py-2.5 text-sm font-medium leading-relaxed"
                            >
                                {errorMessage}
                            </div>
                        )}
                        {renderFooter()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManualBookingModal;
