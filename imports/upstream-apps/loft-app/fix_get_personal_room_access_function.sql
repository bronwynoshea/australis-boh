-- Fix the search_path issue for get_personal_room_access function
-- This function already exists, we just need to add the search_path

CREATE OR REPLACE FUNCTION get_personal_room_access(
    slug text,
    guestName text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room_id uuid;
    v_room_title text;
    v_host_name text;
    v_host_profile_id uuid;
    v_is_open boolean;
    v_public_join_enabled boolean;
    v_result jsonb;
    v_user_approval_status text;
BEGIN
    -- Get room details
    SELECT 
        lr.id,
        lr.title,
        lr.is_open,
        lr.public_join_enabled,
        lr.host_profile_id,
        p.display_name,
        p.full_name
    INTO 
        v_room_id,
        v_room_title,
        v_is_open,
        v_public_join_enabled,
        v_host_profile_id,
        v_host_name,
        v_host_name
    FROM loft_room lr
    INNER JOIN profile p ON lr.id = p.personal_room_id
    WHERE p.personal_room_slug = slug;
    
    -- Check if room exists
    IF v_room_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Room not found');
    END IF;
    
    -- Check if guest is already on waitlist
    IF guestName IS NOT NULL THEN
        SELECT status INTO v_user_approval_status
        FROM loft_room_waitlist
        WHERE loft_room_id = v_room_id
        AND guest_name = guestName
        LIMIT 1;
    END IF;
    
    -- Build response
    v_result := jsonb_build_object(
        'roomId', v_room_id,
        'title', COALESCE(v_room_title, 'Personal Room'),
        'hostName', COALESCE(v_host_name, 'Host'),
        'hostDetails', jsonb_build_object(
            'profileId', v_host_profile_id,
            'displayName', COALESCE(v_host_name, 'Host')
        ),
        'accessStatus', jsonb_build_object(
            'isOpen', v_is_open,
            'requiresApproval', NOT (v_is_open AND v_public_join_enabled)
        )
    );
    
    -- Add user approval status if available
    IF v_user_approval_status IS NOT NULL THEN
        v_result := jsonb_set(v_result, '{userApprovalStatus}', to_jsonb(v_user_approval_status));
    END IF;
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'error', SQLERRM,
            'details', 'Failed to get personal room access'
        );
END;
$$;
