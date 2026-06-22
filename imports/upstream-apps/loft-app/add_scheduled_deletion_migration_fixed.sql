-- Add scheduled deletion column to loft_room table (is_recorded already exists)
ALTER TABLE loft_room 
ADD COLUMN scheduled_delete_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient cleanup queries
CREATE INDEX idx_loft_room_scheduled_delete ON loft_room(scheduled_delete_at) WHERE scheduled_delete_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN loft_room.scheduled_delete_at IS 'Timestamp when room should be permanently deleted (5 days after ending for recorded rooms)';

-- Check if is_recorded column exists and add comment if needed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'loft_room' 
        AND column_name = 'is_recorded'
    ) THEN
        COMMENT ON COLUMN loft_room.is_recorded IS 'Whether the room had recording enabled - triggers scheduled deletion';
    END IF;
END $$;
