// Edge function for Lessons Learned - Query and manage knowledge base
// Used by agents to avoid repeating mistakes

import { corsHeaders, handleCors } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const url = new URL(req.url)
    const path = url.pathname.replace('/lessons-learned', '')

    // Get Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseSecretKey = Deno.env.get("SB_SECRET_KEY")
    
    if (!supabaseUrl || !supabaseSecretKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Route requests
    if (req.method === 'GET' && path === '/search') {
      return await searchLessons(req, supabaseUrl, supabaseSecretKey)
    }
    
    if (req.method === 'GET' && path === '/relevant') {
      return await getRelevantLessons(req, supabaseUrl, supabaseSecretKey)
    }
    
    if (req.method === 'POST' && path === '') {
      return await createLesson(req, supabaseUrl, supabaseSecretKey)
    }
    
    if (req.method === 'POST' && path === '/apply') {
      return await recordLessonApplied(req, supabaseUrl, supabaseSecretKey)
    }

    return new Response(
      JSON.stringify({ error: "Not found", path }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (err) {
    console.error('[lessons-learned] Error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

// Search lessons by query, tags, category
async function searchLessons(req: Request, supabaseUrl: string, supabaseSecretKey: string) {
  const url = new URL(req.url)
  const query = url.searchParams.get('q') || ''
  const category = url.searchParams.get('category')
  const severity = url.searchParams.get('severity')
  const sectionId = url.searchParams.get('section_id')
  const agentId = url.searchParams.get('agent_id')
  const limit = parseInt(url.searchParams.get('limit') || '20')
  
  // Build Supabase query
  let dbQuery = `${supabaseUrl}/rest/v1/lessons_learned?select=*&is_archived=eq.false`
  
  if (query) {
    dbQuery += `&or=(title.ilike.*${query}*,description.ilike.*${query}*,tags.cs.{${query}})`
  }
  
  if (category) {
    dbQuery += `&category=eq.${category}`
  }
  
  if (severity) {
    dbQuery += `&severity=eq.${severity}`
  }
  
  if (sectionId) {
    dbQuery += `&section_id=eq.${sectionId}`
  }
  
  if (agentId) {
    dbQuery += `&agent_id=eq.${agentId}`
  }
  
  dbQuery += `&order=severity.desc,impact_count.desc,created_at.desc&limit=${limit}`
  
  const resp = await fetch(dbQuery, {
    headers: {
      'Authorization': `Bearer ${supabaseSecretKey}`,
      'apikey': supabaseSecretKey,
      'Content-Type': 'application/json'
    }
  })
  
  const lessons = await resp.json()
  
  return new Response(JSON.stringify({ 
    ok: true, 
    lessons,
    count: lessons.length 
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  })
}

// Get lessons relevant to current context (for agents)
async function getRelevantLessons(req: Request, supabaseUrl: string, supabaseSecretKey: string) {
  const url = new URL(req.url)
  const agentId = url.searchParams.get('agent_id')
  const sectionId = url.searchParams.get('section_id')
  const tags = url.searchParams.get('tags')?.split(',') || []
  
  let dbQuery = `${supabaseUrl}/rest/v1/lessons_learned?select=*&is_archived=eq.false&severity=in.(high,critical)`
  
  if (agentId) {
    dbQuery += `&or=(agent_id.eq.${agentId},agent_id.is.null)`
  }
  
  if (sectionId) {
    dbQuery += `&or=(section_id.eq.${sectionId},section_id.is.null)`
  }
  
  if (tags.length > 0) {
    const tagFilter = tags.map(t => `tags.cs.{${t}}`).join(',')
    dbQuery += `&or=(${tagFilter})`
  }
  
  dbQuery += `&order=severity.desc,impact_count.desc&limit=10`
  
  const resp = await fetch(dbQuery, {
    headers: {
      'Authorization': `Bearer ${supabaseSecretKey}`,
      'apikey': supabaseSecretKey,
      'Content-Type': 'application/json'
    }
  })
  
  const lessons = await resp.json()
  
  return new Response(JSON.stringify({ 
    ok: true, 
    lessons,
    context: { agentId, sectionId, tags }
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  })
}

// Create new lesson
async function createLesson(req: Request, supabaseUrl: string, supabaseSecretKey: string) {
  const body = await req.json()
  const { title, description, category, severity, tags, resolution, prevention_steps, agent_id, section_id, task_id, source_type } = body
  
  if (!title || !description || !category) {
    return new Response(
      JSON.stringify({ error: "title, description, and category are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
  
  const lesson = {
    title,
    description,
    category,
    severity: severity || 'medium',
    tags: tags || [],
    resolution,
    prevention_steps: prevention_steps || [],
    agent_id,
    section_id,
    task_id,
    source_type: source_type || 'manual'
  }
  
  const resp = await fetch(`${supabaseUrl}/rest/v1/lessons_learned`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseSecretKey}`,
      'apikey': supabaseSecretKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(lesson)
  })
  
  const result = await resp.json()
  
  return new Response(JSON.stringify({ 
    ok: resp.ok, 
    lesson: result[0] 
  }), {
    status: resp.ok ? 201 : 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  })
}

// Record that a lesson was applied (increment impact_count)
async function recordLessonApplied(req: Request, supabaseUrl: string, supabaseSecretKey: string) {
  const body = await req.json()
  const { lessonId } = body
  
  if (!lessonId) {
    return new Response(
      JSON.stringify({ error: "lessonId is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
  
  const resp = await fetch(`${supabaseUrl}/rest/v1/lessons_learned?id=eq.${lessonId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${supabaseSecretKey}`,
      'apikey': supabaseSecretKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      impact_count: `impact_count + 1`,
      last_applied_at: new Date().toISOString()
    })
  })
  
  return new Response(JSON.stringify({ 
    ok: resp.ok 
  }), {
    status: resp.ok ? 200 : 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  })
}
