import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Page } from '../App';
import { SchedulingBooking, SchedulingMeetingType, BookingStatus } from '../types';
import { supabaseDb } from '../services/supabaseDb';
import { addMinutes } from '../utils/dateUtils';
import Calendar from '../components/Calendar';
import SlotPicker from '../components/SlotPicker';
import IntegratedFooter from '../components/IntegratedFooter';
import { CalendarIcon, ChevronDownIcon, ClockIcon, GlobeIcon } from '../components/Icons';
import { COMMON_TIMEZONES } from '../constants/timezones';

// ✅ Timezone-safe helpers (DST-aware) without external libraries

function getPartsInTimeZone(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

// Convert a "wall clock" time in a named IANA timezone -> actual UTC Date (DST-aware)
function zonedTimeToUtc(
  input: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  timeZone: string
) {
  const { year, month, day } = input;
  const hour = input.hour ?? 0;
  const minute = input.minute ?? 0;
  const second = input.second ?? 0;

  // Start with the same components treated as if they were UTC
  const asIfUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  // See what "asIfUtc" looks like in the target timeZone
  const seen = getPartsInTimeZone(asIfUtc, timeZone);

  // Build a UTC timestamp from what we "saw" in that TZ
  const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second);

  // The difference is the timezone offset (incl DST) at that moment
  const offsetMs = seenAsUtc - asIfUtc.getTime();

  // Subtract offset to get the real UTC instant for the intended wall time
  return new Date(asIfUtc.getTime() - offsetMs);
}

function addDaysYMD(ymd: { year: number; month: number; day: number }, days: number) {
  const d = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day));
  d.setUTCDate(d.getUTCDate() + days);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

interface BookingPageProps {
    navigate: (page: Page) => void;
    selectedMeetingType: SchedulingMeetingType | null;
    setLastBooking: (booking: SchedulingBooking, isReschedule?: boolean) => void;
    rescheduleBooking?: SchedulingBooking | null;
    onCancelReschedule?: () => void;
    allowRescheduleOverride?: boolean;
}

