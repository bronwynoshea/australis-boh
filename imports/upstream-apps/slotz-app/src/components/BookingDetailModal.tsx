import React, { useState, useEffect } from 'react';
import { SchedulingBooking, SchedulingMeetingType } from '../types';
import { supabaseDb } from '../services/supabaseDb';
import { formatDate, formatTime } from '../utils/dateUtils';
import { XIcon, MailIcon, TagIcon, CalendarIcon, ClockIcon, FileTextIcon, PhoneIcon } from './Icons';
import ConfirmationModal from './ConfirmationModal';

interface BookingDetailModalProps {
    booking: SchedulingBooking | null;
    isOpen: boolean;
    onClose: () => void;
    onCancelBooking: (bookingId: string) => void;
    onRescheduleBooking: (booking: SchedulingBooking, meetingType: SchedulingMeetingType | null) => void;
}

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: string; isActionable?: 'email' | 'tel' }> = ({ icon, label, value, isActionable }) => (
    <div className="flex items-start gap-4">
        <div className="p-3 bg-primary-light dark:bg-white/5 rounded-xl text-primary">{icon}</div>
        <div>
            <p className="text-[10px] font-semibold text-primary-text-muted dark:text-white/50 uppercase tracking-widest mb-1">{label}</p>
            {isActionable ? (
                 <a href={`${isActionable === 'email' ? 'mailto' : 'tel'}:${value}`} className="text-base font-semibold text-[var(--text-secondary)] dark:text-white tracking-tight hover:underline">{value}</a>
            ) : (
                <p className="text-base font-semibold text-[var(--text-secondary)] dark:text-white tracking-tight">{value}</p>
            )}
        </div>
    </div>
);

const BookingDetailModal: React.FC<BookingDetailModalProps> = ({ booking, isOpen, onClose, onCancelBooking, onRescheduleBooking }) => {
    const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
    const [meetingType, setMeetingType] = useState<SchedulingMeetingType | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadMeetingType = async () => {
            if (booking) {
                try {
                    const types = await supabaseDb.getMeetingTypes(false);
                    const type = types.find(m => m.id === booking.meeting_type_id);
                    setMeetingType(type || null);
                } catch (error) {
                    console.error('Error loading meeting type:', error);
                } finally {
                    setIsLoading(false);
                }
            }
        };

        if (isOpen && booking) {
            setIsLoading(true);
            loadMeetingType();
        }
    }, [isOpen, booking]);

    if (!isOpen || !booking) return null;

    const handleConfirmCancel = () => {
        setIsConfirmingCancel(false);
        onCancelBooking(booking.id);
    };
    
    return (
        <>
            <ConfirmationModal
                isOpen={isConfirmingCancel}
                onClose={() => setIsConfirmingCancel(false)}
                onConfirm={handleConfirmCancel}
                title="Confirm Cancellation"
                message="Are you sure you want to cancel this appointment? This action cannot be undone and the guest will be notified by email."
                confirmText="Yes, Cancel Appointment"
            />
            <div className="fixed inset-0 z-[100] flex items-end md:items-stretch md:justify-end animate-fade-in">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
                
                <div className="relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl border border-primary-border bg-white shadow-xl dark:border-white/10 dark:bg-darkcard md:h-full md:max-h-none md:w-[34rem] md:!rounded-none">
                    <div className="p-6 md:p-8 border-b border-primary-border dark:border-white/5">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-secondary)] dark:text-white">{booking.guest_name}</h2>
                                <p className="text-xs font-semibold text-primary uppercase tracking-[0.2em]">APPOINTMENT</p>
                            </div>
                            <button type="button" onClick={onClose} aria-label="Close booking details" className="p-2 rounded-full hover:bg-primary-light dark:hover:bg-white/5 text-primary-text-muted hover:text-[var(--text-secondary)] dark:hover:text-white transition-colors">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="p-12 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-4 text-sm text-primary-text-muted">Loading details...</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                                <DetailRow icon={<TagIcon className="w-5 h-5" />} label="Session Type" value={meetingType?.name || 'Unknown'} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <DetailRow icon={<CalendarIcon className="w-5 h-5" />} label="Date" value={formatDate(new Date(booking.start_time))} />
                                    <DetailRow icon={<ClockIcon className="w-5 h-5" />} label="Time" value={formatTime(new Date(booking.start_time))} />
                                </div>
                                <DetailRow icon={<MailIcon className="w-5 h-5" />} label="Guest Email" value={booking.guest_email} isActionable="email" />
                                {booking.guest_phone && <DetailRow icon={<PhoneIcon className="w-5 h-5" />} label="Guest Phone" value={booking.guest_phone} isActionable="tel" />}
                                
                                <div className="flex items-start gap-4 pt-4 border-t border-primary-border/50 dark:border-white/5">
                                    <div className="p-3 bg-primary-light dark:bg-white/5 rounded-xl text-primary"><FileTextIcon className="w-5 h-5" /></div>
                                    <div>
                                        <p className="text-[10px] font-semibold text-primary-text-muted dark:text-white/50 uppercase tracking-widest mb-2">Notes</p>
                                        {booking.agenda_notes ? (
                                            <p className="text-sm text-primary-text-muted dark:text-white/60 bg-primary-light/50 dark:bg-white/[0.03] p-4 rounded-xl border border-primary-border/50 dark:border-white/5">{booking.agenda_notes}</p>
                                        ) : (
                                            <p className="text-sm text-primary-text-muted/70 dark:text-white/50 italic px-4 py-2">No notes provided.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-6 bg-primary-light/50 dark:bg-white/[0.02] border-t border-primary-border dark:border-white/5">
                                <div className="flex flex-col md:flex-row gap-3">
                                    <button onClick={() => onRescheduleBooking(booking, meetingType)} className="flex-1 px-5 py-3 rounded-xl bg-white dark:bg-darkcard border border-primary-border dark:border-white/10 font-semibold text-sm text-center text-[var(--text-secondary)] dark:text-white hover:bg-primary-light dark:hover:bg-white/5 transition-colors">
                                        Reschedule
                                    </button>
                                    <button onClick={() => setIsConfirmingCancel(true)} className="slotz-danger-button flex-1 px-5 py-3 rounded-xl font-semibold text-sm text-center transition-colors">
                                        Cancel Appointment
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default BookingDetailModal;
