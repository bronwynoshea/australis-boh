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

    // Fetch all sections (they're fixed)
    const { data: sections, error: sectionsError } = await supabaseAdmin
      .from('central_sections')
      .select('*')
      .order('sort_order', { ascending: true })

    if (sectionsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sections', details: sectionsError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Fetch tables for each section
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('central_tables')
      .select('*')
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (tablesError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tables', details: tablesError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Group tables by section
    const sectionsWithTables = sections.map(section => ({
      ...section,
      tables: tables.filter(t => t.section_id === section.id) || []
    }))

    return new Response(
      JSON.stringify({
        ok: true,
        sections: sectionsWithTables
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