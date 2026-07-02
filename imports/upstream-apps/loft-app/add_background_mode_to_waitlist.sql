-- Add missing columns to loft_room_waitlist table for background mode tracking
-- This migration adds support for storing participant preferences

-- Add user_id column (foreign key to auth.users)
ALTER TABLE loft_room_waitlist
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add background_mode column to store participant's background effect preference
ALTER TABLE loft_room_waitlist
ADD COLUMN background_mode text DEFAULT 'none' CHECK (background_mode IN ('none', 'blur', 'image'));

-- Create index on user_id for faster lookups
CREATE INDEX idx_loft_room_waitlist_user_id ON loft_room_waitlist(user_id);

-- Create composite index for faster lookups by room and user
CREATE INDEX idx_loft_room_waitlist_room_user ON loft_room_waitlist(loft_room_id, user_id);

-- Add comment to document the new columns
COMMENT ON COLUMN loft_room_waitlist.user_id IS 'Reference to the authenticated user (null for guests)';
COMMENT ON COLUMN loft_room_waitlist.background_mode IS 'Participant background effect preference: none, blur, or image';
