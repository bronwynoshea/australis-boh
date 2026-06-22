-- Add scheduled deletion and recording tracking to loft_room table
ALTER TABLE loft_room 
ADD COLUMN scheduled_delete_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN is_recorded BOOLEAN DEFAULT FALSE;

-- Add index for efficient cleanup queries
CREATE INDEX idx_loft_room_scheduled_delete ON loft_room(scheduled_delete_at) WHERE scheduled_delete_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN loft_room.scheduled_delete_at IS 'Timestamp when room should be permanently deleted (5 days after ending for recorded rooms)';
COMMENT ON COLUMN loft_room.is_recorded IS 'Whether the room had recording enabled - triggers scheduled deletion';
