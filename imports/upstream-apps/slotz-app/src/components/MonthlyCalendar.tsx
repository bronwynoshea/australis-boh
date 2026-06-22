import React, { useMemo } from 'react';
import { SchedulingBooking, SchedulingMeetingType } from '../types';
import { addDays, isSameDay } from '../utils/dateUtils';
import { getBookingColors } from '../constants/index';

interface MonthlyCalendarProps {
  date: Date;
  bookings: SchedulingBooking[];
  outlookEvents?: any[];
  meetingTypes: SchedulingMeetingType[];
  onSelectDate: (date: Date) => void;
}

const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({ 
  date, 
  bookings, 
  outlookEvents = [],
  meetingTypes,
  onSelectDate 
}) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const calendarGrid = useMemo(() => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        
        // Get the first day of the calendar grid (might be from previous month)
        const gridStartDate = addDays(firstDayOfMonth, -firstDayOfMonth.getDay());
        
        const grid: Date[] = [];
        for (let i = 0; i < 42; i++) {
            grid.push(addDays(gridStartDate, i));
        }
        return grid;
    }, [date]);

    // Group bookings by date for efficient lookup
    const bookingsByDate = useMemo(() => {
        const map = new Map<string, SchedulingBooking[]>();
        
        bookings.forEach(booking => {
            try {
                const bookingDate = new Date(booking.start_time);
                const dateKey = `${bookingDate.getFullYear()}-${bookingDate.getMonth()}-${bookingDate.getDate()}`;
                
                if (!map.has(dateKey)) {
                    map.set(dateKey, []);
                }
                map.get(dateKey)?.push(booking);
            } catch (error) {
                console.error('Error parsing booking date:', error);
            }
        });
        
        return map;
    }, [bookings]);

    const outlookEventsByDate = useMemo(() => {
        const map = new Map<string, any[]>();

        outlookEvents.forEach(event => {
            try {
                const eventDate = new Date(event.event_start_time);
                const dateKey = `${eventDate.getFullYear()}-${eventDate.getMonth()}-${eventDate.getDate()}`;

                if (!map.has(dateKey)) {
                    map.set(dateKey, []);
                }
                map.get(dateKey)?.push(event);
            } catch (error) {
                console.error('Error parsing Outlook event date:', error);
            }
        });

        return map;
    }, [outlookEvents]);

    const getDayBookings = (day: Date): SchedulingBooking[] => {
        const dateKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
        return bookingsByDate.get(dateKey) || [];
    };

    const getDayOutlookEvents = (day: Date): any[] => {
        const dateKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
        return outlookEventsByDate.get(dateKey) || [];
    };

    return (
        <div className="slotz-dashboard-panel flex overflow-hidden rounded-xl border border-primary-border bg-white shadow-lg dark:border-primary/20 dark:bg-darkcard lg:flex-col">
            {/* Day headers */}
            <div className="grid shrink-0 grid-cols-7 bg-primary-light/30 dark:bg-white/5">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div 
                        key={day} 
                        className="border-r border-primary-border/30 py-3 text-center text-xs font-semibold uppercase tracking-wider text-primary-text-muted last:border-r-0 dark:border-white/5 dark:text-white/50"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
                {calendarGrid.map((day, index) => {
                    const isCurrentMonth = day.getMonth() === date.getMonth();
                    const isToday = isSameDay(day, today);
                    const isPast = day < today;
                    const dayBookings = getDayBookings(day);
                    const dayOutlookEvents = getDayOutlookEvents(day);
                    const hasCalendarItems = dayBookings.length + dayOutlookEvents.length > 0;

                    return (
                        <button 
                            key={`${day.toISOString()}-${index}`}
                            onClick={() => onSelectDate(day)}
                            className={`
                                relative flex min-h-0 flex-col items-start p-2 border-b border-r last:border-r-0 
                                ${index >= 35 ? 'border-b-0' : ''}
                                border-primary-border/30 dark:border-white/5 
                                text-left transition-all duration-200
                                hover:bg-primary-light/50 dark:hover:bg-white/10
                                focus:outline-none focus:ring-2 focus:ring-primary/50 focus:z-10
                                ${!isCurrentMonth ? 'slotz-calendar-unavailable' : 'bg-white dark:bg-darkcard'}
                                ${isPast && !isToday ? 'opacity-60' : ''}
                                ${hasCalendarItems ? 'hover:shadow-lg' : ''}
                            `}
                        >
                            {/* Date number */}
                            <div className="shrink-0">
                                <div 
                                    className={`
                                        w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold
                                        transition-colors duration-200
                                        ${isToday 
                                            ? 'bg-primary text-white shadow-md' 
                                            : !isCurrentMonth 
                                                ? 'text-primary-text-muted/50 dark:text-white/30' 
                                                : 'text-primary-text dark:text-white'
                                        }
                                    `}
                                >
                                    {day.getDate()}
                                </div>
                            </div>

                            {/* Booking indicators - colored dots */}
                            <div className="absolute bottom-2 right-2 flex max-w-[70%] flex-wrap justify-end gap-1">
                                {dayBookings.slice(0, 7).map(booking => {
                                    const colors = getBookingColors(booking, meetingTypes);
                                    const meetingType = meetingTypes.find(mt => mt.id === booking.meeting_type_id);
                                    
                                    return (
                                        <div
                                            key={booking.id}
                                            aria-label={`${meetingType?.name || 'Meeting'} - ${booking.guest_name}`}
                                            className={`
                                                w-3 h-3 rounded-full
                                                ${colors.bg} ${colors.darkBg}
                                                ${colors.border} ${colors.darkBorder}
                                                border
                                                hover:scale-125 transition-transform duration-150
                                            `}
                                        />
                                    );
                                })}
                                {dayOutlookEvents.slice(0, Math.max(0, 7 - dayBookings.length)).map(event => (
                                    <div
                                        key={event.id || event.outlook_event_id || `${event.event_start_time}-${event.event_subject}`}
                                        aria-label={`External Booking - ${event.event_subject || 'Busy'}`}
                                        className="slotz-external-legend-dot h-3 w-3 rounded-full border bg-transparent transition-transform duration-150 hover:scale-125"
                                    />
                                ))}
                                
                                {/* Show "more" indicator for additional bookings */}
                                {dayBookings.length + dayOutlookEvents.length > 7 && (
                                    <div className="text-[9px] font-semibold text-primary dark:text-primary-light px-1.5 py-0.5">
                                        +{dayBookings.length + dayOutlookEvents.length - 7}
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Legend - using your meeting types */}
            <div className="shrink-0 border-t border-primary-border/30 bg-primary-light/10 p-3 dark:border-white/5 dark:bg-white/[0.02]">
                <div className="flex flex-wrap gap-4 text-xs">
                    {meetingTypes.filter(mt => mt.is_active).map(mt => {
                        const colors = getBookingColors({ meeting_type_id: mt.id }, meetingTypes);
                        return (
                            <div key={mt.id} className="flex items-center gap-2">
                                <div className={`h-3 w-3 rounded-full ${colors.bg} ${colors.darkBg} ${colors.border} ${colors.darkBorder} border-2`}></div>
                                <span className="text-[var(--text-secondary)]">{mt.name}</span>
                            </div>
                        );
                    })}
                    <div className="flex items-center gap-2">
                        <div className="slotz-external-legend-dot h-3 w-3 rounded-full border-2 bg-transparent"></div>
                        <span className="text-[var(--text-secondary)]">External Booking</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MonthlyCalendar;
