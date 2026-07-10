import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"
import { resolveBohLoftIdentity } from "../_shared/loftIdentity.ts"

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
    status,
  })
}

function dailyReason(body: Record<string, unknown>) {
  const message = body?.message ?? body?.info ?? body?.error
  return typeof message === 'string' ? message : undefined
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function shouldRetryRecordingStart(result: { ok: boolean; status: number; body: Record<string, unknown> }) {
  if (result.ok || result.status === 409) return false
  const details = JSON.stringify(result.body || {}).toLowerCase()
  return result.status === 400 && (
    details.includes('invalid-request-error') ||
    details.includes('participant') ||
    details.includes('audio') ||
    details.includes('video') ||
    details.includes('connected')
  )
}

async function dailyRequest(params: {
  dailyRoomName: string
  dailyApiKey: string
  path: string
  body?: Record<string, unknown>
}) {
  const { dailyRoomName, dailyApiKey, path, body } = params
  const resp = await fetch(`https://api.daily.co/v1/rooms/${encodeURIComponent(dailyRoomName)}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${dailyApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body || {}),
  })
  const responseBody = await resp.json().catch(() => ({}))
  return { ok: resp.ok, status: resp.status, body: responseBody }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) })
  }

  try {
    const body = await req.json()
    const { roomId, isRecording, skipDaily = false } = body
    const externalBohUserId = typeof body?.currentUserProfile?.bohUserId === 'string'
      ? body.currentUserProfile.bohUserId.trim()
      : ''

    if (!roomId || typeof isRecording !== 'boolean') {
      return json(req, { error: 'missing_required_fields', message: 'Missing required fields: roomId, isRecording' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('jobzcafe_supabase_secret_key') ?? Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
    const dailyApiKey = Deno.env.get('DAILY_API_KEY')

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json(req, { error: 'server_not_configured' }, 500)
    }
    if (!dailyApiKey) {
      return json(req, { error: 'daily_not_configured', message: 'Recording is not configured for this environment.' }, 500)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser()
    const authedUser = userData?.user
    let identity: { bohUserId: string } | null = null
    if (!userError && authedUser) {
      identity = await resolveBohLoftIdentity(supabase, authedUser.id)
    }

    const { data: room, error: roomError } = await supabase
      .from('loft_room')
      .select('id, daily_room_name, host_boh_user_id, is_recorded')
      .eq('id', roomId)
      .single()

    if (roomError || !room) {
      return json(req, { error: 'room_not_found', message: 'This session could not be found.' }, 404)
    }
    const hostBohUserId = identity?.bohUserId || externalBohUserId
    if (!hostBohUserId) {
      return json(req, { error: 'unauthorized', message: 'Open the interview room from Talent again before changing recording.' }, 401)
    }
    if (room.host_boh_user_id !== hostBohUserId) {
      return json(req, { error: 'forbidden', message: 'Only the host can change recording.' }, 403)
    }
    if (!room.daily_room_name) {
      return json(req, { error: 'daily_room_missing', message: 'Recording cannot start because this session is missing its Daily room.' }, 400)
    }

    if (isRecording && !skipDaily) {
      const configResp = await dailyRequest({
        dailyRoomName: room.daily_room_name,
        dailyApiKey,
        path: '',
        body: { properties: { enable_recording: 'cloud' } },
      })
      if (!configResp.ok) {
        return json(req, {
          error: 'daily_recording_config_failed',
          message: 'Recording could not be enabled for this session.',
          dailyReason: dailyReason(configResp.body),
          status: configResp.status,
        }, 502)
      }

      let startResp = await dailyRequest({
        dailyRoomName: room.daily_room_name,
        dailyApiKey,
        path: '/recordings/start',
        body: {
          type: 'cloud',
          layout: { preset: 'default', max_cam_streams: 20 },
          maxDuration: 10800,
          minIdleTimeOut: 300,
          backgroundColor: '#0f122a',
        },
      })
      if (shouldRetryRecordingStart(startResp)) {
        await wait(1500)
        startResp = await dailyRequest({
          dailyRoomName: room.daily_room_name,
          dailyApiKey,
          path: '/recordings/start',
          body: {
            type: 'cloud',
            layout: { preset: 'default', max_cam_streams: 20 },
            maxDuration: 10800,
            minIdleTimeOut: 300,
            backgroundColor: '#0f122a',
          },
        })
      }
      if (!startResp.ok && startResp.status !== 409) {
        return json(req, {
          error: 'daily_recording_start_failed',
          message: 'Recording could not start. Make sure at least one participant has audio or video connected, then try again.',
          dailyReason: dailyReason(startResp.body),
          status: startResp.status,
        }, 502)
      }
    } else if (!isRecording && !skipDaily) {
      const stopResp = await dailyRequest({
        dailyRoomName: room.daily_room_name,
        dailyApiKey,
        path: '/recordings/stop',
        body: { type: 'cloud' },
      })
      if (!stopResp.ok && stopResp.status !== 400) {
        return json(req, {
          error: 'daily_recording_stop_failed',
          message: 'Daily could not stop recording for this session.',
          dailyReason: dailyReason(stopResp.body),
          status: stopResp.status,
        }, 502)
      }
    }

    const { data: updatedRoom, error: updateError } = await supabase
      .from('loft_room')
      .update({
        is_recorded: isRecording,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roomId)
      .select()
      .single()

    if (updateError) {
      return json(req, { error: 'recording_status_update_failed', message: 'Recording changed, but the session status could not be updated.' }, 500)
    }

    await supabase
      .from('loft_room_join_logs')
      .insert({
        room_id: roomId,
        join_type: isRecording ? 'recording_started' : 'recording_stopped',
        user_id: hostBohUserId,
        joined_at: new Date().toISOString(),
      })

    return json(req, {
      success: true,
      isRecording,
      room: updatedRoom,
      message: isRecording ? 'Recording started' : 'Recording stopped',
    })
  } catch (error) {
    console.error('Function error:', error)
    return json(req, { error: 'internal_server_error', message: 'Recording could not be changed.' }, 500)
  }
})
