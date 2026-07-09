export const addMinutes = (date: Date, minutes: number): Date => {
  return new Date(date.getTime() + minutes * 60000);
};

export const getDaysInMonth = (year: number, month: number): Date[] => {
  const date = new Date(year, month, 1);
  const days: Date[] = [];
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};

export const isSameDay = (d1: Date, d2: Date): boolean => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

export const formatDate = (date: Date, timeZone?: string): string => {
  // If timezone provided, convert properly
  if (timeZone) {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: timeZone
    }).format(date);
  }
  
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const formatTime = (date: Date, timeZone?: string): string => {
  // FIXED: Properly convert UTC to target timezone
  if (timeZone) {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timeZone
    }).format(date);
  }
  
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export const getWeekStartDate = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
};

export const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

export const getMonthStartDate = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
};

export const addMonths = (date: Date, months: number): Date => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
};

export const getTimezoneOffsetString = (date: Date, timeZone: string): string => {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
    const offsetInMinutes = (tzDate.getTime() - utcDate.getTime()) / 60000;
    
    const offsetHours = Math.floor(Math.abs(offsetInMinutes) / 60);
    const offsetMinutesPart = Math.abs(offsetInMinutes) % 60;
    
    const sign = offsetInMinutes >= 0 ? '+' : '-';
    
    return `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutesPart).padStart(2, '0')}`;
};

// Helper to get friendly timezone name
export const getTimezoneName = (timeZone: string): string => {
  try {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short'
    });
    
    const parts = formatter.formatToParts(date);
    const tzName = parts.find(part => part.type === 'timeZoneName')?.value;
    
    return tzName || timeZone;
  } catch {
    return timeZone;
  }
};