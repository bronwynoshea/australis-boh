import React, { useEffect, useState } from 'react';
import { SchedulingMeetingType } from '../types';
import { formatTime } from '../utils/dateUtils';

interface SlotPickerProps {
  date: Date;
  meetingType: SchedulingMeetingType;
  onSelectSlot: (startTime: Date) => void;
  selectedSlot: Date | null;
  displayTimezone: string;
  availableSlots: Date[];
}

const SlotPicker: React.FC<SlotPickerProps> = ({
  date,
  meetingType,
  onSelectSlot,
  selectedSlot,
  displayTimezone,
  availableSlots
}) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 100);
    return () => clearTimeout(timer);
  }, [date, meetingType]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-3 text-primary-text-muted font-medium">
          <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Scanning availability...</span>
        </div>
      </div>
    );
  }

  if (availableSlots.length === 0) {
    return (
      <div className="text-center py-8 px-4 bg-primary-light/50 dark:bg-darkbg/50 rounded-xl border border-dashed border-primary-border dark:border-white/10">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-10 h-10 text-primary-text-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-primary-text-muted dark:text-white/55 font-medium">
            No available slots for this date
          </p>
          <p className="text-xs text-primary-text-muted/70 dark:text-white/40">
            Please select another date or contact us directly
          </p>
        </div>
      </div>
    );
  }

  const getGuestHour = (slot: Date): number => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: displayTimezone
    });

    return parseInt(formatter.format(slot));
  };

  const morningSlots = availableSlots.filter(slot => getGuestHour(slot) < 12);
  const afternoonSlots = availableSlots.filter(slot => {
    const guestHour = getGuestHour(slot);
    return guestHour >= 12 && guestHour < 17;
  });
  const eveningSlots = availableSlots.filter(slot => getGuestHour(slot) >= 17);

  const renderSlotGroup = (slots: Date[], title: string) => {
    if (slots.length === 0) return null;

    return (
      <div key={title} className="space-y-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-text-muted dark:text-white/45 px-1">
          {title}
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {slots.map(slot => {
            const isActive = selectedSlot && slot.getTime() === selectedSlot.getTime();
            return (
              <button
                key={slot.toISOString()}
                onClick={() => onSelectSlot(slot)}
                className={`
                  min-h-10 px-2 py-2 rounded-lg text-center border transition-all font-medium
                  ${isActive
                    ? 'bg-primary border-primary text-white shadow-md ring-2 ring-primary/20'
                    : 'bg-white dark:bg-darkbg/30 border-primary-border dark:border-white/10 hover:border-primary/50 hover:shadow-sm text-[var(--text-secondary)] dark:text-white/75'
                  }
                `}
              >
                <span className="text-sm leading-none">{formatTime(slot, displayTimezone)}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-primary-text-muted dark:text-white/55">
          <span className="font-semibold text-primary">{availableSlots.length}</span> available slots
        </p>
        <p className="text-[11px] text-primary-text-muted dark:text-white/45">
          {meetingType.duration_minutes} min sessions
        </p>
      </div>

      {renderSlotGroup(morningSlots, 'Morning')}
      {renderSlotGroup(afternoonSlots, 'Afternoon')}
      {renderSlotGroup(eveningSlots, 'Evening')}
    </div>
  );
};

export default SlotPicker;
