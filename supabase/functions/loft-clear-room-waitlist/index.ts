import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const requestCorsHeaders = corsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: requestCorsHeaders });
  }

  try {
    const { loftRoomId } = await req.json();

    if (!loftRoomId) {
      return new Response(
        JSON.stringify({ error: 'loftRoomId is required' }),
        { status: 400, headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(
        JSON.stringify({ error: 'server_not_configured' }),
        { status: 500, headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const supabaseAuthed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuthed.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'not_authenticated' }),
        { status: 401, headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profileByUserId, error: profileByUserIdError } = await supabase
      .from('profile')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    let profile = profileByUserId;
    let profileError = profileByUserIdError;

    if (!profile?.id && !profileByUserIdError) {
      const profileByIdLookup = await supabase
        .from('profile')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      profile = profileByIdLookup.data;
      profileError = profileByIdLookup.error;
    }

    if (profileError || !profile?.id) {
      return new Response(
        JSON.stringify({ error: 'profile_not_found' }),
        { status: 400, headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: room, error: roomError } = await supabase
      .from('loft_room')
      .select('id, host_profile_id')
      .eq('id', loftRoomId)
      .maybeSingle();

    if (roomError || !room?.id) {
      return new Response(
        JSON.stringify({ error: 'room_not_found' }),
        { status: 404, headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (room.host_profile_id !== profile.id) {
      return new Response(
        JSON.stringify({ error: 'not_owner' }),
        { status: 403, headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete all waitlist entries for this room
    const { error } = await supabase
      .from('loft_room_waitlist')
      .delete()
      .eq('loft_room_id', loftRoomId);

    if (error) {
      console.error('[loft-clear-room-waitlist] Error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[loft-clear-room-waitlist] Cleared all waitlist entries for room:', loftRoomId);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[loft-clear-room-waitlist] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
