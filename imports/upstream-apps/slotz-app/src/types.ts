// types.ts

/**
 * Booking Status Enum
 * Represents the current state of a booking
 */
export enum BookingStatus {
  PENDING = 'pending',        // Booking created but not yet confirmed
  CONFIRMED = 'confirmed',    // Booking confirmed and active
  CANCELLED = 'cancelled',    // Booking cancelled by guest or staff (note: changed from CANCELED to match DB)
  COMPLETED = 'completed',    // Booking finished successfully
  NO_SHOW = 'no_show',       // Guest didn't show up
  RESCHEDULED = 'rescheduled' // Booking was rescheduled (optional, for tracking)
}

/**
 * Calendar Provider Enum
 * Supported external calendar integrations
 */
export enum CalendarProvider {
  OUTLOOK = 'outlook',
  GOOGLE = 'google',
  APPLE = 'apple'
}

/**
 * App Context Enum
 * Different contexts for the application
 */
export enum AppContext {
  CAFE = 'cafe',
  BOH = 'boh'
}

/**
 * Sync Status Enum
 * Status of calendar synchronization
 */
export enum SyncStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  PENDING = 'pending',
  NOT_SYNCED = 'not_synced'
}

/**
 * Staff Profile
 * Core profile information for staff members who accept bookings
 */
export interface SchedulingStaffProfile {
  id: string;                           // uuid - Primary key
  user_id: string;                      // uuid - References auth.users.id
  full_name: string;                    // Staff member's full name
  email: string;                        // Contact email
  slug: string;                         // URL-friendly identifier (e.g., "john-doe")
  tenant_id?: string | null;             // BOH tenant that owns this SLOTZ profile
  avatar_url?: string | null;           // Profile picture URL
  timezone: string;                     // IANA timezone (e.g., "America/New_York")
  app_context: AppContext;              // Application context
  bio?: string | null;                  // Staff bio/description
  phone?: string | null;                // Contact phone number
  meeting_link?: string | null;         // Personal meeting room link (Zoom, Teams, etc.)
  is_active: boolean;                   // Whether staff is accepting bookings
  created_at: string;                   // ISO timestamp
  updated_at: string;                   // ISO timestamp
}

/**
 * Meeting Type
 * Configurable meeting types that staff can offer
 */
export interface SchedulingMeetingType {
  id: string;                           // uuid - Primary key
  staff_id: string;                     // uuid - References staff profile
  name: string;                         // Display name (e.g., "30-Min Consultation")
  slug: string;                         // URL-friendly identifier
  description: string;                  // Meeting description/purpose
  duration_minutes: number;             // Meeting duration (e.g., 30)
  buffer_minutes_before?: number;       // Buffer before meeting (default: 0)
  buffer_minutes_after: number;         // Buffer after meeting
  minimum_notice_hours?: number;        // Minimum notice required for booking (default: 24)
  is_active: boolean;                   // Whether this meeting type is bookable
  color?: string | null;                // Color code for calendar display
  location_type?: 'virtual' | 'in_person' | 'phone' | null; // Meeting location
  price?: number | null;                // Price if applicable
  currency?: string | null;             // Currency code (e.g., "USD")
  max_bookings_per_day?: number | null; // Daily booking limit
  requires_approval?: boolean;          // Whether bookings need approval

  // Loft video bridge
  loft_video_enabled?: boolean;
  loft_business_context?: 'interview' | 'coaching' | 'onboarding' | 'appointment' | 'group_session' | 'internal_meeting' | 'other';
  loft_host_persona?: 'recruiter' | 'coach' | 'staff';

  created_at: string;                   // ISO timestamp
  updated_at: string;                   // ISO timestamp
}

/**
 * Booking
 * Represents a scheduled appointment
 */
export interface SchedulingBooking {
  id: string;                           // uuid - Primary key
  staff_id: string;                     // uuid - References staff profile
  meeting_type_id: string;              // uuid - References meeting type
  
  // Guest Information
  guest_name: string;                   // Guest's full name
  guest_email: string;                  // Guest's email
  guest_phone?: string | null;          // Guest's phone number
  guest_notes?: string | null;           // Guest's notes/agenda
  guest_timezone?: string | null;       // Guest's IANA timezone
  
