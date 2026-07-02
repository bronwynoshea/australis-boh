-- Create a secure function for guests to check their waitlist status
-- This function only exposes the minimal data needed and has strict validation

CREATE OR REPLACE FUNCTION check_guest_waitlist_status(
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
    v_guest_status text;
    v_result jsonb;
BEGIN
    -- Validate inputs
    IF p_slug IS NULL OR p_slug = '' THEN
        RETURN jsonb_build_object('error', 'Slug is required');
    END IF;
    
    IF p_guest_name IS NULL OR p_guest_name = '' THEN
        RETURN jsonb_build_object('error', 'Guest name is required');
    END IF;
    
    -- Get room ID from slug (validate room exists)
    SELECT lr.id INTO v_room_id
    FROM loft_room lr
    INNER JOIN profile p ON lr.id = p.personal_room_id
    WHERE p.personal_room_slug = p_slug
    AND p.can_use_personal_room = true;
    
    IF v_room_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Room not found');
    END IF;
    
    -- Check guest status (only return status, no other data)
    SELECT status INTO v_guest_status
    FROM loft_room_waitlist
    WHERE loft_room_id = v_room_id
    AND guest_name = p_guest_name
    LIMIT 1;
    
    -- Build response with minimal data
    v_result := jsonb_build_object(
        'roomId', v_room_id,
        'userApprovalStatus', v_guest_status
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'error', SQLERRM,
            'details', 'Failed to check guest waitlist status'
        );
END;
$$;
