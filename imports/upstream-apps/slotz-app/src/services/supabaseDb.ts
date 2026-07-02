import { supabase } from './supabaseClient';
import { 
  SchedulingBooking, 
  BookingStatus, 
  SchedulingMeetingType, 
  SchedulingAvailabilityRule,
  SchedulingBlackoutDate,
  OutlookCalendarSync,
  SchedulingStaffProfile
} from '../types';

class SupabaseDatabase {
  private currentStaffId: string | null = null;

  // Set the current staff user (call after login)
  setCurrentStaff(staffId: string) {
    this.currentStaffId = staffId;
  }

  getCurrentStaffId(): string | null {
    return this.currentStaffId;
  }

  private async ensureCurrentStaffId(): Promise<string> {
    if (this.currentStaffId) {
      return this.currentStaffId;
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new Error(`Unable to restore staff session: ${sessionError.message}`);
    }

    const userId = session?.user?.id;
    if (!userId) {
      throw new Error('No staff session found. Please sign in again.');
    }

    const { data: profile, error: profileError } = await supabase
      .from('scheduling_staff_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Unable to restore staff profile: ${profileError.message}`);
    }

    if (!profile?.id) {
      throw new Error('No staff profile found for the current session.');
    }

    this.currentStaffId = profile.id;
    return profile.id;
  }

  // Try a different approach - check all trigger details
  async checkTriggerDefinition(): Promise<void> {
    const { data, error } = await supabase
      .rpc('execute', `SELECT 
        tgname,
        tgenabled,
        tgisdeferred,
        tginitdeferred,
        tgtype,
        tgfoid::regproc as function_name,
        tgargs,
        tgoldtable
      FROM pg_trigger 
      WHERE tgname = 'trigger_send_booking_confirmation'`);

    if (error) {
      console.error('Error checking trigger definition:', error);
    } else {
      console.log(' Trigger Details:', data);
    }
  }

  // Check all triggers related to bookings
  async checkAllBookingTriggers(): Promise<void> {
    const { data, error } = await supabase
      .rpc('execute', `SELECT 
        tgname,
        tgenabled,
        tgisdeferred,
        tginitdeferred,
        tgtype,
        tgfoid::regproc as function_name,
        tgargs,
        tgoldtable
      FROM pg_trigger 
      WHERE tgoldtable IN ('scheduling_bookings', 'scheduling_meeting_types')
      AND tgname NOT LIKE '%RI_ConstraintTrigger%'
      AND tgname NOT LIKE '%constraint%'`);

    if (error) {
      console.error('Error checking all booking triggers:', error);
    } else {
      console.log(' All Booking Triggers:', data);
    }
  }

  // ============================================================================
  // STAFF PROFILE
  // ============================================================================

  async getStaffProfile(): Promise<SchedulingStaffProfile | null> {
    const staffId = await this.ensureCurrentStaffId();

    const { data, error } = await supabase
      .from('scheduling_staff_profiles')
      .select('*')
      .eq('id', staffId)
      .single();

    if (error) {
      console.error('Error fetching staff profile:', error);
      return null;
    }

    return data;
  }

  // ============================================================================
  // BOOKINGS
  // ============================================================================

  async getBookings(): Promise<SchedulingBooking[]> {
    const staffId = await this.ensureCurrentStaffId();

    const { data, error } = await supabase
      .from('scheduling_bookings')
      .select('*')
      .eq('staff_id', staffId)
      .order('start_time', { ascending: false });

    if (error) {
      console.error('Error fetching bookings:', error);
      return [];
    }

    return data || [];
  }

  async getOutlookSyncedEvents(): Promise<any[]> {
    const staffId = await this.ensureCurrentStaffId();

    console.log(`🔍 Looking for Outlook events for staff: ${staffId}`);
    
    try {
      const { data, error } = await supabase
        .from('outlook_synced_events')
        .select('*')
        .eq('staff_id', staffId)
        .eq('sync_status', 'synced')
        .order('event_start_time', { ascending: true });

      if (error) {
        console.error('❌ Error accessing Outlook events:', error);
        console.log('🔧 This is likely an RLS (Row Level Security) issue');
        console.log('🔧 Solution: Add RLS policy to allow public read access');
        return [];
      }

      console.log(`✅ Found ${data?.length || 0} Outlook events`);
      data?.forEach((event: any) => {
        console.log(`   📅 ${event.event_subject}: ${event.event_start_time}`);
      });
      
      return data || [];
    } catch (err) {
      console.error('Unexpected error:', err);
      return [];
    }
  }