  // Booking Details
  start_time: string;                   // ISO timestamp with timezone
  end_time: string;                     // ISO timestamp with timezone
  status: BookingStatus;                // Current booking status
  
  // Additional Information
  agenda_notes?: string | null;         // Guest's notes/agenda
  cancellation_reason?: string | null;  // Reason for cancellation
  internal_notes?: string | null;       // Staff-only notes
  
  // Meeting Links
  video_url?: string | null;            // Video meeting URL (Zoom, Teams, etc.)
  location?: string | null;             // Physical location if in-person
  
  // External Calendar Integration
  external_event_id?: string | null;    // Generic external event ID
  external_calendar_provider?: CalendarProvider | null; // Which calendar provider
  outlook_event_id?: string | null;     // Outlook-specific event ID
  google_event_id?: string | null;      // Google-specific event ID
  
  // Metadata
  confirmation_sent_at?: string | null; // When confirmation email was sent
  reminder_sent_at?: string | null;     // When reminder was sent
  rescheduled_at?: string | null;       // When the booking was last rescheduled
  rescheduled_by?: string | null;       // Actor that rescheduled the booking
  reschedule_reason?: string | null;    // Optional reschedule reason
  previous_start_time?: string | null;  // Previous start time for audit trail
  previous_end_time?: string | null;    // Previous end time for audit trail
  created_at: string;                   // ISO timestamp
  updated_at: string;                   // ISO timestamp
  
  // Joined data (when fetched with relations)
  scheduling_meeting_types?: SchedulingMeetingType;
  scheduling_staff_profiles?: SchedulingStaffProfile;
  loft_video_session?: {
    id: string;
    loft_room_id: string | null;
    join_url: string | null;
    status: string;
    scheduled_start_at: string | null;
    scheduled_end_at: string | null;
  } | null;
}

/**
 * Availability Rule
 * Defines when staff members are available for bookings
 */
export interface SchedulingAvailabilityRule {
  id: string;                           // uuid - Primary key
  staff_id: string;                     // uuid - References staff profile
  day_of_week: number;                  // 0 (Sunday) to 6 (Saturday)
  start_time: string;                   // Time in HH:mm:ss format (e.g., "09:00:00")
  end_time: string;                     // Time in HH:mm:ss format (e.g., "17:00:00")
  is_enabled: boolean;                  // Whether this rule is active
  timezone?: string | null;             // Override timezone for this rule
  created_at: string;                   // ISO timestamp
  updated_at: string;                   // ISO timestamp
}

/**
 * Blackout Date
 * Dates/times when staff is unavailable (time off, holidays, etc.)
 */
export interface SchedulingBlackoutDate {
  id: string;                           // uuid - Primary key
  staff_id: string;                     // uuid - References staff profile
  date: string;                         // Date in YYYY-MM-DD format
  start_time?: string | null;           // Optional start time (HH:mm:ss) for partial day
  end_time?: string | null;             // Optional end time (HH:mm:ss) for partial day
  is_all_day: boolean;                  // Whether this blocks the entire day
  note?: string | null;                 // Reason for blackout (e.g., "Vacation")
  recurring?: boolean;                  // Whether this repeats annually
  created_at: string;                   // ISO timestamp
  updated_at: string;                   // ISO timestamp
}

/**
 * Outlook Calendar Sync Configuration
 * Settings for Outlook calendar integration
 */
export interface OutlookCalendarSync {
  id: string;                           // uuid - Primary key
  staff_id: string;                     // uuid - References staff profile (unique)
  
  // Sync Status
  is_enabled: boolean;                  // Whether sync is active
  sync_interval_minutes: number;        // How often to sync (e.g., 15)
  last_sync_at?: string | null;         // Last successful sync timestamp
  last_sync_status?: SyncStatus | null; // Status of last sync
  last_sync_error?: string | null;      // Error message if sync failed
  
  // Calendar Settings
  sync_calendar_id?: string | null;     // Outlook calendar ID to sync
  sync_calendar_name?: string | null;   // Calendar display name
  timezone?: string | null;             // Timezone for sync operations
  
  // Buffer Settings
  buffer_minutes_before: number;        // Buffer before Outlook events
  buffer_minutes_after: number;         // Buffer after Outlook events
  
