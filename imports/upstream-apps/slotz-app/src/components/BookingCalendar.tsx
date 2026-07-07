import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from './Icons';
import { getDaysInMonth, isSameDay } from '../utils/dateUtils';

interface BookingCalendarProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  disablePastDates?: boolean;
  isDateAvailable?: (date: Date) => boolean; // New prop from parent
  minimumNoticeHours?: number; // Configurable minimum notice hours
}

const BookingCalendar: React.FC<BookingCalendarProps> = ({
  selectedDate,
  onSelectDate,
  disablePastDates = true,
  isDateAvailable,
  minimumNoticeHours = 24
}) => {
  const [currentViewDate, setCurrentViewDate] = useState(new Date());

  const year = currentViewDate.getFullYear();
  const month = currentViewDate.getMonth();
  const days = getDaysInMonth(year, month);

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const emptyDaysStart = Array(firstDayOfMonth).fill(null);

  const totalCells = 42;
  const emptyDaysEnd = Array(totalCells - (emptyDaysStart.length + days.length)).fill(null);

  const monthName = currentViewDate.toLocaleDateString([], { month: 'long', year: 'numeric' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prevMonth = () => setCurrentViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentViewDate(new Date(year, month + 1, 1));

  const isPast = (date: Date) => {
    if (!disablePastDates) return false;

    // ✅ Use configurable minimum notice
    const minimumNoticeDate = new Date();
    minimumNoticeDate.setHours(minimumNoticeDate.getHours() + minimumNoticeHours);
    minimumNoticeDate.setHours(0, 0, 0, 0); // Start of that day

    return date < minimumNoticeDate; // Blocks dates within minimum notice period
  };

  const isUnavailable = (date: Date) => {
    // Use parent's availability check if provided
    if (isDateAvailable) {
      return !isDateAvailable(date);
    }
    return false;
  };

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
    <div className="bg-white dark:bg-darkcard rounded-3xl shadow-sm border border-primary-border dark:border-white/5 p-3 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] dark:text-white/80">
          {monthName}
        </h3>
        <div className="flex space-x-1">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-primary-light dark:hover:bg-white/5 rounded-xl transition-colors text-primary-text-muted hover:text-primary"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-primary-light dark:hover:bg-white/5 rounded-xl transition-colors text-primary-text-muted hover:text-primary"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayHeaders.map(day => (
          <div
            key={day.key}
            className="text-center text-[9px] font-semibold text-primary-text-muted dark:text-white/55 py-1 uppercase"
            aria-label={day.name}
          >
            <span aria-hidden="true">{day.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0">
        {/* Previous month padding */}
        {emptyDaysStart.map((_, i) => (
          <div key={`empty-start-${i}`} className="h-9 md:h-10 opacity-0 pointer-events-none" />
        ))}

        {/* Current month days */}
        {days.map(date => {
          const selected = selectedDate && isSameDay(date, selectedDate);
          const past = isPast(date);
          const isToday = isSameDay(date, today);
          const unavailable = isUnavailable(date);
          const disabled = past || unavailable;

          return (
            <div
              key={date.toISOString()}
              className="h-12 md:h-14 flex items-center justify-center relative"
            >
              <button
                disabled={disabled}
                onClick={() => !disabled && onSelectDate(date)}
                aria-label={`${date.toLocaleDateString()}, ${unavailable ? 'unavailable' : 'available'}`}
                className={`
                  h-12 md:h-14 w-full rounded-xl flex flex-col items-center justify-center text-xs transition-all relative
                  ${selected && isToday
                    ? 'slotz-calendar-today scale-105 z-10'
                    : selected
                    ? 'slotz-selected-day text-white scale-105 shadow-lg z-10 font-semibold'
                    : unavailable
                      ? 'text-[var(--text-muted)] cursor-not-allowed opacity-35'
                      : past
                        ? 'text-[var(--text-muted)] cursor-not-allowed opacity-35'
                        : 'hover:bg-primary-light dark:hover:bg-white/5 text-[var(--text-secondary)] font-semibold cursor-pointer hover:scale-105'
                  }
                  ${isToday && !selected && !unavailable ? 'slotz-calendar-today' : ''}
                `}
              >
                <span>{date.getDate()}</span>

                {/* Today indicator */}
                {isToday && !selected && !unavailable && (
                  <span className="absolute bottom-1 w-1 h-1 bg-white rounded-full" />
                )}
              </button>
            </div>
          );
        })}

        {/* Next month padding */}
        {emptyDaysEnd.map((_, i) => (
          <div key={`empty-end-${i}`} className="h-9 md:h-10 opacity-0 pointer-events-none" />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-primary-border/30 dark:border-white/5 flex items-center justify-center gap-4 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-primary"></div>
          <span className="text-primary-text-muted dark:text-white/40">Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full border border-[var(--text-muted)] opacity-55"></div>
          <span className="text-primary-text-muted dark:text-white/40">Unavailable</span>
        </div>
      </div>
    </div>
  );
};

export default BookingCalendar;
