-- Add meeting_link column to scheduling_staff_profiles table
ALTER TABLE scheduling_staff_profiles 
ADD COLUMN meeting_link TEXT NULL;

-- Add comment to describe the column
COMMENT ON COLUMN scheduling_staff_profiles.meeting_link IS 'Personal Meeting Room link (Zoom, Teams, Google Meet, etc.)';
