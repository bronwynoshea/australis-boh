/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveBohLoftIdentity } from "../_shared/loftIdentity.ts";

const json = (req: Request, data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
  });

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req.headers.get('origin')) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return json(req, { error: 'unauthorized' }, 401);

    const adminIdentity = await resolveBohLoftIdentity(supabaseAdmin, user.id);
    const canReviewApplications = !!adminIdentity.isLoftAdmin || Number(adminIdentity.userTypeId) === 5;
    if (!canReviewApplications) return json(req, { error: 'admin_access_required' }, 403);

    const body = await req.json();
    const { applicationId, action, adminNotes } = body;
    if (!applicationId || !action || !['approve', 'reject'].includes(action)) {
      return json(req, { error: 'invalid_request', message: 'applicationId and action (approve/reject) required' }, 400);
    }

    const { data: application, error: appError } = await supabaseAdmin
      .from('host_application')
      .select('id, applicant_boh_user_id, applicant_patron_person_id, status')
      .eq('id', applicationId)
      .single();

    if (appError || !application) return json(req, { error: 'application_not_found' }, 404);
    if (application.status !== 'pending') {
      return json(req, { error: 'application_already_reviewed', message: `Application is already ${application.status}` }, 400);
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const { error: updateError } = await supabaseAdmin
      .from('host_application')
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by_boh_user_id: adminIdentity.bohUserId,
        admin_notes: adminNotes?.trim() || null,
      })
      .eq('id', applicationId);

    if (updateError) return json(req, { error: 'update_failed', details: updateError }, 500);

    return json(req, {
      success: true,
      status: newStatus,
      message: `Application ${newStatus} successfully`,
    });
  } catch (e) {
    return json(req, { error: 'unexpected_error', details: String((e as any)?.message || e) }, 500);
  }
});