  // Token Management (if storing tokens - consider encryption)
  access_token?: string | null;         // Encrypted OAuth access token
  refresh_token?: string | null;        // Encrypted OAuth refresh token
  token_expires_at?: string | null;     // Token expiration timestamp
  
  // Webhook Configuration
  webhook_subscription_id?: string | null;    // Microsoft Graph webhook ID
  webhook_expiration?: string | null;         // Webhook expiration time
  
  // Sync Preferences
  sync_direction?: 'one_way' | 'two_way' | null; // Sync direction
  auto_accept_meetings?: boolean;       // Auto-accept meeting invites
  
  created_at: string;                   // ISO timestamp
  updated_at: string;                   // ISO timestamp
}

/**
 * Busy Block
 * Represents a time period when staff is busy (from any source)
 */
export interface BusyBlock {
  start: string;                        // ISO timestamp
  end: string;                          // ISO timestamp
  source: 'internal' | 'outlook' | 'google' | 'manual'; // Where this block came from
  title?: string | null;                // Optional title/description
  all_day?: boolean;                    // Whether this is an all-day block
  event_id?: string | null;             // External event ID if applicable
}

/**
 * Available Time Slot
 * Represents an available booking slot
 */
export interface AvailableTimeSlot {
  start: string;                        // ISO timestamp
  end: string;                          // ISO timestamp
  duration_minutes: number;             // Slot duration
  is_available: boolean;                // Whether slot is bookable
  timezone: string;                     // Timezone for this slot
}

/**
 * Calendar Event (for display)
 * Unified event structure for calendar views
 */
export interface CalendarEvent {
  id: string;                           // Event ID
  title: string;                        // Event title
  start: string;                        // ISO timestamp
  end: string;                          // ISO timestamp
  type: 'booking' | 'busy' | 'blackout' | 'available'; // Event type
  status?: BookingStatus;               // Booking status if applicable
  color?: string;                       // Display color
  source?: 'internal' | 'outlook' | 'google'; // Event source
  meeting_type?: SchedulingMeetingType; // Meeting type if booking
  guest_info?: {                        // Guest details if booking
    name: string;
    email: string;
    phone?: string | null;
  };
}

/**
 * Booking Form Data
 * Data structure for creating/updating bookings
 */
export interface BookingFormData {
  meeting_type_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
  guest_timezone?: string;
  start_time: string;
  timezone: string;
  agenda_notes?: string;
}

/**
 * Availability Query Parameters
 * Parameters for fetching available time slots
 */
export interface AvailabilityQuery {
  staff_id: string;
  meeting_type_id: string;
  date: string;                         // YYYY-MM-DD
  timezone: string;                     // IANA timezone
  duration_minutes?: number;            // Override duration
}

/**
 * Email Template Data
 * Data passed to email templates
 */
export interface EmailTemplateData {
  booking: SchedulingBooking;
  meeting_type: SchedulingMeetingType;
  staff_profile: SchedulingStaffProfile;
  action_url?: string;                  // URL for manage/reschedule
  formatted_date?: string;              // Pre-formatted date
  formatted_time?: string;              // Pre-formatted time
}

/**
 * Webhook Notification
 * Structure for webhook notifications from external calendars
 */
export interface WebhookNotification {
  change_type: 'created' | 'updated' | 'deleted';
  resource: string;                     // Resource URL
  resource_data?: {
    id: string;
    [key: string]: any;
  };
  client_state?: string;                // Verification token
  subscription_id?: string;             // Webhook subscription ID
  subscription_expiration_date_time?: string;
}

/**
 * Sync Result
 * Result of a calendar sync operation
 */
export interface SyncResult {
  success: boolean;
  synced_at: string;                    // ISO timestamp
  items_synced: number;
  items_created: number;
  items_updated: number;
  items_deleted: number;
  errors?: Array<{
    item_id: string;
    error: string;
  }>;
}

/**
 * Database Query Filters
 * Common filter parameters for database queries
 */
export interface BookingFilters {
  staff_id?: string;
  status?: BookingStatus | BookingStatus[];
  start_date?: string;                  // ISO date
  end_date?: string;                    // ISO date
  guest_email?: string;
  meeting_type_id?: string;
}

/**
 * Pagination Parameters
 */
export interface PaginationParams {
  page: number;
  per_page: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}
