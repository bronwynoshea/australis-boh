/// <reference path="./types.d.ts" />
// @ts-ignore - Deno modules not available in dev environment but work in Supabase runtime
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Supabase client module not available in dev environment but works in Supabase runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Edge function configuration from environment variables
const edgeFunctionConfig = {
  // Set to true to disable JWT authentication for development/testing
  disableAuth: Deno.env.get('DISABLE_AUTH') === 'true',
  
  // Set to true to enable detailed logging
  enableDebugLogging: Deno.env.get('DEBUG_LOGGING') === 'true'
};

// CORS headers inline
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
} as const

// Types
interface IntakePayload {
  source_page: string
  cta_clicked: string
  user_type_key: string
  hiring_role: string
  hiring_timeline_key: string
  biggest_problem_key: string
  desired_next_step_key: string
  first_name?: string
  last_name?: string
  work_email?: string
  company_name?: string
  notes?: string
  raw_payload?: Record<string, any>
}

interface LookupValue {
  key: string
  label: string
  is_active: boolean
}

interface PersonType {
  key: string
  label: string
  is_active: boolean
}

interface PipelineStage {
  id: string
  tenant_id: string
  key: string
  label: string
  is_active: boolean
}

interface Person {
  id: string
  tenant_id: string
  first_name?: string
  last_name?: string
  email?: string
  source?: string
  person_type_key: string
  pipeline_stage_id: string
  app_context: string
}

interface Organisation {
  id: string
  tenant_id: string
  name: string
  app_context: string
}

interface IntakeResponse {
  success: boolean
  person_id?: string
  organisation_id?: string | null
  intake_id?: string
  qualification_status_key?: string
  routed_to_key?: string
  next_action?: string
  redirect_url?: string
  error?: string
}

// Environment variables
const CHATZ_BOOKING_URL = Deno.env.get('CHATZ_BOOKING_URL') || 'https://chatz.jobzcafe.com/#/bronwyn-oshea/general-chat'
const TALENT_EXPLAINER_URL = Deno.env.get('TALENT_EXPLAINER_URL') || '/recruiter/talent'
const UPDATES_URL = Deno.env.get('UPDATES_URL') || '/recruiter/updates'

// Database client
function createSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SB_SECRET_KEY')!
  )
}

async function getTargetTenantId(supabase: any): Promise<string> {
  const explicitTenantId = Deno.env.get('BOH_TENANT_ID')?.trim()
  if (explicitTenantId) return explicitTenantId

  const tenantSlug = Deno.env.get('BOH_TENANT_SLUG')?.trim() || 'australis'
  const { data, error } = await supabase
    .from('boh_tenant')
    .select('id')
    .eq('slug', tenantSlug)
    .single()

  if (error || !data?.id) {
    throw new Error(`Unable to resolve BOH tenant for Patron intake: ${tenantSlug}`)
  }

  return data.id
}

// Authentication middleware
async function authenticateRequest(req: Request): Promise<{ user: any | null; error?: string }> {
  const authHeader = req.headers.get('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid authorization header' }
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = createSupabaseClient()

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return { user: null, error: 'Invalid or expired token' }
    }

    return { user }
  } catch (error) {
    console.error('Auth error:', error)
    return { user: null, error: 'Authentication failed' }
  }
}

// Validate lookup values
async function validateLookupKeys(
  supabase: any,
  tenantId: string,
  user_type_key: string,
  hiring_timeline_key: string,
  biggest_problem_key: string,
  desired_next_step_key: string
): Promise<{ valid: boolean; error?: string }> {
  const categories = [
    { category: 'user_type', key: user_type_key },
    { category: 'hiring_timeline', key: hiring_timeline_key },
    { category: 'biggest_problem', key: biggest_problem_key },
    { category: 'desired_next_step', key: desired_next_step_key }
  ]

  for (const { category, key } of categories) {
    const { data, error } = await supabase
      .from('patron_lookup')
      .select('key, is_active')
      .eq('category', category)
      .eq('key', key)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      return { valid: false, error: `Invalid ${category} key: ${key}` }
    }
  }

  return { valid: true }
}

// Get lookup values by key
async function getLookupByKey(supabase: any, tenantId: string, table: string, key: string): Promise<any> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('key', key)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    throw new Error(`No active record found in ${table} with key: ${key}`)
  }

  return data
}