  async getBookingById(id: string): Promise<SchedulingBooking | null> {
    const { data: managedData, error: managedError } = await supabase.functions.invoke('slotz-get-managed-booking', {
      body: { bookingId: id }
    });

    if (!managedError && managedData?.booking) {
      return managedData.booking;
    }

    console.error('Managed booking lookup failed:', managedError || managedData);
    return null;
  }

  async getMeetingTypeById(id: string): Promise<SchedulingMeetingType | null> {
    const { data, error } = await supabase
      .from('scheduling_meeting_types')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching meeting type:', error);
      return null;
    }

    return data;
  }

  async getRescheduleContext(bookingId: string): Promise<{
    booking: SchedulingBooking;
    meetingType: SchedulingMeetingType;
    staffProfile: SchedulingStaffProfile;
    availabilityRules: SchedulingAvailabilityRule[];
    blackoutDates: SchedulingBlackoutDate[];
    bookings: SchedulingBooking[];
    outlookEvents: any[];
  }> {
    const { data, error } = await supabase.functions.invoke('slotz-get-reschedule-context', {
      body: { bookingId }
    });

    if (error) {
      console.error('Error loading reschedule context:', error);
      throw new Error(error.message || `Database insert failed (${error.code || 'unknown code'})`);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  }

  async addBooking(
    booking: Omit<SchedulingBooking, 'id' | 'created_at' | 'updated_at'>
  ): Promise<SchedulingBooking | null> {
    console.log('🎯 Attempting to insert booking:', booking);
    console.log('🔧 Booking status being set:', booking.status);
    console.log('🔧 Trigger conditions check:');
    console.log('  - on_booking_confirmed fires when: NEW.status = confirmed');
    console.log('  - on_booking_created fires when: NEW.status = confirmed AND NEW.external_event_id IS NULL');
    
    const { data, error } = await supabase
      .from('scheduling_bookings')
      .insert([booking])
      .select()
      .single();

    console.log('🎯 Insert result:', { data, error });

    if (error) {
      console.error('Error adding booking:', error);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
      console.error('Error code:', error.code);
      
      // If it's the http_post function error, explain the fix needed
      if (error.code === '42883' && error.message.includes('http_post')) {
        console.log('🔧 HTTP POST function error detected');
        console.log('🔧 This affects both email confirmation and Outlook event creation');
        console.log('🔧 The triggers need to use net.http_post() instead of extensions.http_post()');
        console.log('🔧 Check if the net extension is enabled: CREATE EXTENSION IF NOT EXISTS net;');
      }
      
      throw error;
    }

    console.log('✅ Booking saved successfully!');
    console.log('🔧 Final booking data:', data);
    console.log('🔧 Triggers should now be firing for:');
    console.log('  1. Email confirmation (trigger_send_booking_confirmation)');
    console.log('  2. Outlook event creation (trigger_create_outlook_event)');
    console.log('🔧 Check Supabase Logs for Edge Function calls:');
    console.log('  - slotz-send-booking-confirmation');
    console.log('  - slotz-create-outlook-event');

    return data;
  }

  async updateBooking(
    id: string,
    updates: Partial<SchedulingBooking>
  ): Promise<SchedulingBooking | null> {
    const { data, error } = await supabase
      .from('scheduling_bookings')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating booking:', error);
      return null;
    }

    return data;
  }

  async updateBookingStatus(id: string, status: BookingStatus): Promise<void> {
    await this.updateBooking(id, { status });
  }

  async cancelBooking(bookingId: string, reason?: string): Promise<SchedulingBooking | null> {
    const { data, error } = await supabase.functions.invoke('slotz-cancel-booking', {
      body: { bookingId, reason }
    });

    if (error) {
      console.error('Error cancelling booking:', error);
      throw error;
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data?.booking || null;
  }

  async updateBookingTime(
    id: string,
    start_time: string,
    end_time: string
  ): Promise<SchedulingBooking | null> {
    return this.updateBooking(id, { start_time, end_time });
  }

  async rescheduleBooking(
    bookingId: string,
    startTime: string,
    endTime: string,
    guestTimezone?: string | null,
    reason?: string
  ): Promise<SchedulingBooking | null> {
    const { data, error } = await supabase.functions.invoke('slotz-reschedule-booking', {
      body: {
        bookingId,
        startTime,
        endTime,
        guestTimezone,
        reason
      }
    });

    if (error) {
      console.error('Error rescheduling booking:', error);
      throw error;
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data?.booking || null;
  }

  async deleteBooking(id: string): Promise<void> {
    const { error } = await supabase
      .from('scheduling_bookings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting booking:', error);
    }
  }

  // ============================================================================
  // MEETING TYPES
  // ============================================================================

  async getMeetingTypes(activeOnly = true): Promise<SchedulingMeetingType[]> {
    const staffId = await this.ensureCurrentStaffId();

    let query = supabase
      .from('scheduling_meeting_types')
      .select('*')
      .eq('staff_id', staffId);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.order('name');

    if (error) {
      console.error('Error fetching meeting types:', error);
      return [];
    }

    return data || [];
  }

  async addMeetingType(
    meetingType: Omit<SchedulingMeetingType, 'id' | 'created_at'>
  ): Promise<SchedulingMeetingType | null> {
    const { data, error } = await supabase
      .from('scheduling_meeting_types')
      .insert([meetingType])
      .select()
      .single();

    if (error) {
      console.error('Error adding meeting type:', error);
      return null;
    }

    return data;
  }

  async updateMeetingType(
    id: string,
    updates: Partial<SchedulingMeetingType>
  ): Promise<void> {
    const { error } = await supabase
      .from('scheduling_meeting_types')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating meeting type:', error);
    }
  }

  async deleteMeetingType(id: string): Promise<void> {
    const { error } = await supabase
      .from('scheduling_meeting_types')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting meeting type:', error);
    }
  }

  // ============================================================================
  // AVAILABILITY RULES
  // ============================================================================

  async getAvailabilityRules(): Promise<SchedulingAvailabilityRule[]> {
    const staffId = await this.ensureCurrentStaffId();

    const { data, error } = await supabase
      .from('scheduling_availability_rules')
      .select('*')
      .eq('staff_id', staffId)
      .order('day_of_week');

    if (error) {
      console.error('Error fetching availability rules:', error);
      return [];
    }

    return data || [];
  }

  async updateAvailabilityRule(
    id: string,
    updates: Partial<SchedulingAvailabilityRule>
  ): Promise<void> {
    const { error } = await supabase
      .from('scheduling_availability_rules')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating availability rule:', error);
    }
  }

  async createAvailabilityRule(
    rule: Omit<SchedulingAvailabilityRule, 'id' | 'created_at' | 'updated_at'>
  ): Promise<SchedulingAvailabilityRule> {
    const { data, error } = await supabase
      .from('scheduling_availability_rules')
      .insert(rule)
      .select()
      .single();

    if (error) {
      console.error('Error creating availability rule:', error);
      throw error;
    }

    return data;
  }

  // ============================================================================
  // BLACKOUT DATES
  // ============================================================================

  async getBlackoutDates(): Promise<SchedulingBlackoutDate[]> {
    const staffId = await this.ensureCurrentStaffId();

    const { data, error } = await supabase
      .from('scheduling_blackout_dates')
      .select('*')
      .eq('staff_id', staffId)
      .order('date');

    if (error) {
      console.error('Error fetching blackout dates:', error);
      return [];
    }

    return data || [];
  }

  async addBlackoutDate(date: string, note?: string): Promise<SchedulingBlackoutDate | null> {
    const staffId = await this.ensureCurrentStaffId();

    const { data, error } = await supabase
      .from('scheduling_blackout_dates')
      .insert([{
        staff_id: staffId,
        date,
        note
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding blackout date:', error);
      return null;
    }

    return data;
  }

  async deleteBlackoutDate(id: string): Promise<void> {
    const { error } = await supabase
      .from('scheduling_blackout_dates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting blackout date:', error);
    }
  }

  async deleteAllBlackoutDates(): Promise<void> {
    const staffId = await this.ensureCurrentStaffId();

    const { error } = await supabase
      .from('scheduling_blackout_dates')
      .delete()
      .eq('staff_id', staffId);

    if (error) {
      console.error('Error deleting blackout dates:', error);
      throw error;
    }
  }

  // ============================================================================
  // OUTLOOK SYNC
  // ============================================================================

  async getOutlookSync(): Promise<OutlookCalendarSync | null> {
    const staffId = await this.ensureCurrentStaffId();

    const { data, error } = await supabase
      .from('outlook_calendar_sync')
      .select('*')
      .eq('staff_id', staffId)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') { // Not found is OK
        console.error('Error fetching Outlook sync:', error);
    }
    
    return data;
  }

  async getOutlookEvents(): Promise<any[]> {
    const staffId = await this.ensureCurrentStaffId();

    const { data, error } = await supabase
      .from('outlook_synced_events')
      .select('*')
      .eq('staff_id', staffId)
      .order('event_start_time', { ascending: true });

    if (error) {
      console.error('Error fetching Outlook events:', error);
      return [];
    }

    return data || [];
  }

  async updateOutlookSync(updates: { is_enabled: boolean }): Promise<void> {
    const staffId = await this.ensureCurrentStaffId();

    const { error } = await supabase
      .from('outlook_calendar_sync')
      .upsert({
        staff_id: staffId,
        ...updates,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'staff_id'
      });
    
    if (error) {
      console.error('Error updating Outlook sync:', error);
    }
  }

  async saveOutlookTokens(tokens: {
    access_token: string;
    refresh_token: string;
    expires_at: string;
    refresh_token_expires_at?: string;
    account_id: string;
    account_username: string;
    account_name?: string;
  }) {
    const staffId = await this.ensureCurrentStaffId();

    const { error } = await supabase
      .from('outlook_oauth_tokens')
      .upsert({
        staff_id: staffId,
        ...tokens,
        token_type: 'Bearer',
        scope: 'User.Read Calendars.ReadWrite',
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'staff_id'
      });
    
    if (error) {
      console.error('Error saving Outlook tokens:', error);
    }
  }

  async getOutlookTokens() {
    const staffId = await this.ensureCurrentStaffId();

    const { data, error } = await supabase
      .from('outlook_oauth_tokens')
      .select('*')
      .eq('staff_id', staffId)
      .eq('is_active', true)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching Outlook tokens:', error);
    }
    
    return data;
  }

  async clearOutlookTokens() {
    const staffId = await this.ensureCurrentStaffId();

    const { error } = await supabase
      .from('outlook_oauth_tokens')
      .update({ is_active: false })
      .eq('staff_id', staffId);
    
    if (error) {
      console.error('Error clearing Outlook tokens:', error);
    }
  }

  async getGoogleTokens() {
    const staffId = await this.ensureCurrentStaffId();

    const { data, error } = await supabase
      .from('google_oauth_tokens')
      .select('*')
      .eq('staff_id', staffId)
      .eq('is_active', true)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching Google tokens:', error);
    }

    return data;
  }

  async getGoogleSync(): Promise<any | null> {
    const staffId = await this.ensureCurrentStaffId();

    const { data, error } = await supabase
      .from('google_calendar_sync')
      .select('*')
      .eq('staff_id', staffId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching Google sync:', error);
    }

    return data;
  }

  async updateGoogleSync(updates: { is_enabled: boolean }): Promise<void> {
    const staffId = await this.ensureCurrentStaffId();

    const { error } = await supabase
      .from('google_calendar_sync')
      .upsert({
        staff_id: staffId,
        ...updates,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'staff_id'
      });

    if (error) {
      console.error('Error updating Google sync:', error);
    }
  }

  async clearGoogleTokens() {
    const staffId = await this.ensureCurrentStaffId();

    const { error } = await supabase
      .from('google_oauth_tokens')
      .update({ is_active: false })
      .eq('staff_id', staffId);

    if (error) {
      console.error('Error clearing Google tokens:', error);
    }
  }

  async createSyncedEvent(data: {
    staff_id: string;
    outlook_event_id: string;
    booking_id?: string;
    event_subject: string;
    event_start_time: string;
    event_end_time: string;
    sync_direction: 'outlook_to_local' | 'local_to_outlook' | 'bidirectional';
    sync_status: 'synced' | 'pending' | 'error';
  }) {
    const { error } = await supabase
      .from('outlook_synced_events')
      .insert(data);

    if (error) {
      console.error('Error creating synced event:', error);
      throw error;
    }
  }

  async updateSyncedEvent(outlookEventId: string, updates: {
    sync_status?: 'synced' | 'pending' | 'error';
    sync_error?: string;
  }) {
    const { error } = await supabase
      .from('outlook_synced_events')
      .update(updates)
      .eq('outlook_event_id', outlookEventId);

    if (error) {
      console.error('Error updating synced event:', error);
    }
  }

  async enableOutlookSync(staffId: string): Promise<void> {
    const { error } = await supabase
      .from('outlook_calendar_sync')
      .upsert({
        staff_id: staffId,
        is_enabled: true,
        sync_interval_minutes: 1440, // 24 hours
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'staff_id'
      });

    if (error) {
      console.error('Error enabling Outlook sync:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const supabaseDb = new SupabaseDatabase();
