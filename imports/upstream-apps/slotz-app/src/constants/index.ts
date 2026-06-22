import { SchedulingAvailabilityRule, SchedulingMeetingType, SchedulingStaffProfile, BookingStatus, AppContext } from '../types';

export const BRAND_PURPLE = '#635CCD';

export const MOCK_STAFF_ID = '00000000-0000-0000-0000-000000000001';

export const INITIAL_MEETING_TYPES: SchedulingMeetingType[] = [
  { id: 'mt1', staff_id: MOCK_STAFF_ID, name: 'Standard Consultation', slug: 'standard', duration_minutes: 25, buffer_minutes_after: 5, description: 'General intake and review.', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'mt2', staff_id: MOCK_STAFF_ID, name: 'Strategic Deep Dive', slug: 'strategic', duration_minutes: 50, buffer_minutes_after: 10, description: 'Comprehensive strategy session.', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'mt3', staff_id: MOCK_STAFF_ID, name: 'Quick Catch-up', slug: 'quick', duration_minutes: 15, buffer_minutes_after: 0, description: 'Brief updates or follow-ups.', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

// Color mapping by SLUG (not by ID, since IDs are dynamic UUIDs)
export const MEETING_TYPE_COLORS_BY_SLUG: { [key: string]: { bg: string; border: string; darkBg: string; darkBorder: string } } = {
  'standard': { bg: 'slotz-meeting-general', border: '', darkBg: '', darkBorder: '' },
  'strategic': { bg: 'slotz-meeting-strategic', border: '', darkBg: '', darkBorder: '' },
  'quick': { bg: 'slotz-meeting-quick', border: '', darkBg: '', darkBorder: '' },
  'general-chat': { bg: 'slotz-meeting-general', border: '', darkBg: '', darkBorder: '' },
  'strategic-session': { bg: 'slotz-meeting-strategic', border: '', darkBg: '', darkBorder: '' },
  'quick-chat': { bg: 'slotz-meeting-quick', border: '', darkBg: '', darkBorder: '' },
  default: { bg: 'slotz-meeting-default', border: '', darkBg: '', darkBorder: '' },
};

// Legacy color mapping by ID (kept for backward compatibility with old mock data)
export const MEETING_TYPE_COLORS: { [key: string]: { bg: string; border: string; darkBg: string; darkBorder: string } } = {
  mt1: { bg: 'slotz-meeting-general', border: '', darkBg: '', darkBorder: '' },
  mt2: { bg: 'slotz-meeting-strategic', border: '', darkBg: '', darkBorder: '' },
  mt3: { bg: 'slotz-meeting-quick', border: '', darkBg: '', darkBorder: '' },
  default: { bg: 'slotz-meeting-default', border: '', darkBg: '', darkBorder: '' },
};

// Status-based color overlays (for cancelled, pending, etc.)
export const STATUS_COLORS: { [key in BookingStatus]: { bg: string; border: string; darkBg: string; darkBorder: string } } = {
  [BookingStatus.CONFIRMED]: { bg: '', border: '', darkBg: '', darkBorder: '' }, // Use meeting type colors
  [BookingStatus.PENDING]: { bg: 'bg-[#FFF7E6]', border: 'border-[#B7791F]', darkBg: 'dark:bg-[#B7791F]/20', darkBorder: 'dark:border-[#F4C76A]' },
  [BookingStatus.CANCELLED]: { bg: 'bg-[#FFF1F3]', border: 'border-[#B15B6B]', darkBg: 'dark:bg-[#B15B6B]/20', darkBorder: 'dark:border-[#F0A7B4]' },
  [BookingStatus.COMPLETED]: { bg: 'bg-[#ECF8F2]', border: 'border-[#438A67]', darkBg: 'dark:bg-[#438A67]/20', darkBorder: 'dark:border-[#8BD6AF]' },
  [BookingStatus.NO_SHOW]: { bg: 'bg-[#F4F2FA]', border: 'border-[#8A7FB4]', darkBg: 'dark:bg-white/10', darkBorder: 'dark:border-[#B8B0D6]' },
  [BookingStatus.RESCHEDULED]: { bg: 'bg-[#EEF1FF]', border: 'border-[#6F80D8]', darkBg: 'dark:bg-[#6F80D8]/20', darkBorder: 'dark:border-[#AEB8FF]' },
};

// Helper function to get colors for a booking (with status override)
export const getBookingColors = (
  booking: { meeting_type_id: string; status?: BookingStatus }, 
  meetingTypes: SchedulingMeetingType[]
) => {
  // If status is not confirmed, use status colors
  if (booking.status && booking.status !== BookingStatus.CONFIRMED) {
    return STATUS_COLORS[booking.status];
  }

  // Otherwise use meeting type colors
  const meetingType = meetingTypes.find(mt => mt.id === booking.meeting_type_id);
  if (meetingType) {
    return MEETING_TYPE_COLORS_BY_SLUG[meetingType.slug] || MEETING_TYPE_COLORS_BY_SLUG.default;
  }
  return MEETING_TYPE_COLORS[booking.meeting_type_id] || MEETING_TYPE_COLORS.default;
};

export const INITIAL_AVAILABILITY: SchedulingAvailabilityRule[] = [
  { id: 'ar0', staff_id: MOCK_STAFF_ID, day_of_week: 0, start_time: '09:00:00', end_time: '17:00:00', is_enabled: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'ar1', staff_id: MOCK_STAFF_ID, day_of_week: 1, start_time: '08:00:00', end_time: '18:00:00', is_enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'ar2', staff_id: MOCK_STAFF_ID, day_of_week: 2, start_time: '08:00:00', end_time: '18:00:00', is_enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'ar3', staff_id: MOCK_STAFF_ID, day_of_week: 3, start_time: '08:00:00', end_time: '18:00:00', is_enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'ar4', staff_id: MOCK_STAFF_ID, day_of_week: 4, start_time: '08:00:00', end_time: '18:00:00', is_enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'ar5', staff_id: MOCK_STAFF_ID, day_of_week: 5, start_time: '08:00:00', end_time: '17:00:00', is_enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'ar6', staff_id: MOCK_STAFF_ID, day_of_week: 6, start_time: '09:00:00', end_time: '13:00:00', is_enabled: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const MOCK_STAFF_PROFILE: SchedulingStaffProfile = {
  id: MOCK_STAFF_ID,
  user_id: 'auth-user-id-123',
  full_name: 'JOBZ CAFE Admin',
  email: 'admin@jobzcafe.com',
  slug: 'admin',
  timezone: 'America/Los_Angeles',
  app_context: AppContext.CAFE,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};
