-- Migration: Add unique constraint to loft_room_member table
-- This prevents duplicate room memberships for the same user in the same room

-- Check if constraint already exists, if so, skip the migration
DO $$ 
BEGIN
    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'loft_room_member_room_profile_unique' 
        AND table_name = 'loft_room_member'
    ) THEN
        -- First, remove any existing duplicate entries (keeping the most recent one)
        DELETE FROM loft_room_member 
        WHERE id NOT IN (
            SELECT DISTINCT ON (loft_room_id, profile_id) id
            FROM loft_room_member 
            ORDER BY loft_room_id, profile_id, created_at DESC
        );

        -- Add unique constraint to prevent future duplicates
        ALTER TABLE loft_room_member 
        ADD CONSTRAINT loft_room_member_room_profile_unique 
        UNIQUE (loft_room_id, profile_id);

        RAISE NOTICE 'Added unique constraint to loft_room_member table';
    ELSE
        RAISE NOTICE 'Unique constraint already exists on loft_room_member table';
    END IF;
END $$;
