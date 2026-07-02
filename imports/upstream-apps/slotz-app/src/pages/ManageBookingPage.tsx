import React, { useState, useEffect } from 'react';
import { supabaseDb } from '../services/supabaseDb';
import { SchedulingBooking, BookingStatus, SchedulingMeetingType } from '../types';
import { Page } from '../App';

import { formatDate, formatTime } from '../utils/dateUtils';
import IntegratedFooter from '../components/IntegratedFooter';
import ConfirmationModal from '../components/ConfirmationModal';
import { InfoIcon, SettingsIcon, CalendarIcon, ClockIcon, FileTextIcon, XIcon } from '../components/Icons';

interface ManageBookingPageProps {
    bookingId: string | null;
    navigate: (page: Page) => void;

    setFeedback: (message: string) => void;
    onReschedule: (booking: SchedulingBooking, meetingType: SchedulingMeetingType | null) => void;
}

const ManageBookingPage: React.FC<ManageBookingPageProps> = ({ bookingId, navigate, setFeedback, onReschedule }) => {
    const [booking, setBooking] = useState<SchedulingBooking | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);

    const [meetingType, setMeetingType] = useState<SchedulingMeetingType | null>(null);

    useEffect(() => {
        if (!bookingId) {
            setError("No booking ID provided.");
            setIsLoading(false);
            return;
        }

        const loadBooking = async () => {
            try {
                const foundBooking = await supabaseDb.getBookingById(bookingId);
                if (foundBooking) {
                    setBooking(foundBooking);
                    supabaseDb.setCurrentStaff(foundBooking.staff_id);
                    
                    const foundMeetingType = foundBooking.scheduling_meeting_types || null;
                    if (!foundMeetingType) {
                        throw new Error('Managed booking response did not include meeting type details.');
                    }
                    setMeetingType(foundMeetingType);
                } else {
                    setError("Sorry, we couldn't find a booking with that reference.");
                }
            } catch (error) {
                setError("Error loading booking.");
                console.error('Error loading booking:', error);
            }
            setIsLoading(false);
        };
        loadBooking();
    }, [bookingId]);

    const handleConfirmCancel = async () => {
        if (!booking) return;
        setIsConfirmingCancel(false);
        
        try {
            const cancelledBooking = await supabaseDb.cancelBooking(booking.id);
            setBooking(cancelledBooking || { ...booking, status: BookingStatus.CANCELLED });
            setFeedback('Your appointment has been successfully canceled.');
        } catch (error) {
            console.error('Error cancelling booking:', error);
            setFeedback('We could not cancel this appointment. Please try again.');
        }
    };
    
    const handleReschedule = () => {
        if (booking) {
            setFeedback('Please select a new date and time.');
            onReschedule(booking, meetingType);
        }
    };

    if (isLoading) {
        return <div className="text-center p-20">Loading booking details...</div>;
    }

    if (error) {
        return (
             <div className="max-w-2xl mx-auto py-20 px-4 text-center animate-fade-in">
                <div className="mb-8 flex justify-center">
                    <div className="slotz-danger-icon w-20 h-20 rounded-full flex items-center justify-center">
                        <XIcon className="w-10 h-10" />
                    </div>
                </div>
                <h1 className="text-2xl font-semibold mb-4">{error}</h1>
                <p className="text-primary-text-muted">Please check the link and try again, or book a new session.</p>
                <button onClick={() => navigate('book')} className="mt-8 bg-primary text-white py-3 px-6 rounded-lg font-semibold">Book a Session</button>
            </div>
        );
    }
    
    if (!booking) return null;
    
    const isCancelled = booking.status === BookingStatus.CANCELLED;
    const guestTimezone = booking.guest_timezone;

    return (
        <>
            <ConfirmationModal
                isOpen={isConfirmingCancel}
                onClose={() => setIsConfirmingCancel(false)}
                onConfirm={handleConfirmCancel}
                title="Cancel Session"
                message="Are you sure you want to cancel this session? We'll send a cancellation notice and update the calendar invite where connected."
                confirmText="Cancel Session"
            />
            <div className="w-full max-w-2xl mx-auto pt-8 md:pt-12 px-4 animate-fade-in pb-20 flex flex-col flex-grow">
                <div className="flex-grow">
                    <div className="mb-8 flex flex-col items-center">
                        <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl ${isCancelled ? 'slotz-danger-icon' : 'bg-primary/10 text-primary'}`}>
                            <CalendarIcon className="w-12 h-12" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-[var(--text-secondary)] dark:text-white leading-tight mb-4">
                            {isCancelled ? 'Session Canceled' : 'Your Session'}
                        </h1>
                        <p className="text-primary-text-muted dark:text-white/60 text-base md:text-lg max-w-md mx-auto leading-relaxed">
                            {isCancelled ? 'This session has been successfully canceled.' : 'Review your booking details or choose a new time if your plans have changed.'}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-darkcard rounded-3xl p-8 md:p-10 border border-primary-border dark:border-white/5 shadow-lg shadow-primary-light/70 dark:shadow-none text-left mb-10 overflow-hidden relative">
                        {isCancelled && <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm z-10"></div>}
                        <div className="absolute top-0 left-0 w-2 h-full bg-primary/20"></div>
                        <h3 className="text-[10px] font-semibold text-primary uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                            <InfoIcon className="w-4 h-4" />
                            Session details
                        </h3>
                        <div className="space-y-8">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-primary-light dark:bg-white/5 rounded-xl text-primary"><SettingsIcon className="w-5 h-5" /></div>
                                <div>
                                    <p className="text-[10px] font-semibold text-primary-text-muted dark:text-white/50 uppercase tracking-widest mb-1">Type</p>
                                    <p className="text-xl font-semibold text-[var(--text-secondary)] dark:text-white tracking-tight">{meetingType?.name}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-primary-light dark:bg-white/5 rounded-xl text-primary"><CalendarIcon className="w-5 h-5" /></div>
                                    <div>
                                        <p className="text-[10px] font-semibold text-primary-text-muted dark:text-white/50 uppercase tracking-widest mb-1">Date</p>
                                        <p className="text-lg font-semibold text-[var(--text-secondary)] dark:text-white tracking-tight">
                                            {guestTimezone ? formatDate(new Date(booking.start_time), guestTimezone) : 'Guest timezone unavailable'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-primary-light dark:bg-white/5 rounded-xl text-primary"><ClockIcon className="w-5 h-5" /></div>
                                    <div>
                                        <p className="text-[10px] font-semibold text-primary-text-muted dark:text-white/50 uppercase tracking-widest mb-1">Time</p>
                                        <p className="text-lg font-semibold text-[var(--text-secondary)] dark:text-white tracking-tight leading-tight">
                                            {guestTimezone ? formatTime(new Date(booking.start_time), guestTimezone) : 'Guest timezone unavailable'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {booking.agenda_notes && (
                                <div className="flex items-start gap-4 pt-6 border-t border-primary-border/50 dark:border-white/5">
                                    <div className="p-3 bg-primary-light dark:bg-white/5 rounded-xl text-primary"><FileTextIcon className="w-5 h-5" /></div>
                                    <div>
                                        <p className="text-[10px] font-semibold text-primary-text-muted dark:text-white/50 uppercase tracking-widest mb-2">Your Notes</p>
                                        <p className="text-sm text-primary-text-muted dark:text-white/60">{booking.agenda_notes}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {!isCancelled ? (
                        <div className="flex flex-col md:flex-row gap-4">
                            <button onClick={handleReschedule} className="flex-1 bg-primary text-white py-4 rounded-xl font-semibold shadow-sm hover:bg-primary-dark active:scale-95 transition-all">
                                Choose a New Time
                            </button>
                            <button onClick={() => setIsConfirmingCancel(true)} className="slotz-danger-button flex-1 py-4 rounded-xl font-semibold shadow-sm active:scale-95 transition-all">
                                Cancel Session
                            </button>
                        </div>
                    ) : (
                        <div className="text-center">
                            <button onClick={() => navigate('book')} className="bg-primary text-white py-4 px-8 rounded-lg font-semibold">Book a New Session</button>
                        </div>
                    )}
                </div>
                <IntegratedFooter className="mt-24" />
            </div>
        </>
    );
};

export default ManageBookingPage;



