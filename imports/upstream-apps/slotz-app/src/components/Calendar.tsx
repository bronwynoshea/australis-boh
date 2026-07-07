import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from './Icons';
import { getDaysInMonth, isSameDay } from '../utils/dateUtils';
import { supabaseDb } from '../services/supabaseDb';

interface CalendarProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  disablePastDates?: boolean;
  rangeStartDate?: Date | null;
  rangeEndDate?: Date | null;
  minimumNoticeHours?: number; // Configurable minimum notice hours
  hideEventDots?: boolean; // Hide event dots for public booking page
  allowUnavailableDates?: boolean; // Staff override: allow selecting days outside public availability
  eventBookings?: any[]; // Optional curated booking set for staff booking workflows
  eventOutlookEvents?: any[]; // Optional curated Outlook event set for staff booking workflows
  showPastEventDots?: boolean;
  showTodayMarker?: boolean;
  eventTimeZone?: string;
}

const Calendar: React.FC<CalendarProps> = ({
  selectedDate,
  onSelectDate,
  disablePastDates = true,
  rangeStartDate,
  rangeEndDate,
  minimumNoticeHours,
  hideEventDots,
  allowUnavailableDates = false,
  eventBookings,
  eventOutlookEvents,
  showPastEventDots = true,
  showTodayMarker = true,
  eventTimeZone,
}) => {
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const [availabilityRules, setAvailabilityRules] = useState<any[]>([]);
  const [blackoutDates, setBlackoutDates] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [outlookEvents, setOutlookEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const year = currentViewDate.getFullYear();
  const month = currentViewDate.getMonth();
  const days = getDaysInMonth(year, month);

  // Start week on Sunday for consistency
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const emptyDaysStart = Array(firstDayOfMonth).fill(null);

  // To keep height consistent, we always render 6 rows (42 cells total)
  const totalCells = 42;
  const emptyDaysEnd = Array(totalCells - (emptyDaysStart.length + days.length)).fill(null);

  const monthName = currentViewDate.toLocaleDateString([], { month: 'long', year: 'numeric' });
  const today = new Date();
  today.setHours(0,0,0,0);

  const prevMonth = () => setCurrentViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentViewDate(new Date(year, month + 1, 1));

  // Load availability and blackout dates
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load availability rules and blackout dates from Supabase
        const [rules, blackout, bookings, outlookEvents] = await Promise.all([
          supabaseDb.getAvailabilityRules(),
          supabaseDb.getBlackoutDates(),
          eventBookings ? Promise.resolve([]) : supabaseDb.getBookings(),
          eventOutlookEvents ? Promise.resolve([]) : supabaseDb.getOutlookEvents()
        ]);

        setAvailabilityRules(rules);
        setBlackoutDates(blackout);
        setBookings(bookings);
        setOutlookEvents(outlookEvents);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentViewDate, eventBookings, eventOutlookEvents]);

  const isPast = (date: Date) => {
    if (!disablePastDates) return false;

    // Use configurable minimum notice
    const noticeHours = minimumNoticeHours ?? 24;
    const minimumNoticeDate = new Date();
    minimumNoticeDate.setHours(minimumNoticeDate.getHours() + noticeHours);
    minimumNoticeDate.setHours(0, 0, 0, 0); // Start of that day

    return date < minimumNoticeDate; // Blocks dates within minimum notice period
  };

  const isUnavailable = (date: Date) => {
    if (loading || availabilityRules.length === 0) {
      return false; // Allow clicking while loading
    }

    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

    // Check if it's a blackout date first
    const dateStringYYYYMMDD = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (blackoutDates.some(bd => bd.date === dateStringYYYYMMDD)) {
      return true;
    }

    // Check if there's an availability rule for this day of week
    const rule = availabilityRules.find(r => r.day_of_week === dayOfWeek);

    // If no rule exists or is disabled, the day is unavailable
    if (!rule || !rule.is_enabled) {
      return true;
    }

    // Day is available
    return false;
  };

  const getCalendarDateKey = (date: Date, timeZone?: string) => {
    if (!timeZone) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

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

  // Day headers with full names for unique keys
  const dayHeaders = [
    { key: 'sun', label: 'S', name: 'Sunday' },
    { key: 'mon', label: 'M', name: 'Monday' },
    { key: 'tue', label: 'T', name: 'Tuesday' },
    { key: 'wed', label: 'W', name: 'Wednesday' },
    { key: 'thu', label: 'T', name: 'Thursday' },
    { key: 'fri', label: 'F', name: 'Friday' },
    { key: 'sat', label: 'S', name: 'Saturday' },
  ];

  return (
    <div className="bg-white dark:bg-darkcard rounded-3xl shadow-sm border border-primary-border dark:border-white/5 p-4 transition-all">

      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] dark:text-white/80">{monthName}</h3>
        <div className="flex space-x-1">
          <button type="button" onClick={prevMonth} aria-label="Previous month" className="p-2 hover:bg-primary-light dark:hover:bg-white/5 rounded-xl transition-colors text-primary-text-muted hover:text-primary">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={nextMonth} aria-label="Next month" className="p-2 hover:bg-primary-light dark:hover:bg-white/5 rounded-xl transition-colors text-primary-text-muted hover:text-primary">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayHeaders.map(day => (
          <div key={day.key} className="text-center text-[9px] font-semibold text-primary-text-muted dark:text-white/55 py-1 uppercase" aria-label={day.name}>
            <span aria-hidden="true">{day.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0">
        {/* Fillers for previous month's trailing days */}
        {emptyDaysStart.map((_, i) => (
          <div key={`empty-start-${i}`} className="h-9 md:h-10 opacity-0 pointer-events-none" />
        ))}

        {/* Actual month days */}
        {days.map(date => {
          const selected = selectedDate && isSameDay(date, selectedDate);
          const past = isPast(date);
          const isToday = isSameDay(date, today);
          const unavailable = isUnavailable(date);
          const disabledByAvailability = unavailable && !allowUnavailableDates;

          // Check if there are bookings on this date
          const displayBookings = eventBookings ?? bookings;
          const displayOutlookEvents = eventOutlookEvents ?? outlookEvents;

          const dayBookings = displayBookings.filter(booking => {
            const bookingDate = new Date(booking.start_time);
            const bookingEnd = new Date(booking.end_time || booking.start_time);
            const isVisibleDate = showPastEventDots || bookingEnd >= today;
            return isVisibleDate && getCalendarDateKey(bookingDate, eventTimeZone) === getCalendarDateKey(date);
          });

          // Check if there are Outlook events on this date
          const dayOutlookEvents = displayOutlookEvents.filter(event => {
            const eventDate = new Date(event.event_start_time);
            const eventEnd = new Date(event.event_end_time || event.event_start_time);
            const isVisibleDate = showPastEventDots || eventEnd >= today;
            return isVisibleDate && getCalendarDateKey(eventDate, eventTimeZone) === getCalendarDateKey(date);
          });

          // Combine bookings and Outlook events for display
          const allEvents = [...dayBookings, ...dayOutlookEvents];

          const isRangeStart = rangeStartDate && isSameDay(date, rangeStartDate);
          const isRangeEnd = rangeEndDate && isSameDay(date, rangeEndDate);
          const isInRange = rangeStartDate && rangeEndDate && date > rangeStartDate && date < rangeEndDate;

          return (
            <div
              key={date.toISOString()}
              className={`
                h-9 md:h-10 flex items-center justify-center relative
                ${(isRangeStart && isRangeEnd) ? 'bg-primary/10 dark:bg-primary/20' : ''}
                ${isInRange ? 'bg-primary/10 dark:bg-primary/20' : ''}
                ${isRangeStart && !isRangeEnd ? 'bg-primary/10 dark:bg-primary/20 rounded-l-full' : ''}
                ${isRangeEnd && !isRangeStart ? 'bg-primary/10 dark:bg-primary/20 rounded-r-full' : ''}
              `}
            >
              <button
                disabled={past || disabledByAvailability}
                onClick={() => onSelectDate(date)}
                aria-label={`${date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${past ? ', unavailable due to notice period' : disabledByAvailability ? ', unavailable' : selected ? ', selected' : ', available'}`}
                className={`
                  h-9 md:h-10 w-full rounded-xl flex flex-col items-center justify-center text-xs transition-all relative
                  ${(selected || isRangeStart || isRangeEnd) && isToday ? 'slotz-calendar-today scale-105 z-10' :
                    selected || isRangeStart || isRangeEnd ? 'slotz-selected-day text-white scale-105 shadow-lg z-10 font-semibold' :
                    isToday ? 'slotz-calendar-today text-white shadow-lg font-semibold cursor-pointer' :
                    disabledByAvailability ? 'slotz-calendar-unavailable text-[var(--text-muted)] cursor-not-allowed opacity-70' :
                    'hover:bg-primary-100 dark:hover:bg-white/5 text-[var(--text-secondary)] dark:text-white/70 font-semibold cursor-pointer'}
                  ${past ? 'opacity-10 cursor-not-allowed' : ''}
                  ${isRangeStart || isRangeEnd ? 'rounded-full' : ''}
                `}
              >
                <span>{date.getDate()}</span>
                {showTodayMarker && isToday && !selected && !isRangeStart && !isRangeEnd && <span className="pointer-events-none absolute inset-x-px top-px bottom-px rounded-xl border border-white/45" />}
                {!hideEventDots && allEvents.length > 0 && (
                  <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-0.5">
                    {dayBookings.slice(0, 2).map((_, index) => (
                      <span key={`booking-${index}`} className="slotz-calendar-dot-booking h-1.5 w-1.5 rounded-full" />
                    ))}
                    {dayOutlookEvents.slice(0, 2).map((_, index) => (
                      <span key={`outlook-${index}`} className="slotz-calendar-dot-external h-1.5 w-1.5 rounded-full border" />
                    ))}
                  </div>
                )}
              </button>
            </div>
          );
        })}

        {/* Fillers to always complete 6 rows */}
        {emptyDaysEnd.map((_, i) => (
          <div key={`empty-end-${i}`} className="h-9 md:h-10 opacity-0 pointer-events-none" />
        ))}
      </div>
    </div>
  );
};

export default Calendar;
