import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SchedulingBooking, SchedulingMeetingType } from '../types';
import { addDays, isSameDay, formatTime } from '../utils/dateUtils';
import { getBookingColors } from '../constants/index';

interface WeeklyCalendarProps {
  date: Date;
  bookings: SchedulingBooking[];
  outlookEvents?: any[];
  meetingTypes: SchedulingMeetingType[];
  availabilityRules: any[];
  onSelectBooking: (booking: SchedulingBooking) => void;
  timezone: string;
  startHour?: number;
  endHour?: number;
}

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({ 
  date, 
  bookings, 
  outlookEvents = [],
  meetingTypes, 
  availabilityRules,
  onSelectBooking,
  timezone,
  startHour = 0,
  endHour = 24
}) => {
    const START_HOUR = startHour;
    const END_HOUR = endHour;
    const TOTAL_HOURS = END_HOUR - START_HOUR;
    const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i + START_HOUR);
    const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
    const hourHeight = 60;
    const gridHeight = Math.max(360, Math.min(TOTAL_HOURS * hourHeight, viewportHeight - 384));
    const timelineRef = useRef<HTMLDivElement>(null);
    const days = useMemo(() => {
        const sunday = new Date(date);
        sunday.setDate(date.getDate() - date.getDay());
        return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
    }, [date]);
    const today = new Date();
    
    const [currentTimePosition, setCurrentTimePosition] = useState(0);

    useEffect(() => {
        const handleResize = () => setViewportHeight(window.innerHeight);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const morningStartHour = 8;
        const desiredTop = Math.max(0, (morningStartHour - START_HOUR) * hourHeight);
        const scrollToMorning = () => {
            if (timelineRef.current) {
                timelineRef.current.scrollTop = desiredTop;
            }
        };

        scrollToMorning();
        const animationFrameId = window.requestAnimationFrame(scrollToMorning);
        const timeoutId = window.setTimeout(scrollToMorning, 150);

        return () => {
            window.cancelAnimationFrame(animationFrameId);
            window.clearTimeout(timeoutId);
        };
    }, [date, START_HOUR, hourHeight]);

    useEffect(() => {
        const updateCurrentTime = () => {
            const now = new Date();
            const startOfDay = new Date(now).setHours(START_HOUR, 0, 0, 0);
            const minutesFromStart = (now.getTime() - startOfDay) / (1000 * 60);
            const newPosition = (minutesFromStart / (TOTAL_HOURS * 60)) * (TOTAL_HOURS * hourHeight);
            setCurrentTimePosition(newPosition);
        };
        updateCurrentTime();
        const timer = setInterval(updateCurrentTime, 60000); // update every minute
        return () => clearInterval(timer);
    }, [START_HOUR, TOTAL_HOURS, hourHeight]);

    const getEventPositionAndHeight = (booking: SchedulingBooking, day: Date) => {
        const start = new Date(booking.start_time);
        const end = new Date(booking.end_time);

        // Convert times to Sydney timezone for positioning
        const sydneyStart = new Date(start.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
        const sydneyEnd = new Date(end.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
        
        // Create startOfDay in Sydney timezone
        const startOfDay = new Date(day.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
        startOfDay.setHours(START_HOUR, 0, 0, 0);
        
        const minutesFromStart = (sydneyStart.getTime() - startOfDay.getTime()) / (1000 * 60);
        const top = (minutesFromStart / (TOTAL_HOURS * 60)) * (TOTAL_HOURS * hourHeight);
        
        const duration = (sydneyEnd.getTime() - sydneyStart.getTime()) / (1000 * 60);
        const height = (duration / (TOTAL_HOURS * 60)) * (TOTAL_HOURS * hourHeight);

        return { top, height: Math.max(height - 2, 20) }; // -2 for padding, min height
    };

    const getBookingPadding = (height: number) => {
        // Less padding for shorter bookings to prevent text cutoff
        if (height < 30) return 'p-1';
        if (height < 40) return 'p-1.5';
        return 'p-2';
    };

    const formatHourLabel = (hour: number) => {
        if (hour === 0 || hour === 24) return '12AM';
        if (hour === 12) return '12PM';
        return hour > 12 ? `${hour - 12}PM` : `${hour}AM`;
    };

    const getDayBookings = (day: Date): SchedulingBooking[] => {
        const dayBookings = bookings.filter(b => {
            const bookingDate = new Date(b.start_time);
            // Convert booking UTC time to Sydney timezone for day matching
            const sydneyDate = new Date(bookingDate.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
            const calendarSydneyDate = new Date(day.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
            
            return sydneyDate.toDateString() === calendarSydneyDate.toDateString();
        });
        return dayBookings;
    };

    const getDayOutlookEvents = (day: Date): any[] => {
        return outlookEvents.filter(event => {
            const eventDate = new Date(event.event_start_time);
            const sydneyDate = new Date(eventDate.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
            const calendarSydneyDate = new Date(day.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
            return sydneyDate.toDateString() === calendarSydneyDate.toDateString();
        });
    };

    const getOutlookEventPositionAndHeight = (event: any, day: Date) => {
        const start = new Date(event.event_start_time);
        const end = new Date(event.event_end_time);
        const sydneyStart = new Date(start.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
        const sydneyEnd = new Date(end.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
        const startOfDay = new Date(day.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
        startOfDay.setHours(START_HOUR, 0, 0, 0);
        const minutesFromStart = (sydneyStart.getTime() - startOfDay.getTime()) / (1000 * 60);
        const top = (minutesFromStart / (TOTAL_HOURS * 60)) * (TOTAL_HOURS * hourHeight);
        const duration = (sydneyEnd.getTime() - sydneyStart.getTime()) / (1000 * 60);
        const height = (duration / (TOTAL_HOURS * 60)) * (TOTAL_HOURS * hourHeight);
        return { top, height: Math.max(height - 2, 20) };
    };

    const isTimeSlotAvailable = (day: Date, hour: number): boolean => {
        const dayOfWeek = day.getDay();
        const dayRule = availabilityRules.find(rule => rule.day_of_week === dayOfWeek);
        if (!dayRule || !dayRule.is_active) return false;
        return hour >= dayRule.start_hour && hour < dayRule.end_hour;
    };
    
    return (
        <div className="slotz-dashboard-panel flex min-h-0 flex-col overflow-hidden rounded-xl border border-primary-border bg-white shadow-lg dark:border-primary/20 dark:bg-darkcard">
            {/* Day Headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)]">
                <div className="h-20 border-b border-r border-primary-border/50 dark:border-white/10"></div>
                {days.map(day => (
                    <div key={day.toISOString()} className={`p-3 text-center border-b border-l border-primary-border/50 dark:border-primary/20 ${isSameDay(day, today) ? 'slotz-calendar-today-card' : ''}`}>
                        <p className={`text-xs font-semibold uppercase ${isSameDay(day, today) ? 'text-white' : 'text-[var(--text-muted)]'}`}>{day.toLocaleDateString([], { weekday: 'short' })}</p>
                        <p className={`text-xl font-semibold mt-1 ${isSameDay(day, today) ? 'text-white' : 'text-[var(--text-secondary)]'}`}>{day.getDate()}</p>
                    </div>
                ))}
            </div>

            {/* Scrollable weekly grid */}
            <div ref={timelineRef} className="relative h-[min(30rem,calc(100vh-24rem))] min-h-[22rem] flex-none overflow-y-auto border-b-2 border-primary-border/70 dark:border-primary/30">
                <div className="grid grid-cols-[60px_repeat(7,1fr)] relative" style={{ height: `${TOTAL_HOURS * hourHeight}px` }}>
                    {/* Time Gutter */}
                    <div className="relative col-start-1" style={{ height: `${TOTAL_HOURS * hourHeight}px` }}>
                        {hours.map((hour, index) => (
                            <span
                                key={hour}
                                className="absolute right-4 -translate-y-1/2 text-[10px] font-semibold text-primary-text-muted dark:text-white/60"
                                style={{ top: `${Math.min(index * hourHeight, TOTAL_HOURS * hourHeight - 8)}px` }}
                            >
                                {formatHourLabel(hour)}
                            </span>
                        ))}
                        <div className="absolute inset-y-0 right-0 border-r border-primary-border/50 dark:border-primary/20" />
                    </div>

                    {/* Grid Lines & Day Columns */}
                    {days.map(day => (
                        <div key={day.toISOString()} className={`relative border-l border-primary-border/50 dark:border-primary/20`}>
                             {/* Horizontal Lines */}
                            {hours.slice(0, -1).map(hour => {
                                const isAvailable = isTimeSlotAvailable(day, hour);
                                return (
                                    <div
                                        key={hour} 
                                        className={`border-b border-primary-border/50 dark:border-primary/20 transition-colors ${
                                            isAvailable 
                                                ? 'bg-white dark:bg-darkcard' 
                                                : 'slotz-calendar-unavailable'
                                        }`}
                                        style={{ height: `${hourHeight}px` }}
                                    ></div>
                                );
                            })}
                            
                            {/* Bookings for this day */}
                            {getDayBookings(day).map(booking => {
                                const { top, height } = getEventPositionAndHeight(booking, day);
                                const colors = getBookingColors(booking, meetingTypes);
                                const bookingStart = new Date(booking.start_time);
                                const timeStr = formatTime(bookingStart, timezone);
                                const bookingEnd = new Date(booking.end_time);
                                const isPast = bookingEnd < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                const padding = getBookingPadding(height);
                                
                                return (
                                    <button
                                        key={booking.id}
                                        onClick={() => onSelectBooking(booking)}
                                        className={`absolute left-1 right-1 ${padding} rounded-md border-l-[3px] overflow-hidden cursor-pointer hover:shadow-md transition-shadow text-left ${colors.bg} ${colors.border} ${colors.darkBg} ${colors.darkBorder} ${isPast ? 'opacity-50' : ''}`}
                                        style={{ top: `${top}px`, height: `${height}px` }}
                                        aria-label={`${timeStr} - ${booking.guest_name}`}
                                    >
                                        <p className="font-normal text-xs text-[var(--text-secondary)] truncate">{booking.guest_name}</p>
                                        <p className="text-[10px] text-[var(--text-muted)] truncate">{timeStr}</p>
                                    </button>
                                );
                            })}

                            {getDayOutlookEvents(day).map(event => {
                                const { top, height } = getOutlookEventPositionAndHeight(event, day);
                                const eventStart = new Date(event.event_start_time);
                                const timeStr = formatTime(eventStart, timezone);
                                const padding = getBookingPadding(height);

                                return (
                                    <div
                                        key={event.id || event.outlook_event_id || `${event.event_start_time}-${event.event_subject}`}
                                        className={`slotz-external-calendar-event absolute left-1 right-1 ${padding} rounded-md border overflow-hidden text-left`}
                                        style={{ top: `${top}px`, height: `${height}px` }}
                                        aria-label={`${timeStr} - External Booking: ${event.event_subject || 'Busy'}`}
                                    >
                                        <p className="slotz-external-calendar-event-title font-normal text-xs truncate">{event.event_subject || 'External Booking'}</p>
                                        <p className="slotz-external-calendar-event-meta text-[10px] truncate">{timeStr}</p>
                                    </div>
                                );
                            })}
                            
                             {/* Current Time Indicator */}
                            {isSameDay(day, today) && currentTimePosition > 0 && currentTimePosition < (TOTAL_HOURS * hourHeight) && (
                                <div className="absolute -left-px right-0 z-10 h-0.5 bg-primary" style={{ top: `${currentTimePosition}px` }}>
                                    <div className="slotz-current-time-dot absolute -left-1.5 -top-1 h-3 w-3 rounded-full bg-primary"></div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WeeklyCalendar;
