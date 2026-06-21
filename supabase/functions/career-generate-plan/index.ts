// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.5.0";

const APP_ORIGIN =
  Deno.env.get("APP_ORIGIN") ?? Deno.env.get("SITE_URL") ?? "https://app.jobzcafe.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": APP_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function validatePreferences(preferences: any) {
  if (typeof preferences !== "object" || preferences === null) {
    return "preferences must be an object";
  }
  const { urgency, minutes_per_day, include_weekends } = preferences;
  const validUrgencyValues = new Set(["low", "medium", "high"]);
  if (!validUrgencyValues.has(urgency)) {
    return "preferences.urgency must be one of: low, medium, high";
  }
  if (typeof minutes_per_day !== "number" || minutes_per_day <= 0) {
    return "preferences.minutes_per_day must be a positive number";
  }
  if (typeof include_weekends !== "boolean") {
    return "preferences.include_weekends must be a boolean";
  }
  return null;
}

async function fetchCareerData() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SB_SECRET_KEY");

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase configuration");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: modules, error: modulesError } = await supabase
    .from("career_module")
    .select("key,label,description,is_operational,operational_since,sort_order")
    .order("sort_order", { ascending: true });

  if (modulesError) {
    throw new Error(`Failed to load career modules: ${modulesError.message}`);
  }

  const { data: actionTypes, error: actionTypesError } = await supabase
    .from("career_task_action_type")
    .select("key,label,description")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (actionTypesError) {
    throw new Error(
      `Failed to load career task action types: ${actionTypesError.message}`,
    );
  }

  return {
    modules: modules ?? [],
    actionTypes: actionTypes ?? [],
  };
}

async function generatePlan({
  onboarding,
  preferences,
  modules,
  actionTypes,
}: {
  onboarding: Record<string, unknown>;
  preferences: Record<string, unknown>;
  modules: any[];
  actionTypes: any[];
}) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
    },
  });

  const prompt = `
You are JobzCafe's career plan architect.

Context:
- Onboarding summary (JSON): ${JSON.stringify(onboarding, null, 2)}
- Preferences (JSON): ${JSON.stringify(preferences, null, 2)}
- Career modules (JSON): ${JSON.stringify(modules, null, 2)}
- Allowed action types (JSON): ${JSON.stringify(actionTypes, null, 2)}

Requirements:
1. Produce a 14-day plan (days numbered 1-14).
2. Each day must include 1-3 tasks. Be concrete and actionable.
3. Every task must include:
   - action_type (must be one of the provided action type keys; never invent new keys)
   - module_key (must be one of the provided module keys)
   - title (short, compelling)
   - instructions (detailed guidance tailored to onboarding context and preferences)
   - estimated_minutes (respect preferences.minutes_per_day and urgency)
   - cta: object with { "kind": "route" | "url" | "none", "value": string or null }
4. Respect include_weekends: if false, use weekday-friendly actions and keep weekends lighter or reflective.
5. Urgency influences intensity:
   - low: gradual build-up, reflection heavy
   - medium: balanced momentum
   - high: decisive action, immediate momentum
6. Tailor plan to module operational status: if a module is not operational, either reuse another module or clearly state fallback instructions mapped to available modules.
7. Output STRICT JSON only with this shape:
{
  "days": [
    {
      "day_number": <1-14>,
      "tasks": [
        {
          "action_type": "<allowed action type key>",
          "module_key": "<career module key>",
          "title": "string",
          "instructions": "string",
          "estimated_minutes": number,
          "cta": {
            "kind": "route" | "url" | "none",
            "value": string | null
          }
        }
      ]
    }
  ]
}
8. Do NOT include markdown, commentary, or additional fields.
  `;

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  });

  const text = result?.response?.text();
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini raw response:", text);
    throw new Error("Gemini returned invalid JSON");
  }
}

function validatePlan(plan: any, allowedActionTypes: Set<string>, allowedModuleKeys: Set<string>) {
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.days)) {
    return "Plan JSON must include a 'days' array";
  }

  if (plan.days.length !== 14) {
    return "Plan must contain exactly 14 days";
  }

  for (const day of plan.days) {
    if (typeof day.day_number !== "number") {
      return "Each day must include a numeric day_number";
    }
    if (!Array.isArray(day.tasks) || day.tasks.length === 0) {
      return `Day ${day.day_number} must include at least one task`;
    }
    for (const task of day.tasks) {
      if (!allowedActionTypes.has(task.action_type)) {
        return `Invalid action_type '${task.action_type}'`;
      }
      if (!allowedModuleKeys.has(task.module_key)) {
        return `Invalid module_key '${task.module_key}'`;
      }
      if (typeof task.title !== "string" || !task.title.trim()) {
        return "Each task must include a title";
      }
      if (typeof task.instructions !== "string" || !task.instructions.trim()) {
        return "Each task must include instructions";
      }
      if (typeof task.estimated_minutes !== "number" || task.estimated_minutes <= 0) {
        return "Each task must include estimated_minutes > 0";
      }
      if (
        !task.cta ||
        typeof task.cta !== "object" ||
        !["route", "url", "none"].includes(task.cta.kind) ||
        (task.cta.kind === "none" ? task.cta.value !== null : typeof task.cta.value !== "string")
      ) {
        return "Each task must include a valid cta object";
      }
    }
  }

  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const { onboarding, preferences } = body ?? {};

    if (typeof onboarding !== "object" || onboarding === null) {
      return jsonResponse({ error: "onboarding must be an object" }, 400);
    }

    const preferencesError = validatePreferences(preferences);
    if (preferencesError) {
      return jsonResponse({ error: preferencesError }, 400);
    }

    const { modules, actionTypes } = await fetchCareerData();
    const planFromGemini = await generatePlan({
      onboarding,
      preferences,
      modules,
      actionTypes,
    });

    const allowedActionTypes = new Set(actionTypes.map((t) => t.key));
    const allowedModuleKeys = new Set(modules.map((m) => m.key));

    const validationError = validatePlan(
      planFromGemini,
      allowedActionTypes,
      allowedModuleKeys,
    );
    if (validationError) {
      return jsonResponse({ error: validationError }, 400);
    }

    const responsePayload = {
      plan_version: 1,
      generated_at: new Date().toISOString(),
      days: planFromGemini.days,
    };

    return jsonResponse(responsePayload);
  } catch (error) {
    console.error("career-generate-plan error:", error);
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    return jsonResponse({ error: true, message }, 500);
  }
});
