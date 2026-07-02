import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) })
  }

  try {
    const { waitlistEntryId } = await req.json()

    if (!waitlistEntryId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: waitlistEntryId' }),
        { headers: corsHeaders(req.headers.get('origin')), status: 400 }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase
      .from('loft_room_waitlist')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString()
      })
      .eq('id', waitlistEntryId)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to approve entry', details: error.message }),
        { headers: corsHeaders(req.headers.get('origin')), status: 500 }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        entry: data,
        message: 'Guest approved successfully' 
      }),
      { headers: corsHeaders(req.headers.get('origin')), status: 200 }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { headers: corsHeaders(req.headers.get('origin')), status: 500 }
    )
  }
})
