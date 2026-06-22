import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from './Icons';
import { getDaysInMonth, isSameDay } from '../utils/dateUtils';
import { supabaseDb } from '../services/supabaseDb';

interface StaffCalendarProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  disablePastDates?: boolean;
}

const StaffCalendar: React.FC<StaffCalendarProps> = ({ selectedDate, onSelectDate, disablePastDates = false }) => {
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const [bookings, setBookings] = useState<any[]>([]);

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

  // Load bookings for staff calendar
  useEffect(() => {
    const loadData = async () => {
      try {
        // Check if staff ID is set before loading data
        const currentStaffId = supabaseDb.getCurrentStaffId();
        if (!currentStaffId) {
          return;
        }
        
        const bookingsData = await supabaseDb.getBookings();
        setBookings(bookingsData);
      } catch (error) {
        console.error('Error loading bookings:', error);
      }
    };
    
    // Set up an interval to check for staff ID
    const checkStaffId = setInterval(() => {
      const currentStaffId = supabaseDb.getCurrentStaffId();
      if (currentStaffId) {
        clearInterval(checkStaffId);
        loadData();
      }
    }, 100);
    
    return () => clearInterval(checkStaffId);
  }, [currentViewDate]);

  const isPast = (date: Date) => {
    if (!disablePastDates) return false;
    return date < today;
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
          
          // Check if there are bookings on this date
          const dayBookings = bookings.filter(booking => {
            const bookingDate = new Date(booking.start_time);
            return isSameDay(bookingDate, date);
          });

          return (
            <div
              key={date.toISOString()}
              className="h-9 md:h-10 flex items-center justify-center relative"
            >
              <button
                disabled={past}
                onClick={() => onSelectDate(date)}
                aria-label={`${date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${past ? ', unavailable' : selected ? ', selected' : ', available'}${dayBookings.length ? `, ${dayBookings.length} booking${dayBookings.length === 1 ? '' : 's'}` : ''}`}
                className={`
                  h-9 md:h-10 w-full rounded-xl flex flex-col items-center justify-center text-xs transition-all relative
                  ${selected ? 'bg-primary text-white scale-105 shadow-lg z-10 font-semibold' : 
                    past ? 'opacity-10 cursor-not-allowed' :
                    'hover:bg-primary-light dark:hover:bg-white/5 text-[var(--text-secondary)] font-semibold cursor-pointer'}
                  ${isToday && !selected ? 'text-primary font-semibold' : ''}
                `}
              >
                <span>{date.getDate()}</span>
                {isToday && !selected && <span className="absolute bottom-1 w-1 h-1 bg-primary rounded-full" />}
                {dayBookings.length > 0 && (
                  <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                    {dayBookings.slice(0, 3).map((_, index) => (
                      <span key={index} className="w-1 h-1 bg-primary rounded-full" />
                    ))}
                    {dayBookings.length > 3 && (
                      <span className="w-1 h-1 bg-primary/50 rounded-full" />
                    )}
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

export default StaffCalendar;
