import React, { useState, useEffect } from 'react';
import { SchedulingBooking, SchedulingMeetingType, BookingStatus } from '../types';
import { supabaseDb } from '../services/supabaseDb';
import { formatDate, formatTime } from '../utils/dateUtils';
import { HistoryIcon } from './Icons';

interface BookingHistoryListProps {
    bookings: SchedulingBooking[];
    onViewBookingDetails: (booking: SchedulingBooking) => void;
    mode?: 'history' | 'upcoming';
}

const BookingHistoryList: React.FC<BookingHistoryListProps> = ({ bookings, onViewBookingDetails, mode = 'history' }) => {
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
    
    const getStatusInfo = (booking: SchedulingBooking): { text: string; classes: string } => {
        const isPast = new Date(booking.end_time) < new Date();
        const normalizedStatus = String(booking.status || '').trim().toLowerCase();
        const hasCancellation = normalizedStatus.includes('cancel') || Boolean(booking.cancellation_reason);

        if (hasCancellation) {
            return { text: 'Canceled', classes: 'slotz-status-canceled border' };
        }
        if (booking.rescheduled_at) {
            return { text: 'Rescheduled', classes: 'slotz-status-active border' };
        }
        if (isPast) {
            return { text: 'Completed', classes: 'slotz-status-completed border' };
        }
        return { text: booking.status, classes: 'slotz-status-default border' };
    };

    if (bookings.length === 0) {
        const isUpcoming = mode === 'upcoming';
        return (
            <div className="slotz-dashboard-panel flex h-80 flex-col items-center justify-center rounded-xl border border-primary-border bg-white px-6 text-center shadow-lg dark:border-white/10 dark:bg-darkcard">
                <HistoryIcon className="w-12 h-12 text-primary-border dark:text-white/16 mb-4" />
                <h3 className="text-xl font-semibold text-primary-text-muted dark:text-white/70">{isUpcoming ? 'No Upcoming Bookings' : 'No Past Bookings'}</h3>
                <p className="text-sm text-primary-text-muted/70 dark:text-white/40 mt-2">{isUpcoming ? 'Upcoming appointments will appear here once they are booked.' : 'Your history of completed and canceled appointments will appear here.'}</p>
            </div>
        );
    }
    
    return (
        <div className="slotz-dashboard-panel flex overflow-hidden rounded-xl border border-primary-border bg-white shadow-lg animate-fade-in dark:border-white/10 dark:bg-darkcard lg:flex-col">
            <ul className="flex-1 overflow-y-auto divide-y divide-primary-border/50 dark:divide-white/10">
                {bookings.map(booking => {
                    const meetingType = meetingTypes.find(m => m.id === booking.meeting_type_id);
                    const status = getStatusInfo(booking);

                    return (
                        <li key={booking.id}>
                            <button onClick={() => onViewBookingDetails(booking)} className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between text-left p-4 sm:p-6 hover:bg-primary-light/50 dark:hover:bg-white/[0.03] transition-colors">
                                <div className="mb-3 sm:mb-0">
                                    <p className="font-semibold text-base text-[var(--text-secondary)] dark:text-white">{booking.guest_name}</p>
                                    <p className="text-xs text-primary-text-muted dark:text-white/60 font-medium">
                                        {meetingType?.name || 'Unknown Meeting'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 sm:justify-end">
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-primary-text-muted dark:text-white/80">
                                            {formatDate(new Date(booking.start_time))}
                                        </p>
                                        <p className="text-xs text-primary-text-muted/70 dark:text-white/50">
                                            {formatTime(new Date(booking.start_time))}
                                        </p>
                                    </div>
                                    <div className={`px-3 py-1 text-xs font-semibold rounded-full text-center ${status.classes}`}>
                                        {status.text}
                                    </div>
                                </div>
                            </button>
                        </li>
                    )
                })}
            </ul>
        </div>
    );
};

export default BookingHistoryList;
