import React, { useState, useRef, useEffect } from 'react';
import BohCalendar from './BohCalendar';
import { createPortal } from 'react-dom';

const CalendarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="4.5"
      width="14"
      height="12.5"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M7 3V6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M13 3V6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M3 8H17"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

interface BohDatePickerProps {
  label?: string;
  value: string | null; // YYYY-MM-DD or null
  onChange: (next: string | null) => void;
  placeholder?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

/**
 * BOH-styled date picker using BohCalendar component.
 * This is a date-only version (no time) that wraps BohCalendar with BOH dropdown styling.
 */
const BohDatePicker: React.FC<BohDatePickerProps> = ({ 
  label, 
  value, 
  onChange, 
  placeholder = "Select date",
  isOpen: externalIsOpen,
  onToggle
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Use external state if provided, otherwise use internal state
  const isCalendarOpen = externalIsOpen !== undefined ? externalIsOpen : isOpen;
  const toggleCalendar = onToggle || (() => setIsOpen(!isOpen));

  // Close on outside click (only for internal state)
  useEffect(() => {
    if (externalIsOpen === undefined) {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [externalIsOpen]);

  const handleDateSelect = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    onChange(dateString);
    if (externalIsOpen === undefined) {
      setIsOpen(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Parse date string for calendar
  const parseDate = (dateString: string | null): Date | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  };

  return (
    <div className="boh-select-wrapper" ref={containerRef}>
      {label && (
        <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1">
          {label}
        </label>
      )}
      
      <div className="relative">
        <button
          type="button"
          onClick={toggleCalendar}
          className="boh-select w-full text-left flex items-center justify-between"
        >
          <span className={value ? 'text-boh-text-light dark:text-boh-text' : 'text-boh-text-sub-light dark:text-boh-text-sub'}>
            {value ? formatDate(value) : placeholder}
          </span>
          <CalendarIcon className="w-5 h-5 text-boh-text-sub-light dark:text-boh-text-sub" />
        </button>

        {isCalendarOpen && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-lg shadow-lg">
            <BohCalendar
              selectedDate={parseDate(value)}
              onDateSelect={handleDateSelect}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default BohDatePicker;
