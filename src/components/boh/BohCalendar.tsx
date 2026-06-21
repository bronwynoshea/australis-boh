import React, { useState } from "react";

const ChevronLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12.5 4.5L7.5 9.5L12.5 14.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7.5 4.5L12.5 9.5L7.5 14.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface BohCalendarProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  align?: "left" | "right";
}

const daysOfWeek = ["S", "M", "T", "W", "T", "F", "S"];

const BohCalendar: React.FC<BohCalendarProps> = ({
  selectedDate,
  onDateSelect,
  minDate,
  maxDate,
  align = "left",
}) => {
  const [displayDate, setDisplayDate] = useState<Date>(selectedDate || new Date());

  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDay = firstDayOfMonth.getDay();

  const handlePrevMonth = () => {
    setDisplayDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setDisplayDate(new Date(year, month + 1, 1));
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(year, month, day);
    onDateSelect(newDate);
  };

  // Normalize min/max dates to ignore time
  const minDateNorm = minDate ? new Date(minDate.toDateString()) : null;
  const maxDateNorm = maxDate ? new Date(maxDate.toDateString()) : null;

  const calendarDays: React.ReactNode[] = [];

  for (let i = 0; i < startingDay; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="w-full aspect-square" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateNorm = new Date(date.toDateString());
    const isSelected = selectedDate?.toDateString() === date.toDateString();
    const isToday = new Date().toDateString() === date.toDateString();
    const isDisabled =
      (minDateNorm && dateNorm < minDateNorm) || (maxDateNorm && dateNorm > maxDateNorm);

    calendarDays.push(
      <button
        key={day}
        disabled={isDisabled}
        onClick={() => handleDateClick(day)}
        className={`w-full aspect-square flex items-center justify-center rounded-full text-xs sm:text-sm transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-primary dark:focus:ring-offset-boh-surface dark:disabled:opacity-30 disabled:cursor-not-allowed ${
          isSelected
            ? "bg-primary text-boh-text font-bold"
            : isToday
            ? "bg-primary/10 text-boh-text font-semibold"
            : "text-boh-text dark:text-boh-text hover:bg-primary/10"
        }`}
      >
        {day}
      </button>,
    );
  }

  return (
    <div
      className={`absolute z-50 w-64 sm:w-72 bg-boh-surface-light dark:bg-boh-surface rounded-2xl shadow-2xl p-3 sm:p-4 border border-black/10 dark:border-white/20 top-9 ${
        align === "right" ? "right-0" : "left-0"
      }`}
      style={{ animationDuration: "0.2s" }}
    >
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-boh-surface text-boh-text-sub-light dark:text-boh-text-sub"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <h3 className="text-sm sm:text-base font-bold text-boh-text dark:text-boh-text">
          {displayDate.toLocaleString("default", { month: "long", year: "numeric" })}
        </h3>
        <button
          type="button"
          onClick={handleNextMonth}
          className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-boh-surface text-boh-text-sub-light dark:text-boh-text-sub"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub mb-2">
        {daysOfWeek.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">{calendarDays}</div>
    </div>
  );
};

export default BohCalendar;
