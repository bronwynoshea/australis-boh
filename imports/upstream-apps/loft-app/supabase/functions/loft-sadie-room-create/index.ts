 /// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";

// Add logging utility
const log = (message: string, data?: any) => {
  console.log(`[loft-sadie-room-create] ${message}`, data);
};

type Body = {
  prompt?: string;
};

type SuggestionResult = {
  title: string;
  description: string;
  tags: string[];
};

function truncateText(raw: unknown, maxLen = 1200): string {
  const s = String(raw ?? "");
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "…";
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}

function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags
    .map((t) => String(t || "").trim())
    .filter(Boolean)
    .map((t) => t.replace(/^#/, ""));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of cleaned) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.slice(0, 8);
}

function extractJson(text: string): any {
  const raw = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(raw);
}

serve(async (req: Request) => {
  log('Received request', { method: req.method, url: req.url });
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers.get("origin")) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const geminiModel = (Deno.env.get("GEMINI_MODEL") || "").trim();

    if (!supabaseUrl || !anonKey) {
      log('Missing Supabase configuration');
      return json(req, { error: "server_not_configured" }, 500);
    }
    if (!geminiApiKey) {
      log('Missing Gemini API key');
      return json(req, { error: "gemini_not_configured" }, 500);
    }
    if (!geminiModel) {
      log('Missing Gemini model');
      return json(req, { error: "gemini_model_not_configured" }, 500);
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const prompt = String(body.prompt || "").trim();
    if (!prompt) {
      log('Missing prompt in request body');
      return json(req, { error: "missing_prompt" }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    console.log("loft-sadie-room-create", {
      hasAuth: Boolean(authHeader),
      hasGeminiKey: Boolean(geminiApiKey),
      origin: req.headers.get("origin"),
    });

    const supabaseAuthed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuthed.auth.getUser();

    if (userError || !user) {
      log('User not authenticated', { userError });
      return json(req, { error: "not_authenticated" }, 401);
    }

    log('Authenticated user', { userId: user.id });

    const systemInstruction =
      "You are Sadie, a concise facilitator for JOBZ CAFE® LOFT rooms. " +
      "Given a rough topic, return JSON ONLY with keys: title (string), description (string), tags (array of short strings). " +
      "Title: punchy, <= 70 chars. Description: 1-2 sentences, action-oriented. Tags: 3-6 relevant lowercase keywords, no #.";

    async function callGemini(model: string) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [
            { role: "user", parts: [{ text: `Topic: ${prompt}` }] },
          ],
          generationConfig: {
            temperature: 0.6,
            topP: 0.9,
            maxOutputTokens: 300,
            responseMimeType: "application/json",
          },
        }),
      });
      const json = await resp.json().catch(() => ({}));
      return { resp, json, model };
    }

    let gem = await callGemini(geminiModel);
    console.log("gemini status", gem.resp.status);

    if (!gem.resp.ok) {
      const upstreamMsg =
        gem.json?.error?.message ||
        gem.json?.message ||
        gem.json?.error ||
        undefined;

      return json(
        req,
        {
          error: gem.resp.status === 404 ? "gemini_model_not_found" : "gemini_error",
            status: gem.resp.status,
            modelTried: gem.model,
            configuredModel: geminiModel,
            upstreamMessage: upstreamMsg,
          first200: truncateText(JSON.stringify(gem.json), 200),
          details: gem.json,
        },
        500,
      );
    }

    const text =
      gem.json?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text)
        .filter(Boolean)
        .join("\n") ||
      "";

    if (!text) {
      log('Gemini API returned empty response');
      return json(
        req,
        {
          error: "gemini_empty_response",
          details: gem.json,
        },
        500,
      );
    }

    let parsed: any;
    try {
      parsed = extractJson(text);
    } catch (e) {
      log('Failed to parse Gemini response', { error: e });
      return json(
        req,
        {
          error: "gemini_invalid_json",
          details: String((e as any)?.message || e),
          rawText: truncateText(text),
          first200: truncateText(text, 200),
        },
        500,
      );
    }

    const result: SuggestionResult = {
      title: String(parsed?.title || prompt).trim() || prompt,
      description: String(parsed?.description || "").trim(),
      tags: sanitizeTags(parsed?.tags),
    };

    if (!result.description) {
      result.description = `A focused discussion on ${prompt}, with practical takeaways and next steps.`;
    }

    log('Returning result', result);
    return json(req, result);
  } catch (e) {
    log('Unexpected error', { error: e });
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});