// Upsert person
async function upsertPerson(
  supabase: any,
  tenantId: string,
  payload: IntakePayload,
  pipelineStages: Record<string, PipelineStage>
): Promise<{ person: Person; isNew: boolean }> {
  const { work_email, first_name, last_name } = payload

  if (!work_email) {
    throw new Error('work_email is required for recruiter intake')
  }

  const normalizedEmail = work_email.toLowerCase().trim()
  const normalizedFirstName = first_name?.trim() || ''
  const normalizedLastName = last_name?.trim() || ''
  if (!normalizedFirstName || !normalizedLastName) {
    throw new Error('first_name and last_name are required for recruiter intake')
  }

  // Try to find existing person
  const { data: existingPerson, error: findError } = await supabase
    .from('patron_person')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('email', normalizedEmail)
    .single()

  if (findError && findError.code !== 'PGRST116') {
    throw new Error(`Error finding person: ${findError.message}`)
  }

  if (existingPerson) {
    // Update existing person if fields are missing
    const updates: Partial<Person> = {
      app_context: 'patron'
    }

    if (!existingPerson.first_name) updates.first_name = normalizedFirstName
    if (!existingPerson.last_name) updates.last_name = normalizedLastName
    if (!existingPerson.source) updates.source = 'recruiter_intake'
    if (!existingPerson.person_type_key) updates.person_type_key = 'recruiter_prospect'
    if (!existingPerson.pipeline_stage_id) updates.pipeline_stage_id = pipelineStages.new_recruiter_intake.id

    // Only update if there are changes
    if (Object.keys(updates).length > 1) {
      const { data: updatedPerson, error: updateError } = await supabase
        .from('patron_person')
        .update(updates)
        .eq('id', existingPerson.id)
        .eq('tenant_id', tenantId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Error updating person: ${updateError.message}`)
      }

      return { person: updatedPerson, isNew: false }
    }

    return { person: existingPerson, isNew: false }
  } else {
    // Create new person
    const newPerson: Omit<Person, 'id'> = {
      tenant_id: tenantId,
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
      email: normalizedEmail,
      source: 'recruiter_intake',
      person_type_key: 'recruiter_prospect',
      pipeline_stage_id: pipelineStages.new_recruiter_intake.id,
      app_context: 'patron'
    }

    const { data: createdPerson, error: createError } = await supabase
      .from('patron_person')
      .insert(newPerson)
      .select()
      .single()

    if (createError) {
      throw new Error(`Error creating person: ${createError.message}`)
    }

    return { person: createdPerson, isNew: true }
  }
}

// Upsert organisation
async function upsertOrganisation(
  supabase: any,
  tenantId: string,
  companyName: string,
  personId: string
): Promise<{ organisation: Organisation | null; isNew: boolean }> {
  if (!companyName) {
    return { organisation: null, isNew: false }
  }

  const trimmedName = companyName.trim()

  // Try to find existing organisation
  const { data: existingOrg, error: findError } = await supabase
    .from('patron_organisation')
    .select('*')
    .eq('tenant_id', tenantId)
    .ilike('name', trimmedName)
    .single()

  if (findError && findError.code !== 'PGRST116') {
    throw new Error(`Error finding organisation: ${findError.message}`)
  }

  let organisation: Organisation

  if (existingOrg) {
    organisation = existingOrg
  } else {
    // Create new organisation
    const newOrg: Omit<Organisation, 'id'> = {
      tenant_id: tenantId,
      name: trimmedName,
      app_context: 'patron'
    }

    const { data: createdOrg, error: createError } = await supabase
      .from('patron_organisation')
      .insert(newOrg)
      .select()
      .single()

    if (createError) {
      throw new Error(`Error creating organisation: ${createError.message}`)
    }

    organisation = createdOrg
  }

  // Ensure person-organisation link exists
  const { data: existingLink, error: linkFindError } = await supabase
    .from('patron_person_organisation')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('person_id', personId)
    .eq('organisation_id', organisation.id)
    .single()

  if (linkFindError && linkFindError.code !== 'PGRST116') {
    throw new Error(`Error finding person-org link: ${linkFindError.message}`)
  }

  if (!existingLink) {
    const { error: linkCreateError } = await supabase
      .from('patron_person_organisation')
      .insert({
        tenant_id: tenantId,
        person_id: personId,
        organisation_id: organisation.id
      })

    if (linkCreateError) {
      throw new Error(`Error creating person-org link: ${linkCreateError.message}`)
    }
  }

  return { organisation, isNew: !existingOrg }
}

// Qualification logic
function determineQualification(
  payload: IntakePayload
): { qualification_status_key: string; routed_to_key: string; next_action: string } {
  const {
    user_type_key,
    hiring_timeline_key,
    biggest_problem_key
  } = payload

  const qualifiedUserTypes = ['hiring_manager', 'internal_recruiter', 'founder_owner', 'agency_recruiter']
  const urgentTimelines = ['immediately', 'within_30_days', 'this_quarter']
  const evaluationProblems = ['weak_shortlist_quality', 'hard_to_compare_fairly', 'need_structured_evaluation']

  // QUALIFIED - All users who clicked to book go to Chatz, but we still track qualification level
  if (
    qualifiedUserTypes.includes(user_type_key) &&
    urgentTimelines.includes(hiring_timeline_key) &&
    evaluationProblems.includes(biggest_problem_key)
  ) {
    return {
      qualification_status_key: 'qualified',
      routed_to_key: 'chatz_booking',
      next_action: 'book_call'
    }
  }

  // MEDIUM - Relevant but not urgent
  if (
    qualifiedUserTypes.includes(user_type_key) &&
    !urgentTimelines.includes(hiring_timeline_key)
  ) {
    return {
      qualification_status_key: 'medium',
      routed_to_key: 'chatz_booking',
      next_action: 'book_call'
    }
  }

  // LOW - Just exploring or low intent
  return {
    qualification_status_key: 'low',
    routed_to_key: 'chatz_booking',
    next_action: 'book_call'
  }
}

// Update person pipeline stage
async function updatePersonPipelineStage(
  supabase: any,
  tenantId: string,
  personId: string,
  stageKey: string,
  pipelineStages: Record<string, PipelineStage>
): Promise<void> {
  const stage = pipelineStages[stageKey]
  if (!stage) {
    throw new Error(`Pipeline stage not found: ${stageKey}`)
  }

  const { error } = await supabase
    .from('patron_person')
    .update({ pipeline_stage_id: stage.id })
    .eq('id', personId)
    .eq('tenant_id', tenantId)

  if (error) {
    throw new Error(`Error updating pipeline stage: ${error.message}`)
  }
}

// Create intake record
async function createIntakeRecord(
  supabase: any,
  tenantId: string,
  payload: IntakePayload,
  personId: string,
  organisationId: string | null,
  qualification: { qualification_status_key: string; routed_to_key: string }
): Promise<string> {
  const intakeData = {
    tenant_id: tenantId,
    patron_person_id: personId,
    patron_organisation_id: organisationId,
    source_page: payload.source_page,
    cta_clicked: payload.cta_clicked,
    hiring_role: payload.hiring_role,
    user_type_key: payload.user_type_key,
    hiring_timeline_key: payload.hiring_timeline_key,
    biggest_problem_key: payload.biggest_problem_key,
    desired_next_step_key: payload.desired_next_step_key,
    qualification_status_key: qualification.qualification_status_key,
    routed_to_key: qualification.routed_to_key,
    booking_provider: qualification.routed_to_key === 'chatz_booking' ? 'chatz' : null,
    booking_url: null,
    raw_payload: payload.raw_payload || {},
    notes: payload.notes
  }

  const { data, error } = await supabase
    .from('patron_recruiter_intake')
    .insert(intakeData)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Error creating intake record: ${error?.message}`)
  }

  return data.id
}

// Create activity note
async function createActivityNote(
  supabase: any,
  tenantId: string,
  personId: string,
  organisationId: string | null,
  payload: IntakePayload,
  qualification: { qualification_status_key: string; routed_to_key: string }
): Promise<void> {
  const activityBody = `Recruiter intake submitted:
- Role hiring for: ${payload.hiring_role}
- Timeline: ${payload.hiring_timeline_key}
- Biggest problem: ${payload.biggest_problem_key}
- Desired next step: ${payload.desired_next_step_key}
- Qualification outcome: ${qualification.qualification_status_key}
- Source: ${payload.source_page} (${payload.cta_clicked})`

  const { error } = await supabase
    .from('patron_activity')
    .insert({
      tenant_id: tenantId,
      person_id: personId,
      organisation_id: organisationId,
      type: 'note',
      body: activityBody,
      app_context: 'patron'
    })

  if (error) {
    throw new Error(`Error creating activity note: ${error.message}`)
  }
}

// Get redirect URL
function getRedirectUrl(routedToKey: string): string {
  switch (routedToKey) {
    case 'chatz_booking':
      return CHATZ_BOOKING_URL
    case 'talent_explainer':
      return TALENT_EXPLAINER_URL
    case 'updates_only':
      return UPDATES_URL
    default:
      return TALENT_EXPLAINER_URL
  }
}

// Main handler
serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    // Debug: Log config values
    console.log('🔧 Edge function config:', edgeFunctionConfig);
    console.log('🔧 DISABLE_AUTH env var:', Deno.env.get('DISABLE_AUTH'));
    console.log('🔧 DEBUG_LOGGING env var:', Deno.env.get('DEBUG_LOGGING'));
    console.log('🔧 disableAuth:', edgeFunctionConfig.disableAuth);
    console.log('🔧 enableDebugLogging:', edgeFunctionConfig.enableDebugLogging);
    
    // JWT authentication is handled by --no-verify-jwt flag at platform level
    // No need to run authentication logic here
    if (edgeFunctionConfig.enableDebugLogging) {
      console.log('� JWT verification disabled by --no-verify-jwt flag - proceeding without validation');
    }

    // Parse payload
    const payload: IntakePayload = await req.json()
    
    // Validate required fields
    const requiredFields = ['source_page', 'cta_clicked', 'user_type_key', 'hiring_role', 'hiring_timeline_key', 'biggest_problem_key', 'desired_next_step_key']
    const missingFields = requiredFields.filter(field => !payload[field as keyof IntakePayload])
    
    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: `Missing required fields: ${missingFields.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createSupabaseClient()
    const tenantId = await getTargetTenantId(supabase)

    // Validate lookup keys
    const { valid, error: validationError } = await validateLookupKeys(
      supabase,
      tenantId,
      payload.user_type_key,
      payload.hiring_timeline_key,
      payload.biggest_problem_key,
      payload.desired_next_step_key
    )

    if (!valid) {
      return new Response(
        JSON.stringify({ success: false, error: validationError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get pipeline stages
    const pipelineStages = {
      new_recruiter_intake: await getLookupByKey(supabase, tenantId, 'patron_pipeline_stage', 'new_recruiter_intake'),
      qualified_recruiter: await getLookupByKey(supabase, tenantId, 'patron_pipeline_stage', 'qualified_recruiter'),
      nurture_recruiter: await getLookupByKey(supabase, tenantId, 'patron_pipeline_stage', 'nurture_recruiter')
    }

    // Upsert person
    const { person } = await upsertPerson(supabase, tenantId, payload, pipelineStages)

    // Upsert organisation
    const { organisation } = await upsertOrganisation(supabase, tenantId, payload.company_name || '', person.id)

    // Determine qualification
    const qualification = determineQualification(payload)

    // Update person pipeline stage based on qualification
    if (qualification.qualification_status_key === 'qualified') {
      await updatePersonPipelineStage(supabase, tenantId, person.id, 'qualified_recruiter', pipelineStages)
    } else {
      await updatePersonPipelineStage(supabase, tenantId, person.id, 'nurture_recruiter', pipelineStages)
    }

    // Create intake record
    const intakeId = await createIntakeRecord(supabase, tenantId, payload, person.id, organisation?.id || null, qualification)

    // Create activity note
    await createActivityNote(supabase, tenantId, person.id, organisation?.id || null, payload, qualification)

    // Build response
    const response: IntakeResponse = {
      success: true,
      person_id: person.id,
      organisation_id: organisation?.id || null,
      intake_id: intakeId,
      qualification_status_key: qualification.qualification_status_key,
      routed_to_key: qualification.routed_to_key,
      next_action: qualification.next_action,
      redirect_url: getRedirectUrl(qualification.routed_to_key)
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Recruiter intake error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
