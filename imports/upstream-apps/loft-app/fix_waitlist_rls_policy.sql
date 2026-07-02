-- Fix the overly permissive RLS policy for loft_room_waitlist
-- Replace the "Anyone can request room access" policy with a more secure one

-- First, drop the existing permissive policy
DROP POLICY IF EXISTS "Anyone can request room access" ON loft_room_waitlist;

-- Create a more secure policy that allows:
-- 1. Anyone to insert their own waitlist request
-- 2. Personal Room owners to manage their own room's waitlist

-- Policy for guests to add themselves to waitlist
CREATE POLICY "Guests can request room access" ON loft_room_waitlist
FOR INSERT
WITH CHECK (
    -- Only allow inserts if the room exists and is accessible
    EXISTS (
        SELECT 1 FROM loft_room lr
        INNER JOIN profile p ON lr.id = p.personal_room_id
        WHERE lr.id = loft_room_waitlist.loft_room_id
        AND p.personal_room_slug IS NOT NULL
        AND p.can_use_personal_room = true
    )
    AND
    -- Prevent duplicate entries
    NOT EXISTS (
        SELECT 1 FROM loft_room_waitlist w2
        WHERE w2.loft_room_id = loft_room_waitlist.loft_room_id
        AND w2.guest_name = loft_room_waitlist.guest_name
        AND w2.status IN ('pending', 'approved')
    )
);

-- Policy for personal room owners to see their own room's waitlist
CREATE POLICY "Hosts can view their room waitlist" ON loft_room_waitlist
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM loft_room lr
        WHERE lr.id = loft_room_waitlist.loft_room_id
        AND lr.host_profile_id = auth.uid()
    )
);

-- Policy for personal room owners to update their own room's waitlist
CREATE POLICY "Hosts can manage their room waitlist" ON loft_room_waitlist
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM loft_room lr
        WHERE lr.id = loft_room_waitlist.loft_room_id
        AND lr.host_profile_id = auth.uid()
    )
);

-- Policy for personal room owners to delete from their own room's waitlist
CREATE POLICY "Hosts can delete from their room waitlist" ON loft_room_waitlist
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM loft_room lr
        WHERE lr.id = loft_room_waitlist.loft_room_id
        AND lr.host_profile_id = auth.uid()
    )
);
