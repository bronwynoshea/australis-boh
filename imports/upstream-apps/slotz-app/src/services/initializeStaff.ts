import { supabaseDb } from './supabaseDb';

export const initializeStaffDefaults = async (staffId: string) => {
  try {
    
    // Set the current staff ID for database operations
    supabaseDb.setCurrentStaff(staffId);
    
    // Initialize default meeting types
    
    // Check if meeting types already exist
    const existingTypes = await supabaseDb.getMeetingTypes(false); // Get ALL types, not just active
    
    // Define the 3 default meeting types
    const defaultTypes = [
      {
        staff_id: staffId,
        name: 'General Chat',
        slug: 'general-chat',
        description: 'A 25-minute structured conversation',
        duration_minutes: 25,
        buffer_minutes_after: 5,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        staff_id: staffId,
        name: 'Strategic Session',
        slug: 'strategic-session',
        description: 'In-depth 55-minute strategic planning session',
        duration_minutes: 55,
        buffer_minutes_after: 5,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        staff_id: staffId,
        name: 'Quick Chat',
        slug: 'quick-chat',
        description: 'Brief 15-minute check-in',
        duration_minutes: 15,
        buffer_minutes_after: 0,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
    ];
    
    // Check which meeting types are missing
    for (const defaultType of defaultTypes) {
      const exists = existingTypes.some(existing => existing.slug === defaultType.slug);
      
      if (!exists) {
        await supabaseDb.addMeetingType(defaultType);
      } else {
      }
    }
    
    // Initialize default availability rules (7 days a week)
    
    // Check if availability rules already exist
    const existingRules = await supabaseDb.getAvailabilityRules();
    
    // Define default availability rules for all 7 days
    const defaultAvailabilityRules = [
      { day_of_week: 0, start_time: '07:00:00', end_time: '13:00:00', is_enabled: false }, // Sunday - unavailable
      { day_of_week: 1, start_time: '07:00:00', end_time: '13:00:00', is_enabled: true },  // Monday - available
      { day_of_week: 2, start_time: '07:00:00', end_time: '13:00:00', is_enabled: true },  // Tuesday - available
      { day_of_week: 3, start_time: '07:00:00', end_time: '13:00:00', is_enabled: true },  // Wednesday - available
      { day_of_week: 4, start_time: '07:00:00', end_time: '13:00:00', is_enabled: true },  // Thursday - available
      { day_of_week: 5, start_time: '07:00:00', end_time: '13:00:00', is_enabled: true },  // Friday - available
      { day_of_week: 6, start_time: '07:00:00', end_time: '13:00:00', is_enabled: false }, // Saturday - unavailable
    ];
    
    // Create missing availability rules
    for (const defaultRule of defaultAvailabilityRules) {
      const exists = existingRules.some(existing => existing.day_of_week === defaultRule.day_of_week);
      
      if (!exists) {
        await supabaseDb.createAvailabilityRule({
          staff_id: staffId,
          day_of_week: defaultRule.day_of_week,
          start_time: defaultRule.start_time,
          end_time: defaultRule.end_time,
          is_enabled: defaultRule.is_enabled,
          timezone: 'Australia/Sydney'
        });
      } else {
      }
    }
    
    // Verify all 7 availability rules exist
    const finalRules = await supabaseDb.getAvailabilityRules();
    if (finalRules.length === 7) {
    } else {
    }
    
    // Verify all 3 meeting types exist
    const finalTypes = await supabaseDb.getMeetingTypes(false);
    const defaultSlugs = defaultTypes.map(t => t.slug);
    const allExist = defaultSlugs.every(slug => finalTypes.some(t => t.slug === slug));
    
    if (allExist) {
    } else {
    }
    
    
  } catch (error) {
    console.error('❌ Error initializing staff defaults:', error);
  }
};

// Helper function to run initialization for current logged-in staff
export const runInitializationForCurrentUser = async () => {
  try {
    const currentStaffId = supabaseDb.getCurrentStaffId();
    if (!currentStaffId) {
      console.error('❌ No staff ID set. Please log in first.');
      return;
    }
    
    await initializeStaffDefaults(currentStaffId);
  } catch (error) {
    console.error('❌ Error running initialization:', error);
  }
};
