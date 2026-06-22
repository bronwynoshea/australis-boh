import React, { useMemo, useState, useEffect } from 'react';
import { SchedulingBooking, SchedulingMeetingType } from '../types';
import { addDays, isSameDay, formatTime } from '../utils/dateUtils';
import { supabaseDb } from '../services/supabaseDb';
import { MEETING_TYPE_COLORS } from '../constants/index';

interface MobileWeeklyAgendaProps {
  startDate: Date;
  bookings: SchedulingBooking[];
  onViewBookingDetails: (booking: SchedulingBooking) => void;
}

const MobileWeeklyAgenda: React.FC<MobileWeeklyAgendaProps> = ({ startDate, bookings, onViewBookingDetails }) => {
    const [meetingTypes, setMeetingTypes] = useState<SchedulingMeetingType[]>([]);
    
    useEffect(() => {
        const loadMeetingTypes = async () => {
            try {
                const types = await supabaseDb.getMeetingTypes(false);
                setMeetingTypes(types);
            } catch (error) {
                console.error('Error loading meeting types:', error);
            }
        };
        loadMeetingTypes();
    }, []);

    const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startDate, i)), [startDate]);
    const today = new Date();

    return (
        <div className="space-y-4">
            {days.map(day => {
                const dayBookings = bookings
                    .filter(b => isSameDay(new Date(b.start_time), day))
                    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

                const isToday = isSameDay(day, today);

                return (
                    <div key={day.toISOString()} className={`bg-white dark:bg-darkcard rounded-xl border border-primary-border dark:border-white/10 shadow-sm overflow-hidden ${isToday ? 'border-primary/50' : ''}`}>
                        <div className={`p-4 border-b border-primary-border dark:border-white/10 ${isToday ? 'bg-primary-light/50 dark:bg-primary/10' : 'bg-primary-light/30 dark:bg-white/[0.02]'}`}>
                            <h3 className="font-semibold text-sm text-primary-text-muted dark:text-white/60">
                                {day.toLocaleDateString([], { weekday: 'long' })}
                            </h3>
                            <p className={`font-semibold text-lg ${isToday ? 'text-primary' : 'text-[var(--text-secondary)] dark:text-white'}`}>
                                {day.toLocaleDateString([], { month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                        <div className="p-4">
                            {dayBookings.length > 0 ? (
                                <ul className="space-y-3">
                                    {dayBookings.map(booking => {
                                        const meetingType = meetingTypes.find(m => m.id === booking.meeting_type_id);
                                        const colors = MEETING_TYPE_COLORS[booking.meeting_type_id] || MEETING_TYPE_COLORS.default;
                                        return (
                                            <li key={booking.id} className="flex items-center gap-4">
                                                <div className="text-sm font-semibold text-primary-text-muted dark:text-white/60 w-16 text-right">
                                                    {formatTime(new Date(booking.start_time))}
                                                </div>
                                                <button onClick={() => onViewBookingDetails(booking)} className={`flex-1 ${colors.bg} ${colors.darkBg} border-l-4 ${colors.border} ${colors.darkBorder} p-3 rounded-md text-left w-full`}>
                                                    <p className="font-semibold text-sm text-[var(--text-secondary)] dark:text-white">{booking.guest_name}</p>
                                                    <p className="text-xs text-primary-text-muted dark:text-white/60">{meetingType?.name}</p>
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ul>
                            ) : (
                                <div className="text-center py-6">
                                    <p className="text-sm font-medium text-primary-text-muted/70 dark:text-white/48">No appointments scheduled.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

export default MobileWeeklyAgenda;
