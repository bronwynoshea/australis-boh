interface TimezoneOption {
  value: string;
  label: string;
}

export const COMMON_TIMEZONES: TimezoneOption[] = [
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },

  // Americas
  { value: 'America/New_York', label: 'Eastern Time (ET) - New York' },
  { value: 'America/Chicago', label: 'Central Time (CT) - Chicago' },
  { value: 'America/Denver', label: 'Mountain Time (MT) - Denver' },
  { value: 'America/Phoenix', label: 'Mountain Time (no DST) - Phoenix' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT) - Los Angeles' },
  { value: 'America/Anchorage', label: 'Alaska Time - Anchorage' },
  { value: 'Pacific/Honolulu', label: 'Hawaii-Aleutian Time - Honolulu' },
  
  // Europe
  { value: 'Europe/London', label: 'Greenwich Mean Time - London' },
  { value: 'Europe/Paris', label: 'Central European Time - Paris' },
  { value: 'Europe/Berlin', label: 'Central European Time - Berlin' },
  { value: 'Europe/Moscow', label: 'Moscow Standard Time - Moscow' },

  // Asia
  { value: 'Asia/Dubai', label: 'Gulf Standard Time - Dubai' },
  { value: 'Asia/Kolkata', label: 'India Standard Time - Kolkata' },
  { value: 'Asia/Shanghai', label: 'China Standard Time - Shanghai' },
  { value: 'Asia/Singapore', label: 'Singapore Standard Time' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time - Tokyo' },
  
  // Australia
  { value: 'Australia/Sydney', label: 'Australian Eastern Time - Sydney' },
  { value: 'Australia/Melbourne', label: 'Australian Eastern Time - Melbourne' },
  { value: 'Australia/Brisbane', label: 'Australian Eastern Time (no DST) - Brisbane' },
  { value: 'Australia/Perth', label: 'Australian Western Time - Perth' },
  { value: 'Australia/Adelaide', label: 'Australian Central Time - Adelaide' },

  // Africa
  { value: 'Africa/Cairo', label: 'Eastern European Time - Cairo' },
  { value: 'Africa/Johannesburg', label: 'South Africa Standard Time - Johannesburg' },
];