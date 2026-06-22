-- Create the request_personal_room_access function
CREATE OR REPLACE FUNCTION request_personal_room_access(
    p_slug text,
    p_guest_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room_id uuid;
    v_result jsonb;
BEGIN
    -- Get the room ID from the slug
    SELECT lr.id INTO v_room_id
    FROM loft_room lr
    INNER JOIN profile p ON lr.id = p.personal_room_id
    WHERE p.personal_room_slug = p_slug;
    
    -- Check if room exists
    IF v_room_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Room not found');
    END IF;
    
    -- Check if guest is already on waitlist
    IF EXISTS (
        SELECT 1 FROM loft_room_waitlist 
        WHERE loft_room_id = v_room_id 
        AND guest_name = p_guest_name
    ) THEN
        RETURN jsonb_build_object('error', 'Guest already on waitlist');
    END IF;
    
    -- Add guest to waitlist
    INSERT INTO loft_room_waitlist (
        loft_room_id,
        guest_name,
        status,
        requested_at
    ) VALUES (
        v_room_id,
        p_guest_name,
        'pending',
        NOW()
    );
    
    -- Return success
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Guest added to waitlist',
        'room_id', v_room_id,
        'guest_name', p_guest_name
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'error', SQLERRM,
            'details', 'Failed to add guest to waitlist'
        );
END;
$$;
