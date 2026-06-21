import React, { useEffect, useRef, useState } from "react";
import BohCalendar from "./BohCalendar";
import BohSelect from "./BohSelect";

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

interface BohDateTimePickerProps {
  label?: string;
  value: string | null; // YYYY-MM-DDTHH:MM or null
  onChange: (next: string | null) => void;
}

/**
 * BOH-styled date + time picker using a custom calendar popup and a separate time input.
 * Emits a single YYYY-MM-DDTHH:MM string so existing forms can keep their logic.
 */
const BohDateTimePicker: React.FC<BohDateTimePickerProps> = ({ label, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Derive current date / time parts from the incoming value
  const [datePart, timePart] = React.useMemo(() => {
    if (!value) return ["", ""] as const;
    const [d, t] = value.split("T");
    return [d ?? "", (t ?? "").slice(0, 5)] as const; // HH:MM
  }, [value]);

  const [hour, minute] = React.useMemo(() => {
    if (!timePart) return ["", "00"] as const;
    const [h, m] = timePart.split(":");
    return [h ?? "", m ?? "00"] as const;
  }, [timePart]);

  const selectedDate = datePart ? new Date(datePart) : null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleDateSelect = (date: Date) => {
    const yyyyMmDd = date.toISOString().split("T")[0];
    const nextTime = timePart || "00:00";
    onChange(`${yyyyMmDd}T${nextTime}`);
    setIsOpen(false);
  };

  const updateTime = (nextHour: string, nextMinute: string) => {
    if (!datePart) {
      // No date yet; keep value null until a date is chosen
      onChange(null);
      return;
    }
    const h = nextHour || "00";
    const m = nextMinute || "00";
    onChange(`${datePart}T${h.padStart(2, "0")}:${m.padStart(2, "0")}`);
  };

  const formattedDate = React.useMemo(() => {
    if (!datePart) return "";
    const [year, month, day] = datePart.split("-").map(Number);
    if (!year || !month || !day) return "";
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, [datePart]);

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && (
        <label className="block text-xs font-medium text-boh-text-light dark:text-boh-text">{label}</label>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_170px]">
        {/* Date field with calendar popup */}
        <div className="relative">
          <div className="relative">
            <input
              type="text"
              readOnly
              value={formattedDate}
              onClick={() => setIsOpen((prev) => !prev)}
              placeholder="dd/mm/yyyy"
              className="w-full cursor-pointer rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface !pl-11 pr-3 py-2 text-sm text-boh-text-light dark:text-boh-text shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <CalendarIcon className="h-4 w-4 text-boh-text-sub-light dark:text-boh-text-sub" />
            </div>
          </div>
          {isOpen && (
            <BohCalendar
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              align="left"
            />
          )}
        </div>

        {/* Time field: custom hour / minute selects */}
        <div className="grid grid-cols-[minmax(68px,1fr)_auto_minmax(68px,1fr)] items-center gap-2">
          <BohSelect
            value={hour}
            onChange={(value) => updateTime(value, minute)}
            placeholder="HH"
            options={[
              { value: "", label: "HH" },
              ...Array.from({ length: 24 }, (_, i) => i).map((h) => {
              const v = h.toString().padStart(2, "0");
                return { value: v, label: v };
              }),
            ]}
          />
          <span className="text-center text-sm text-boh-text-sub-light dark:text-boh-text-sub">:</span>
          <BohSelect
            value={minute}
            onChange={(value) => updateTime(hour, value)}
            options={['00', '15', '30', '45'].map((m) => ({ value: m, label: m }))}
          />
        </div>
      </div>
    </div>
  );
};

export default BohDateTimePicker;