const BookingPage: React.FC<BookingPageProps> = ({ navigate, selectedMeetingType, setLastBooking, rescheduleBooking, onCancelReschedule, allowRescheduleOverride = false }) => {
    const [resolvedMeetingType, setResolvedMeetingType] = useState<SchedulingMeetingType | null>(selectedMeetingType);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
    const [activeBookingStep, setActiveBookingStep] = useState<'date' | 'time' | 'info'>('date');
    const [customerInfo, setCustomerInfo] = useState({ firstName: '', lastName: '', email: '', phone: '', notes: '' });
    const [emailError, setEmailError] = useState<string | null>(null);
    const [guestTimezone, setGuestTimezone] = useState<string>('');
    const [timezoneMenuOpen, setTimezoneMenuOpen] = useState(false);
    const timezoneMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        try {
            // Add iPad detection and debugging
            const isIPad = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            
            if (isIPad) {
                console.log('📱 iPad detected - initializing timezone detection');
            }
            
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            console.log(`🌍 Timezone detected: ${tz}`);
            setGuestTimezone(tz);
        } catch (e) {
            console.error("❌ Could not detect timezone:", e);
            console.log("📍 Falling back to UTC");
            setGuestTimezone('UTC');
        }
    }, []);

    useEffect(() => {
        if (!timezoneMenuOpen) return;

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            if (!timezoneMenuRef.current?.contains(event.target as Node)) {
                setTimezoneMenuOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setTimezoneMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [timezoneMenuOpen]);

    const [existingBookings, setExistingBookings] = useState<SchedulingBooking[]>([]);
    const [availabilityRules, setAvailabilityRules] = useState<any[]>([]);
    const [blackoutDates, setBlackoutDates] = useState<any[]>([]);
    const [staffProfile, setStaffProfile] = useState<any>(null);

    useEffect(() => {
        setResolvedMeetingType(selectedMeetingType);
    }, [selectedMeetingType]);

    useEffect(() => {
        if (!rescheduleBooking) return;

        const [firstName = '', ...lastParts] = rescheduleBooking.guest_name.split(' ');
        setCustomerInfo({
            firstName,
            lastName: lastParts.join(' '),
            email: rescheduleBooking.guest_email,
            phone: rescheduleBooking.guest_phone || '',
            notes: rescheduleBooking.guest_notes || rescheduleBooking.agenda_notes || ''
        });
        setGuestTimezone(rescheduleBooking.guest_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

    }, [rescheduleBooking]);

    // Load data from database
    useEffect(() => {
        const loadData = async () => {
            // Add iPad debugging
            const isIPad = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

            if (rescheduleBooking) {
                try {
                    if (isIPad) {
                        console.log('ðŸ“± iPad: Starting reschedule context load...');
                    }

                    const context = await supabaseDb.getRescheduleContext(rescheduleBooking.id);
                    supabaseDb.setCurrentStaff(context.booking.staff_id);
                    setResolvedMeetingType(context.meetingType);
                    setStaffProfile(context.staffProfile);
                    setAvailabilityRules(context.availabilityRules);
                    setBlackoutDates(context.blackoutDates);
                    setExistingBookings([...context.bookings, ...context.outlookEvents]);
                } catch (error) {
                    console.error('âŒ Error loading reschedule context:', error);
                }
                return;
            }
             
            // Wait for staff ID to be set (from URL parsing in App.tsx)
            const currentStaffId = supabaseDb.getCurrentStaffId();
            if (!currentStaffId) {
                console.log('⏳ Waiting for staff ID to be set...');
                if (isIPad) {
                    console.log('📱 iPad: Still waiting for staff ID...');
                }
                return;
            }
            
            try {
                if (isIPad) {
                    console.log('📱 iPad: Starting data load...');
                }

                if (rescheduleBooking) {
                    const context = await supabaseDb.getRescheduleContext(rescheduleBooking.id);
                    supabaseDb.setCurrentStaff(context.booking.staff_id);
                    setResolvedMeetingType(context.meetingType);
                    setStaffProfile(context.staffProfile);
                    setAvailabilityRules(context.availabilityRules);
                    setBlackoutDates(context.blackoutDates);
                    setExistingBookings([...context.bookings, ...context.outlookEvents]);
                    return;
                }
                
                const [bookings, outlookEvents, rules, blackouts, profile] = await Promise.all([
                    supabaseDb.getBookings(),
                    supabaseDb.getOutlookSyncedEvents(),
                    supabaseDb.getAvailabilityRules(),
                    supabaseDb.getBlackoutDates(),
                    supabaseDb.getStaffProfile()
                ]);
                
                if (isIPad) {
                    console.log('📱 iPad: Data loaded successfully', {
                        bookings: bookings.length,
                        outlookEvents: outlookEvents.length,
                        rules: rules.length,
                        blackouts: blackouts.length,
                        profile: profile?.full_name
                    });
                }
                
                setStaffProfile(profile);
                
                // Combine bookings and Outlook events for conflict checking
                const allEvents = [...bookings, ...outlookEvents];
                setExistingBookings(allEvents);
                setAvailabilityRules(rules);
                setBlackoutDates(blackouts);
            } catch (error) {
                console.error('❌ Error loading data:', error);
                if (isIPad) {
                    console.error('📱 iPad: Data load failed', error);
                }
            }
        };
        
        loadData();
        
        // Set up a listener to retry when staff ID is set
        const checkStaffId = setInterval(() => {
            const staffId = supabaseDb.getCurrentStaffId();
            if (staffId) {
                console.log('🔧 Staff ID is now set, reloading data...');
                clearInterval(checkStaffId);
                loadData();
            }
        }, 100);
        
        return () => clearInterval(checkStaffId);
    }, [rescheduleBooking]);

    // ✅ ADD: Reload data when selected date changes (to get Outlook events for that date range)
    useEffect(() => {
        if (rescheduleBooking) return;
        if (!selectedDate || !supabaseDb.getCurrentStaffId()) return;
        
        const loadDateSpecificData = async () => {
            try {
                const [bookings, outlookEvents] = await Promise.all([
                    supabaseDb.getBookings(),
                    supabaseDb.getOutlookSyncedEvents()
                ]);
                
                // Combine bookings and Outlook events for conflict checking
                const allEvents = [...bookings, ...outlookEvents];
                setExistingBookings(allEvents);
                
            } catch (error) {
                console.error('Error loading date-specific data:', error);
            }
        };
        
        loadDateSpecificData();
    }, [selectedDate]);

    // Generate available slots for selected date
    const availableSlots = useMemo(() => {
        if (!selectedDate || !resolvedMeetingType || !guestTimezone) return [];

        const staffTimezone = staffProfile?.timezone;
        if (!staffTimezone) {
            (window as any).bookingDebugInfo = ['Staff timezone is missing; availability cannot be calculated.'];
            return [];
        }

        // Minimum notice check (unchanged logic)
        const minimumNoticeHours = resolvedMeetingType.minimum_notice_hours || 24;
        const minimumNoticeDate = new Date();
        minimumNoticeDate.setHours(minimumNoticeDate.getHours() + minimumNoticeHours);
        minimumNoticeDate.setHours(0, 0, 0, 0);
        if (!allowRescheduleOverride && selectedDate < minimumNoticeDate) return [];

        const meetingDuration = resolvedMeetingType.duration_minutes;
        const bufferAfter = resolvedMeetingType.buffer_minutes_after || 0;
        const totalMinutes = meetingDuration + bufferAfter;

        // ✅ Guest-selected day boundaries in UTC (DST-aware)
        const guestYMD = getPartsInTimeZone(selectedDate, guestTimezone);
        const guestDayStartUTC = zonedTimeToUtc(
            { year: guestYMD.year, month: guestYMD.month, day: guestYMD.day, hour: 0, minute: 0, second: 0 },
            guestTimezone
        );
        const nextGuestYMD = addDaysYMD({ year: guestYMD.year, month: guestYMD.month, day: guestYMD.day }, 1);
        const guestDayEndUTC = zonedTimeToUtc(
            { year: nextGuestYMD.year, month: nextGuestYMD.month, day: nextGuestYMD.day, hour: 0, minute: 0, second: 0 },
            guestTimezone
        );

        // Determine which staff date(s) overlap this guest day
        const staffStartYMD = getPartsInTimeZone(guestDayStartUTC, staffTimezone);
        const staffEndYMD = getPartsInTimeZone(new Date(guestDayEndUTC.getTime() - 1), staffTimezone);

        const staffDatesToGenerate: Array<{ year: number; month: number; day: number }> = [];
        staffDatesToGenerate.push({ year: staffStartYMD.year, month: staffStartYMD.month, day: staffStartYMD.day });

        // If guest day spans two different staff dates, include both
        if (
            staffEndYMD.year !== staffStartYMD.year ||
            staffEndYMD.month !== staffStartYMD.month ||
            staffEndYMD.day !== staffStartYMD.day
        ) {
            staffDatesToGenerate.push({ year: staffEndYMD.year, month: staffEndYMD.month, day: staffEndYMD.day });
        }

        // Availability rules depend on staff day-of-week, so we compute per staff date
        const debugInfo: string[] = [];
        const slots: Date[] = [];

        for (const staffYMD of staffDatesToGenerate) {
            const staffDateObj = new Date(Date.UTC(staffYMD.year, staffYMD.month - 1, staffYMD.day));
            const dayOfWeekStaff = new Date(
                staffDateObj.toLocaleString("en-US", { timeZone: staffTimezone })
            ).getDay();

            const dayRules = allowRescheduleOverride
                ? [{ start_time: '00:00:00', end_time: '24:00:00', is_enabled: true }]
                : availabilityRules.filter((rule) => rule.day_of_week === dayOfWeekStaff && rule.is_enabled);
            if (dayRules.length === 0) continue;

            // For blackout logic use staff-local date string (blackouts are stored as staff-local dates)
            const staffDateStr = `${staffYMD.year}-${String(staffYMD.month).padStart(2, "0")}-${String(staffYMD.day).padStart(2, "0")}`;

            const hasFullDayBlackout = blackoutDates.some(
                (b) => b.date === staffDateStr && !b.start_time && !b.end_time
            );
            if (!allowRescheduleOverride && hasFullDayBlackout) continue;

            const dayBlackouts = allowRescheduleOverride
                ? []
                : blackoutDates.filter((b) => b.date === staffDateStr && b.start_time && b.end_time);

            for (const rule of dayRules) {
                const [startHour, startMinute] = rule.start_time.split(":").map(Number);
                const [endHour, endMinute] = rule.end_time.split(":").map(Number);

                const startTimeMinutes = startHour * 60 + startMinute;
                const endTimeMinutes = endHour * 60 + endMinute;
                const slotInterval = allowRescheduleOverride ? 15 : 30;

                for (let minutes = startTimeMinutes; minutes + totalMinutes <= endTimeMinutes; minutes += slotInterval) {
                    const slotHour = Math.floor(minutes / 60);
                    const slotMinute = minutes % 60;

                    // ✅ This is the ONLY correct way: staff wall time -> UTC (DST-aware)
                    const slotStartUTC = zonedTimeToUtc(
                        { year: staffYMD.year, month: staffYMD.month, day: staffYMD.day, hour: slotHour, minute: slotMinute, second: 0 },
                        staffTimezone
                    );

                    const slotEndUTC = new Date(slotStartUTC.getTime() + totalMinutes * 60000);

                    // Only show slots that appear on the guest-selected date
                    if (slotStartUTC < guestDayStartUTC || slotStartUTC >= guestDayEndUTC) continue;

                    // Past slot check
                    if (slotStartUTC < new Date()) continue;

                    // Blackout conflict (blackouts are staff-local times)
                    const hasBlackoutConflict = dayBlackouts.some((blackout) => {
                        const [bStartHour, bStartMin] = blackout.start_time.split(":").map(Number);
                        const [bEndHour, bEndMin] = blackout.end_time.split(":").map(Number);

                        const blackoutStartMin = bStartHour * 60 + bStartMin;
                        const blackoutEndMin = bEndHour * 60 + bEndMin;

                        const slotStartMin = slotHour * 60 + slotMinute;
                        const slotEndMin = slotStartMin + totalMinutes;

                        return slotStartMin < blackoutEndMin && slotEndMin > blackoutStartMin;
                    });
                    if (hasBlackoutConflict) continue;

                    // Existing booking conflicts (events are already UTC ISO)
                    const hasConflict = existingBookings.some((event) => {
                        try {
                            const outlookEvent = event as any;
                            const startTimeStr = (event as any).start_time || outlookEvent.event_start_time;
                            const endTimeStr = (event as any).end_time || outlookEvent.event_end_time;
                            if (!startTimeStr || !endTimeStr) return false;
                            if ((event as any).id === rescheduleBooking?.id || (event as any).booking_id === rescheduleBooking?.id) return false;

                            const eventStart = new Date(startTimeStr);
                            const eventEnd = new Date(endTimeStr);
                            if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) return false;

                            return slotStartUTC < eventEnd && slotEndUTC > eventStart;
                        } catch {
                            return false;
                        }
                    });

                    if (!hasConflict) {
                        slots.push(slotStartUTC);

                        // Debug once (first added slot)
                        if (debugInfo.length === 0) {
                            debugInfo.push(`🔧 DST-SAFE SLOT GENERATION (No offset math)`);
                            debugInfo.push(`Guest TZ: ${guestTimezone}`);
                            debugInfo.push(`Staff TZ: ${staffTimezone}`);
                            debugInfo.push(`Guest day start UTC: ${guestDayStartUTC.toISOString()}`);
                            debugInfo.push(`Guest day end UTC:   ${guestDayEndUTC.toISOString()}`);
                            debugInfo.push(`Staff date(s) generated: ${staffDatesToGenerate.map(d => `${d.year}-${String(d.month).padStart(2,"0")}-${String(d.day).padStart(2,"0")}`).join(", ")}`);
                            debugInfo.push(`Example slot UTC: ${slotStartUTC.toISOString()}`);
                            debugInfo.push(`Example slot in Guest: ${slotStartUTC.toLocaleString("en-US", { timeZone: guestTimezone })}`);
                            debugInfo.push(`Example slot in Staff: ${slotStartUTC.toLocaleString("en-AU", { timeZone: staffTimezone })}`);
                        }
                    }
                }
            }
        }

        (window as any).bookingDebugInfo = debugInfo;
        return slots.sort((a, b) => a.getTime() - b.getTime());
    }, [
        selectedDate,
        resolvedMeetingType,
        guestTimezone,
        staffProfile,
        availabilityRules,
        blackoutDates,
        existingBookings,
        rescheduleBooking,
        allowRescheduleOverride,
    ]);

    const timezoneOptions = useMemo(() => {
        if (!guestTimezone || COMMON_TIMEZONES.some(tz => tz.value === guestTimezone)) {
            return COMMON_TIMEZONES;
        }

        return [
            { value: guestTimezone, label: guestTimezone.replace('_', ' ') },
            ...COMMON_TIMEZONES
        ];
    }, [guestTimezone]);

    const selectedTimezoneLabel = timezoneOptions.find(tz => tz.value === guestTimezone)?.label || guestTimezone.replace('_', ' ');
    const bookingSteps: Array<{ id: 'date' | 'time' | 'info'; label: string; enabled: boolean }> = [
        { id: 'date', label: 'Date', enabled: true },
        { id: 'time', label: 'Time', enabled: !!selectedDate },
        { id: 'info', label: 'Your Info', enabled: !!selectedSlot },
    ];
    const requiresLastName = !rescheduleBooking;
    const canConfirmBooking = Boolean(
        selectedSlot &&
        customerInfo.firstName.trim() &&
        customerInfo.email.trim() &&
        !emailError &&
        (!requiresLastName || customerInfo.lastName.trim())
    );

    const handleSelectDate = (date: Date) => {
        setSelectedDate(date);
        setSelectedSlot(null);
        setActiveBookingStep('time');
    };

    const handleSelectSlot = (slot: Date) => {
        setSelectedSlot(slot);
        setActiveBookingStep('info');
    };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const validateEmail = (email: string) => {
        if (email && !emailRegex.test(email)) {
            setEmailError('Please enter a valid email address.');
            return false;
        }
        setEmailError(null);
        return true;
    };
    
    const handleConfirmSelection = async () => {
        console.log('🎯 Starting booking process...');
        console.log('🎯 Customer info:', customerInfo);
        console.log('🎯 Selected slot:', selectedSlot);
        console.log('🎯 Selected meeting type:', resolvedMeetingType);
        console.log('🎯 Current staff ID:', supabaseDb.getCurrentStaffId());
        
        if (!validateEmail(customerInfo.email) || !customerInfo.firstName.trim() || !customerInfo.email.trim() || (requiresLastName && !customerInfo.lastName.trim())) {
            console.log('❌ Validation failed');
            return;
        }
        if (!resolvedMeetingType || !selectedSlot) {
            console.log('❌ Missing meeting type or slot');
            return;
        }

        const currentStaffId = supabaseDb.getCurrentStaffId();
        if (!currentStaffId) {
            console.log('❌ No staff ID set in supabaseDb');
            return;
        }

        console.log('✅ Validation passed, creating booking...');
        const end_time = addMinutes(new Date(selectedSlot), resolvedMeetingType.duration_minutes).toISOString();
        
        const bookingData = {
            staff_id: currentStaffId,
            meeting_type_id: resolvedMeetingType.id,
            guest_name: `${customerInfo.firstName} ${customerInfo.lastName}`.trim(),
            guest_email: customerInfo.email,
            guest_phone: customerInfo.phone,
            guest_notes: customerInfo.notes,
            status: BookingStatus.CONFIRMED,
            start_time: selectedSlot.toISOString(),
            end_time,
            guest_timezone: guestTimezone
        };
        
        console.log('📝 Booking data:', bookingData);
        
        try {
            console.log('📝 Attempting to create booking with data:', bookingData);
            const booking = rescheduleBooking
                ? await supabaseDb.rescheduleBooking(
                    rescheduleBooking.id,
                    bookingData.start_time,
                    bookingData.end_time,
                    guestTimezone,
                    customerInfo.notes
                  )
                : await supabaseDb.addBooking(bookingData);
            console.log('✅ Booking created:', booking);
            
            if (booking) {
                console.log('🔧 Setting last booking and navigating to confirm page...');
                setLastBooking({
                    ...booking,
                    scheduling_meeting_types: booking.scheduling_meeting_types || resolvedMeetingType || undefined,
                    scheduling_staff_profiles: booking.scheduling_staff_profiles || staffProfile || undefined,
                }, !!rescheduleBooking);
                console.log('🔧 Last booking set, calling navigate("confirm")...');
                navigate('confirm');
                console.log('🔧 Navigate called');
            } else {
                console.log('❌ Booking creation returned null');
            }
        } catch (error) {
            console.error('❌ Error creating booking:', error);
        }
    };

    return (
        <div className="w-full px-4 py-3 md:px-6 lg:px-8 lg:py-2 animate-fade-in flex flex-col flex-grow min-h-[calc(100vh-5.5rem)] [@media_(min-height:900px)]:lg:h-[calc(100vh-5rem)] [@media_(min-height:900px)]:lg:min-h-0 [@media_(min-height:900px)]:lg:overflow-hidden">
            <div className="min-h-0 flex-grow [@media_(min-height:900px)]:lg:overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-2 gap-4">
                    <div>
                        <h1 className="text-4xl font-semibold tracking-tight text-[var(--text-secondary)] dark:text-white leading-none">{rescheduleBooking ? 'Reschedule.' : 'Schedule.'}</h1>
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] dark:text-[var(--text-primary)] dark:opacity-80">Choose a time in your timezone</p>
                    </div>
                </div>

                <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl border border-primary-border bg-white/70 p-1 dark:border-white/10 dark:bg-darkcard/65 lg:hidden">
                    {bookingSteps.map(step => (
                        <button
                            key={step.id}
                            type="button"
                            disabled={!step.enabled}
                            onClick={() => setActiveBookingStep(step.id)}
                            className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors ${
                                activeBookingStep === step.id
                                    ? 'bg-primary text-white'
                                    : 'text-[var(--text-muted)] hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-45 dark:text-white/70 dark:hover:bg-primary/10'
                            }`}
                        >
                            {step.label}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(270px,0.82fr)_minmax(300px,1fr)_minmax(300px,0.9fr)] gap-4 xl:gap-5 items-start">
                    <div className={`${activeBookingStep === 'date' ? 'block' : 'hidden'} space-y-3 lg:block`}>
                        <div className="space-y-3">
                            <h2 className="text-sm font-semibold tracking-tight px-2 text-[var(--text-secondary)] dark:text-white opacity-55 uppercase">1. Pick Date</h2>
                            <Calendar 
                                selectedDate={selectedDate} 
                                onSelectDate={handleSelectDate} 
                                minimumNoticeHours={allowRescheduleOverride ? 0 : resolvedMeetingType?.minimum_notice_hours || 24}
                                allowUnavailableDates={allowRescheduleOverride}
                                hideEventDots={true}
                            />
                        </div>
                    </div>

                    <div className={`${activeBookingStep === 'time' ? 'block' : 'hidden'} space-y-3 min-h-0 lg:block`}>
                        <div>
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-3">
                                <h2 className="text-sm font-semibold tracking-tight px-2 text-[var(--text-secondary)] dark:text-white opacity-55 uppercase">2. Select Time</h2>
                                <div
                                    ref={timezoneMenuRef}
                                    onMouseLeave={() => setTimezoneMenuOpen(false)}
                                    className="relative w-full sm:w-64"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setTimezoneMenuOpen(open => !open)}
                                        className="w-full flex items-center gap-2 rounded-xl border border-primary-border dark:border-white/10 bg-white/85 dark:bg-darkbg/85 px-3 py-2 text-left text-xs text-[var(--text-secondary)] dark:text-white shadow-sm shadow-primary-light/50 dark:shadow-none outline-none transition-all hover:border-primary/30 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                                        aria-haspopup="listbox"
                                        aria-expanded={timezoneMenuOpen}
                                    >
                                        <GlobeIcon className="w-4 h-4 shrink-0 text-primary" />
                                        <span className="min-w-0 flex-1 truncate font-normal">{selectedTimezoneLabel}</span>
                                        <ChevronDownIcon className={`w-4 h-4 shrink-0 text-primary-text-muted transition-transform ${timezoneMenuOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {timezoneMenuOpen && (
                                        <div
                                            role="listbox"
                                            className="absolute right-0 z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-primary-border dark:border-white/10 bg-white dark:bg-darkcard p-2 shadow-2xl shadow-primary-light/80 dark:shadow-black/40"
                                        >
                                            {timezoneOptions.map(tz => (
                                                <button
                                                    key={tz.value}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={tz.value === guestTimezone}
                                                    onClick={() => {
                                                        setGuestTimezone(tz.value);
                                                        setSelectedSlot(null);
                                                        setTimezoneMenuOpen(false);
                                                    }}
                                                    className={`w-full rounded-xl px-3 py-2 text-left text-xs font-normal transition-colors ${
                                                        tz.value === guestTimezone
                                                            ? 'bg-primary text-white'
                                                            : 'text-[var(--text-secondary)] dark:text-white/80 hover:bg-primary-light dark:hover:bg-white/5'
                                                    }`}
                                                >
                                                    {tz.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {selectedDate && resolvedMeetingType ? (
                                <div className="lg:max-h-[calc(100vh-18.5rem)] lg:overflow-y-auto lg:pr-1">
                                    <SlotPicker date={selectedDate} meetingType={resolvedMeetingType} selectedSlot={selectedSlot} onSelectSlot={handleSelectSlot} displayTimezone={guestTimezone} availableSlots={availableSlots} />
                                </div>
                            ) : (
                                <div className="h-52 flex flex-col items-center justify-center border border-dashed border-primary-border dark:border-white/10 rounded-xl text-primary-text-muted dark:text-white/55 font-semibold text-sm uppercase tracking-[0.3em] bg-primary-light/50 dark:bg-white/[0.01]">
                                    <CalendarIcon className="w-12 h-12 mb-4 text-primary opacity-30 dark:opacity-55" />
                                    Select a date
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={`${activeBookingStep === 'info' ? 'block' : 'hidden'} min-h-0 lg:sticky lg:top-5 lg:block`}>
                        <div className="p-4 bg-white dark:bg-darkcard rounded-xl border border-primary-border dark:border-white/10 shadow-sm animate-fade-in relative overflow-visible [@media_(min-height:900px)]:lg:overflow-hidden [@media_(min-height:900px)]:lg:h-[calc(100vh-8.75rem)] [@media_(min-height:900px)]:lg:max-h-[41rem] flex flex-col">
                            <h2 className="text-xl font-semibold mb-3 tracking-tight relative z-10 text-[var(--text-secondary)] dark:text-white shrink-0">3. Your Info</h2>
                            {resolvedMeetingType && (
                                <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-primary/10 bg-primary/5 px-3 py-2 text-sm shrink-0">
                                    <span className="min-w-0 truncate font-semibold text-[var(--text-secondary)] dark:text-white">{resolvedMeetingType.name}</span>
                                    <span className="shrink-0 inline-flex items-center text-xs font-medium text-[var(--text-muted)] dark:text-white/65">
                                        <ClockIcon className="mr-1.5 h-3.5 w-3.5 text-primary" />
                                        {resolvedMeetingType.duration_minutes}m
                                    </span>
                                </div>
                            )}
                            {!selectedSlot && (
                                <div className="mb-2 px-1 text-xs font-medium text-[var(--text-muted)] dark:text-white/65 shrink-0">
                                    Choose a time to activate the confirmation button.
                                </div>
                            )}
                            <div className="min-h-0 flex-1 pr-1 relative z-10 [@media_(min-height:900px)]:lg:overflow-y-auto">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 mb-3">
                                    <div className="group">
                                        <label htmlFor="booking-first-name" className="block text-[10px] font-medium text-primary-text-muted dark:text-white/55 uppercase tracking-[0.18em] mb-1.5">First Name</label>
                                        <input id="booking-first-name" type="text" autoComplete="given-name" placeholder="John" value={customerInfo.firstName} onChange={e => setCustomerInfo({ ...customerInfo, firstName: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-primary-light/50 dark:bg-darkbg/50 border border-primary-border dark:border-white/10 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none font-normal text-base text-[var(--text-secondary)] dark:text-white" />
                                    </div>
                                    <div className="group">
                                        <label htmlFor="booking-last-name" className="block text-[10px] font-medium text-primary-text-muted dark:text-white/55 uppercase tracking-[0.18em] mb-1.5">Last Name{rescheduleBooking ? ' (Optional)' : ''}</label>
                                        <input id="booking-last-name" type="text" autoComplete="family-name" placeholder="Smith" value={customerInfo.lastName} onChange={e => setCustomerInfo({ ...customerInfo, lastName: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-primary-light/50 dark:bg-darkbg/50 border border-primary-border dark:border-white/10 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none font-normal text-base text-[var(--text-secondary)] dark:text-white" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 mb-3">
                                    <div className="group">
                                        <label htmlFor="booking-email" className="block text-[10px] font-medium text-primary-text-muted dark:text-white/55 uppercase tracking-[0.18em] mb-1.5">Email Address</label>
                                        <input
                                            id="booking-email"
                                            type="email"
                                            autoComplete="email"
                                            placeholder="john@example.com"
                                            value={customerInfo.email}
                                            onChange={e => {
                                                setCustomerInfo({ ...customerInfo, email: e.target.value });
                                                if (emailError) validateEmail(e.target.value);
                                            }}
                                            onBlur={e => validateEmail(e.target.value)}
                                            aria-invalid={Boolean(emailError)}
                                            aria-describedby={emailError ? 'booking-email-error' : undefined}
                                            className={`w-full px-4 py-2.5 rounded-xl bg-primary-light/50 dark:bg-darkbg/50 border ${emailError ? 'border-rose-400/70 focus:border-rose-400/80 focus:ring-rose-400/10' : 'border-primary-border dark:border-white/10 focus:border-primary/40 focus:ring-primary/10'} focus:ring-2 outline-none font-normal text-base text-[var(--text-secondary)] dark:text-white`}
                                        />
                                        {emailError && <p id="booking-email-error" className="text-rose-500 dark:text-rose-300 text-xs mt-1.5 px-1">{emailError}</p>}
                                    </div>
                                    <div className="group">
                                        <label htmlFor="booking-phone" className="block text-[10px] font-medium text-primary-text-muted dark:text-white/55 uppercase tracking-[0.18em] mb-1.5">Phone (Optional)</label>
                                        <input id="booking-phone" type="tel" autoComplete="tel" placeholder="+61 2 1234 5678" value={customerInfo.phone} onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-primary-light/50 dark:bg-darkbg/50 border border-primary-border dark:border-white/10 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none font-normal text-base text-[var(--text-secondary)] dark:text-white" />
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="booking-notes" className="block text-[10px] font-medium text-primary-text-muted dark:text-white/55 uppercase tracking-[0.18em] mb-1.5">Notes (Optional)</label>
                                    <textarea
                                        id="booking-notes"
                                        placeholder="Please share anything that will help prepare for our meeting."
                                        value={customerInfo.notes}
                                        onChange={e => setCustomerInfo({ ...customerInfo, notes: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl bg-primary-light/50 dark:bg-darkbg/50 border border-primary-border dark:border-white/10 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none font-normal text-base text-[var(--text-secondary)] dark:text-white resize-none"
                                        rows={2}
                                    ></textarea>
                                </div>
                            </div>
                            <div className={`relative z-10 shrink-0 mt-3 ${rescheduleBooking ? 'grid grid-cols-[0.42fr_0.58fr] gap-2' : ''}`}>
                                {rescheduleBooking && (
                                    <button
                                        type="button"
                                        onClick={onCancelReschedule}
                                        className="w-full rounded-xl border border-primary-border bg-white px-4 py-3 text-base font-semibold tracking-tight text-[var(--text-secondary)] shadow-sm transition-all hover:bg-primary-light active:scale-95 dark:border-white/10 dark:bg-darkcard dark:text-white dark:hover:bg-white/5"
                                    >
                                        Cancel
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleConfirmSelection}
                                    disabled={!canConfirmBooking}
                                    className="w-full bg-primary hover:bg-primary-dark disabled:opacity-40 text-white py-3 rounded-xl font-semibold shadow-sm shadow-primary/10 transform active:scale-95 transition-all text-sm tracking-tight"
                                >
                                    {rescheduleBooking ? 'Confirm New Time' : 'Confirm Session'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <IntegratedFooter className="mt-1 shrink-0 hidden lg:block" />
        </div>
    );
};

export default BookingPage;


