// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseSecretKey = Deno.env.get("SB_SECRET_KEY")

    if (!supabaseUrl || !supabaseSecretKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)

    // Parse body for params
    const body = await req.json().catch(() => ({}))
    const sectionId = body.section_id || null
    const includeArchived = body.include_archived === true

    let query = supabaseAdmin
      .from('central_tables')
      .select(`
        *,
        section:central_sections(id, name, color)
      `)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (sectionId) {
      query = query.eq('section_id', sectionId)
    }

    if (!includeArchived) {
      query = query.eq('is_archived', false)
    }

    const { data: tables, error } = await query

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tables', details: error.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({
        ok: true,
        tables: tables || []
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})