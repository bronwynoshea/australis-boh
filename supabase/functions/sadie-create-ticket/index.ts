// @ts-nocheck
// Sadie Create Ticket Edge Function
// Creates a Counter ticket from Sadie slots


import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};


// Map Sadie severity -> ticket priority key in counter_ticket_priority.
// Keys must match the existing values in public.counter_ticket_priority.key
// (low, medium, high, critical).
const SEVERITY_TO_PRIORITY_KEY: Record<string, string> = {
  Critical: "critical",
  High: "high",
  Medium: "medium",
  Low: "low",
};


// Map Sadie app names -> app_area slug (text field)
const APP_TO_AREA: Record<string, string> = {
  "Career Studio": "career_studio",
  Cafe: "cafe",
  Journey: "journey",
  Coach: "coach",
  Mentor: "mentor",
  DNA: "dna",
  Talent: "talent",
  "Back of House": "back_of_house",
  Counter: "counter",
  Kitchen: "kitchen",
  Cookbook: "cookbook",
  Patron: "patron",
};
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }


  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: true,
          message: "Missing Authorization header",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }


    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secretKey = Deno.env.get("SB_SECRET_KEY");


    if (!supabaseUrl || !secretKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
      return new Response(
        JSON.stringify({
          error: true,
          message: "Server configuration error",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }


    const supabase = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });


    // Validate auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();


    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: true,
          message: "Invalid or missing authentication",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }


    // Body should contain Sadie slots + optional ai_session_id
    const body = await req.json();
    const {
      slots = {},
      ai_session_id = null,
      source = "sadie",
    }: {
      slots: {
        app?: string | null;
        feature?: string | null;
        func?: string | null;
        category?: string | null;
        severity?: string | null;
        title?: string | null;
        description?: string | null;
        requesterEmail?: string | null;
        initialUserMessage?: string | null;
      };
      ai_session_id?: string | null;
      source?: string | null;
    } = body;


    if (!slots.title || !slots.description) {
      return new Response(
        JSON.stringify({
          error: true,
          message: "Missing required fields: title and description",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }


    // Look up boh_user for created_by
    let createdBy: string | null = null;
    const { data: bohUserRow, error: bohUserError } = await supabase
      .from("boh_user")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();


    if (bohUserError) {
      console.error("[sadie-create-ticket] boh_user lookup error", bohUserError);
    } else if (bohUserRow?.id) {
      createdBy = bohUserRow.id;
    }


    // Resolve or create patron_person for this requester so we have a single
    // source of truth for people. We prefer matching by boh_user_id for
    // internal staff; otherwise fall back to email.
    let requesterPersonId: string | null = null;
    let requesterEmail = slots.requesterEmail || (user.email ?? null);

    // Try to find by linked boh_user first
    if (createdBy) {
      const { data: patronFromBoh, error: patronFromBohError } = await supabase
        .from("patron_person")
        .select("id, first_name, last_name, email")
        .eq("boh_user_id", createdBy)
        .maybeSingle();

      if (patronFromBohError) {
        console.error("[sadie-create-ticket] patron_person lookup by boh_user_id error", patronFromBohError);
      } else if (patronFromBoh?.id) {
        requesterPersonId = patronFromBoh.id;
        requesterEmail = patronFromBoh.email || requesterEmail;
      }
    }

    // If we still don't have a person, try by email
    if (!requesterPersonId && requesterEmail) {
      const { data: patronFromEmail, error: patronFromEmailError } = await supabase
        .from("patron_person")
        .select("id, first_name, last_name, email")
        .eq("email", requesterEmail)
        .maybeSingle();

      if (patronFromEmailError) {
        console.error("[sadie-create-ticket] patron_person lookup by email error", patronFromEmailError);
      } else if (patronFromEmail?.id) {
        requesterPersonId = patronFromEmail.id;
        requesterEmail = patronFromEmail.email || requesterEmail;
      }
    }

    // If no patron_person exists yet but we have an email, create a minimal one
    if (!requesterPersonId && requesterEmail) {
      const { data: newPatron, error: newPatronError } = await supabase
        .from("patron_person")
        .insert({
          email: requesterEmail,
          boh_user_id: createdBy,
          source: "counter_ticket",
          created_by: createdBy,
        })
        .select("id, email")
        .single();

      if (newPatronError) {
        console.error("[sadie-create-ticket] patron_person insert error", newPatronError);
      } else if (newPatron?.id) {
        requesterPersonId = newPatron.id;
        requesterEmail = newPatron.email || requesterEmail;
      }
    }


    // Resolve app_area text
    let appArea = "unknown";
    if (slots.app) {
      appArea = APP_TO_AREA[slots.app] || slots.app.toString();
    }


    const category = slots.category || "Other";


    // Default status: key = 'new' in counter_ticket_status
    const { data: statusRowOpen, error: statusErrorOpen } = await supabase
      .from("counter_ticket_status")
      .select("id, key, label")
      .eq("key", "open")
      .maybeSingle();

    const { data: statusRowNew, error: statusErrorNew } = await supabase
      .from("counter_ticket_status")
      .select("id, key, label")
      .eq("key", "new")
      .maybeSingle();

    const statusRow = statusRowOpen?.id ? statusRowOpen : statusRowNew;
    const statusError = statusErrorOpen || statusErrorNew;


    if (statusError || !statusRow?.id) {
      console.error("[sadie-create-ticket] status lookup error", statusError);
      return new Response(
        JSON.stringify({
          error: true,
          message:
            "Failed to resolve default status (expected counter_ticket_status.key = 'new')",
          details: statusError || null,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }


    const statusId = statusRow.id;
    const statusLabel = statusRow.label || "Open";


    const rawSeverity = slots.severity || "Medium";
    const rawSeverityStr = rawSeverity?.toString?.().trim?.() || "Medium";
    const severityKey = rawSeverityStr.toLowerCase();
    const normalizedSeverity = ["critical", "high", "medium", "low"].includes(severityKey)
      ? severityKey
      : "medium";
    const severityTitle =
      rawSeverityStr.charAt(0).toUpperCase() + rawSeverityStr.slice(1).toLowerCase();
    const priorityKey =
      SEVERITY_TO_PRIORITY_KEY[rawSeverityStr] ||
      SEVERITY_TO_PRIORITY_KEY[severityTitle] ||
      normalizedSeverity;


    // Priority lookup: try derived key first, but fall back to 'medium' if missing.
    // This prevents ticket creation failing due to mismatched priority keys in the DB.
    const priorityKeyCandidates = Array.from(
      new Set([priorityKey, "medium", "Medium"]),
    ).filter(Boolean) as string[];

    const { data: priorityRows, error: priorityError } = await supabase
      .from("counter_ticket_priority")
      .select("id, key")
      .in("key", priorityKeyCandidates);

    const resolvedPriorityRow =
      (priorityRows || []).find((r: any) => r?.key === priorityKey) ||
      (priorityRows || []).find((r: any) => (r?.key || "").toLowerCase() === "medium") ||
      (priorityRows || [])[0] ||
      null;

    if (priorityError || !resolvedPriorityRow?.id) {
      console.error("[sadie-create-ticket] priority lookup error", priorityError);
      return new Response(
        JSON.stringify({
          error: true,
          message: `Failed to resolve ticket priority for severity "${rawSeverityStr}" (tried counter_ticket_priority.key in ${JSON.stringify(priorityKeyCandidates)})`,
          details: priorityError || null,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }


    const priorityId = resolvedPriorityRow.id;
    const resolvedPriorityKey = resolvedPriorityRow.key;
    // Generate a sequential human-friendly ticket number of the form
    //   CTR-<nnn>
    // where <nnn> is a zero-padded 3+ digit number one greater than the
    // highest existing CTR- ticket_number (e.g. CTR-001, CTR-002, CTR-003).
    // If no CTR- tickets exist yet, start at CTR-001.
    let nextTicketNumber = 1;

    const { data: lastCtrTicket, error: lastCtrTicketError } = await supabase
      .from("counter_ticket")
      .select("ticket_number, created_at")
      .like("ticket_number", "CTR-%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastCtrTicketError) {
      console.error("[sadie-create-ticket] error fetching last CTR ticket", lastCtrTicketError);
    }

    if (lastCtrTicket?.ticket_number) {
      const match = /^CTR-(\d+)$/.exec(lastCtrTicket.ticket_number);
      if (match) {
        const lastNumber = parseInt(match[1], 10);
        if (!Number.isNaN(lastNumber) && lastNumber >= 1) {
          nextTicketNumber = lastNumber + 1;
        }
      }
    }

    // Helper to format a CTR ticket number with at least 3 digits
    const formatTicketNumber = (n: number) => `CTR-${String(n).padStart(3, "0")}`;

    const baseTicketPayload: any = {
      // ticket_number is added later in the insert loop using formatTicketNumber
      // Canonical subject used throughout the Counter UI
      subject: slots.title,
      description: slots.description,
      category,
      // App context (canonical app key)
      app: APP_TO_AREA[slots.app || "Counter"] || "counter",
      // Requester
      requester_person_id: requesterPersonId,
      requester_name: requesterEmail || "Unknown user",
      requester_email: requesterEmail,
      // Priority / status
      created_by: createdBy,
      source: source || "sadie",
      ai_session_id,
      initial_user_message: slots.initialUserMessage || null,
      app_context: "counter",
      status_id: statusId,
      priority_id: priorityId,
    };
    
    // Try inserting with retry on duplicate ticket_number (unique constraint).
    const maxRetries = 5;
    let insertData: any = null;
    let insertError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const ticketNumber = formatTicketNumber(nextTicketNumber + attempt);
      const ticketPayload = { ...baseTicketPayload, ticket_number: ticketNumber };

      const { data, error } = await supabase
        .from("counter_ticket")
        .insert(ticketPayload)
        .select("*")
        .single();

      if (!error) {
        insertData = data;
        insertError = null;
        break;
      }

      // 23505 = unique_violation in Postgres
      if (error.code === "23505") {
        console.warn("[sadie-create-ticket] duplicate CTR ticket number, retrying with next number", {
          attemptedNumber: ticketNumber,
        });
        continue;
      }

      insertError = error;
      break;
    }

    if (insertError || !insertData) {
      console.error("[sadie-create-ticket] insert error after retries", insertError);
      return new Response(
        JSON.stringify({
          error: true,
          message: "Failed to create ticket",
          details: insertError,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }


    return new Response(
      JSON.stringify({
        error: false,
        ticketId: insertData.id,
        ticketNumber: insertData.ticket_number,
        ticket: insertData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[sadie-create-ticket] unexpected error", error);
    return new Response(
      JSON.stringify({
        error: true,
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

