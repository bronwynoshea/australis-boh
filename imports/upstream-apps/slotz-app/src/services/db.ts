import { 
  SchedulingBooking, 
  BookingStatus, 
  SchedulingMeetingType, 
  SchedulingAvailabilityRule,
  SchedulingBlackoutDate,
  OutlookCalendarSync,
  SchedulingStaffProfile
} from '../types';
import { INITIAL_MEETING_TYPES, INITIAL_AVAILABILITY, MOCK_STAFF_ID, MOCK_STAFF_PROFILE } from '../constants/index';

class DatabaseService {
  private bookings: SchedulingBooking[] = [];
  private meetingTypes: SchedulingMeetingType[] = [...INITIAL_MEETING_TYPES];
  private availabilityRules: SchedulingAvailabilityRule[] = [...INITIAL_AVAILABILITY];
  private blackoutDates: SchedulingBlackoutDate[] = [];
  private outlookSync: OutlookCalendarSync = {
    id: 'os1',
    staff_id: MOCK_STAFF_ID,
    is_enabled: false,
    sync_interval_minutes: 15,
    buffer_minutes_before: 5,
    buffer_minutes_after: 5,
    timezone: 'America/Los_Angeles',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  private staffProfile: SchedulingStaffProfile = MOCK_STAFF_PROFILE;

  constructor() {
    const saved = localStorage.getItem('jobz_cafe_booking_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.bookings = parsed.bookings || [];
        this.meetingTypes = parsed.meetingTypes || INITIAL_MEETING_TYPES;
        this.availabilityRules = parsed.availabilityRules || INITIAL_AVAILABILITY;
        this.blackoutDates = parsed.blackoutDates || [];
        this.outlookSync = parsed.outlookSync || this.outlookSync;
        this.staffProfile = parsed.staffProfile || MOCK_STAFF_PROFILE;

      } catch (e) {
        console.error("Failed to load local DB", e);
      }
    } else {
    }
  }

  private persist() {
    localStorage.setItem('jobz_cafe_booking_v1', JSON.stringify({
      bookings: this.bookings,
      meetingTypes: this.meetingTypes,
      availabilityRules: this.availabilityRules,
      blackoutDates: this.blackoutDates,
      outlookSync: this.outlookSync,
      staffProfile: this.staffProfile
    }));
  }

  getStaffProfile(): SchedulingStaffProfile {
      return { ...this.staffProfile };
  }

  getBookings(): SchedulingBooking[] {
    return [...this.bookings];
  }

  getBookingById(id: string): SchedulingBooking | undefined {
    return this.bookings.find(b => b.id === id);
  }

  getMeetingTypes(activeOnly = true): SchedulingMeetingType[] {
    const allTypes = [...this.meetingTypes];
    return activeOnly ? allTypes.filter(s => s.is_active) : allTypes;
  }
  
  addMeetingType(meetingType: Omit<SchedulingMeetingType, 'id'>): SchedulingMeetingType {
    const newMeetingType: SchedulingMeetingType = {
        ...meetingType,
        id: `mt-${Math.random().toString(36).substr(2, 9)}`,
    };
    this.meetingTypes.push(newMeetingType);
    this.persist();
    return newMeetingType;
  }

  updateMeetingType(id: string, updates: Partial<SchedulingMeetingType>) {
    const index = this.meetingTypes.findIndex(mt => mt.id === id);
    if (index !== -1) {
      this.meetingTypes[index] = { ...this.meetingTypes[index], ...updates };
      this.persist();
    }
  }

  deleteMeetingType(id: string) {
    this.meetingTypes = this.meetingTypes.filter(mt => mt.id !== id);
    this.persist();
  }

  getAvailabilityRules(): SchedulingAvailabilityRule[] {
    return [...this.availabilityRules];
  }
  
  updateAvailabilityRule(id: string, updates: Partial<SchedulingAvailabilityRule>) {
    const index = this.availabilityRules.findIndex(r => r.id === id);
    if (index !== -1) {
      this.availabilityRules[index] = { ...this.availabilityRules[index], ...updates };
      this.persist();
    }
  }

  getOutlookSync(): OutlookCalendarSync {
    return { ...this.outlookSync };
  }

  updateOutlookSync(update: Partial<OutlookCalendarSync>) {
    this.outlookSync = { ...this.outlookSync, ...update };
    this.persist();
  }

  addBooking(booking: Omit<SchedulingBooking, 'id' | 'created_at' | 'updated_at'>): SchedulingBooking {
    const newBooking: SchedulingBooking = {
      ...booking,
      id: Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.bookings.push(newBooking);
    this.persist();
    return newBooking;
  }
  
  updateBooking(id: string, updates: Partial<SchedulingBooking>): SchedulingBooking | null {
      const index = this.bookings.findIndex(b => b.id === id);
      if (index !== -1) {
          this.bookings[index] = { ...this.bookings[index], ...updates, updated_at: new Date().toISOString() };
          this.persist();
          return this.bookings[index];
      }
      return null;
  }

  updateBookingStatus(id: string, status: BookingStatus) {
    this.updateBooking(id, { status });
  }

  updateBookingTime(id: string, start_time: string, end_time: string) {
    return this.updateBooking(id, { start_time, end_time });
  }

  deleteBooking(id: string) {
    this.bookings = this.bookings.filter(a => a.id !== id);
    this.persist();
  }
  
  getBlackoutDates(): SchedulingBlackoutDate[] {
    return [...this.blackoutDates];
  }
  
  addBlackoutDate(date: string): SchedulingBlackoutDate {
    const newBlackout: SchedulingBlackoutDate = {
      id: date, // Use date string as a unique ID
      staff_id: MOCK_STAFF_ID,
      date: date,
      is_all_day: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (!this.blackoutDates.find(b => b.id === newBlackout.id)) {
      this.blackoutDates.push(newBlackout);
      this.persist();
    }
    return newBlackout;
  }

  deleteBlackoutDate(id: string) {
    this.blackoutDates = this.blackoutDates.filter(b => b.id !== id);
    this.persist();
  }
}

export const db = new DatabaseService();