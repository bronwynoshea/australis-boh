/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return json(req, { error: 'unauthorized' }, 401);
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profile')
      .select('id, can_host_loft')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return json(req, { error: 'profile_not_found' }, 404);
    }

    // Check if user is already a host
    if (profile.can_host_loft) {
      return json(req, { error: 'already_host' }, 400);
    }

    const body = await req.json();
    const { applicationReason, experienceDescription, topicsToHost } = body;

    if (!applicationReason || typeof applicationReason !== 'string' || applicationReason.trim().length < 20) {
      return json(req, { error: 'application_reason_required', message: 'Please provide at least 20 characters explaining why you want to become a host' }, 400);
    }

    // Check if user already has a pending or approved application
    const { data: existingApp } = await supabaseAdmin
      .from('host_application')
      .select('id, status')
      .eq('profile_id', profile.id)
      .single();

    if (existingApp) {
      if (existingApp.status === 'pending') {
        return json(req, { error: 'application_pending', message: 'You already have a pending application' }, 400);
      }
      if (existingApp.status === 'approved') {
        return json(req, { error: 'already_approved', message: 'Your application has already been approved' }, 400);
      }
      // If rejected, allow reapplication by updating existing record
      const { error: updateError } = await supabaseAdmin
        .from('host_application')
        .update({
          status: 'pending',
          application_reason: applicationReason.trim(),
          experience_description: experienceDescription?.trim() || null,
          topics_to_host: topicsToHost?.trim() || null,
          submitted_at: new Date().toISOString(),
          reviewed_at: null,
          reviewed_by: null,
          admin_notes: null,
        })
        .eq('id', existingApp.id);

      if (updateError) {
        return json(req, { error: 'update_failed', details: updateError }, 500);
      }

      return json(req, { success: true, applicationId: existingApp.id, message: 'Application resubmitted successfully' });
    }

    // Create new application
    const { data: newApp, error: insertError } = await supabaseAdmin
      .from('host_application')
      .insert({
        profile_id: profile.id,
        status: 'pending',
        application_reason: applicationReason.trim(),
        experience_description: experienceDescription?.trim() || null,
        topics_to_host: topicsToHost?.trim() || null,
      })
      .select('id')
      .single();

    if (insertError || !newApp) {
      return json(req, { error: 'insert_failed', details: insertError }, 500);
    }

    return json(req, { success: true, applicationId: newApp.id, message: 'Application submitted successfully' });
  } catch (e) {
    return json(req, { error: 'unexpected_error', details: String((e as any)?.message || e) }, 500);
  }
});
