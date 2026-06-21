// supabase/functions/setup-user-credits-from-offer/index.ts
// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET_KEY = Deno.env.get("SB_SECRET_KEY")!;
const SUPABASE_PUBLISHABLE_KEY = Deno.env.get("SB_PUBLISHABLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: {
    persistSession: false,
  },
});

async function getAuthUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data, error } = await authClient.auth.getUser();
  return error ? null : data?.user ?? null;
}

type RequestBody = {
  profile_id: string;  // public.profile.id (NOT auth.users.id)
  offer_slug: string;  // e.g. 'pioneer-bf-2025'
};


serve(async (req) => {
  // Basic CORS handling
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Pattern B authentication check
  const user = await getAuthUser(req);
  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const body = (await req.json()) as Partial<RequestBody>;
    const { profile_id, offer_slug } = body;


    if (!profile_id || !offer_slug) {
      return jsonResponse(
        { error: "profile_id and offer_slug are required" },
        400
      );
    }


    // 1. Verify profile exists
    const { data: profile, error: profileError } = await supabase
      .from("profile")
      .select("id, email, subscription_level")
      .eq("id", profile_id)
      .single();


    if (profileError || !profile) {
      console.error("Profile lookup error", profileError);
      return jsonResponse(
        { error: "Profile not found for given profile_id" },
        400
      );
    }


    // 2. Look up the offer_campaign by slug
    const { data: offer, error: offerError } = await supabase
      .from("offer_campaign")
      .select("*")
      .eq("slug", offer_slug)
      .eq("is_active", true)
      .single();


    if (offerError || !offer) {
      console.error("Offer lookup error", offerError);
      return jsonResponse(
        { error: "Active offer_campaign not found for given slug" },
        400
      );
    }


    // 3. Compute access_starts_at and bonus_unlocks_at
    // access_starts_at is stored as timestamptz (ET based as per your inserts)
    const now = new Date();


    const accessStartsAt = offer.access_starts_at
      ? new Date(offer.access_starts_at)
      : now;


    // Bonus unlock date = access_starts_at + N days (default 14)
    const delayDays =
      typeof offer.bonus_unlock_delay_days === "number"
        ? offer.bonus_unlock_delay_days
        : 14;


    const bonusUnlocksAt = new Date(
      accessStartsAt.getTime() + delayDays * 24 * 60 * 60 * 1000
    );


    // 4. Upsert user_credit row
    // NOTE: user_credit.user_id REFERENCES public.profile(id)
    const { data: userCredit, error: userCreditError } = await supabase
      .from("user_credit")
      .upsert(
        {
          user_id: profile.id,
          offer_campaign_id: offer.id,
          access_starts_at: accessStartsAt.toISOString(),
          bonus_unlocks_at: bonusUnlocksAt.toISOString(),
          // You can adjust these defaults as needed later.
          // For now, keep your base monthly/daily credits here:
          daily_credits: 5,
          monthly_credits: 60,
        },
        {
          onConflict: "user_id",
        }
      )
      .select("*")
      .single();


    if (userCreditError || !userCredit) {
      console.error("user_credit upsert error", userCreditError);
      return jsonResponse(
        { error: "Failed to create or update user_credit" },
        500
      );
    }


    // 5. Return structured info so the frontend can show confirmation
    return jsonResponse(
      {
        status: "ok",
        profile_id: profile.id,
        offer_slug,
        offer_campaign_id: offer.id,
        access_starts_at: userCredit.access_starts_at,
        bonus_unlocks_at: userCredit.bonus_unlocks_at,
        bonus_unlock_delay_days: delayDays,
      },
      200
    );
  } catch (err) {
    console.error("Unexpected error in setup-user-credits-from-offer", err);
    return jsonResponse(
      { error: "Unexpected error in Edge Function" },
      500
    );
  }
});


function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
