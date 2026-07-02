/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

type Body = {
  transcript?: string;
};

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}

function truncateText(raw: unknown, maxLen = 4000): string {
  const s = String(raw ?? "");
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "…";
}

async function callGemini(args: {
  apiKey: string;
  apiVersion: "v1" | "v1beta";
  model: string;
  prompt: string;
}) {
  const url = `https://generativelanguage.googleapis.com/${args.apiVersion}/models/${encodeURIComponent(args.model)}:generateContent?key=${args.apiKey}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: args.prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 400,
      },
    }),
  });

  const json = await resp.json().catch(() => ({}));
  return { resp, json, url };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers.get("origin")) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return json(req, { error: "gemini_not_configured" }, 500);
    }

    const configuredModel = String(Deno.env.get("GEMINI_MODEL") || "").trim();
    if (!configuredModel) {
      return json(req, { error: "gemini_model_not_configured" }, 500);
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const transcript = String(body.transcript || "").trim();

    if (!transcript) {
      return json(req, "No transcript to summarize yet.");
    }

    const systemInstruction =
      "Summarize the following LOFT room transcript into concise bullet points. " +
      "Return plain text only. " +
      "Format: 3-6 bullet points, each starting with '• '.";

    const prompt = `${systemInstruction}\n\nTRANSCRIPT:\n${truncateText(transcript, 12000)}`;

    let modelTried = configuredModel;
    let apiVersionTried: "v1" | "v1beta" = "v1";
    let outResp = await callGemini({ apiKey: geminiApiKey, apiVersion: "v1", model: modelTried, prompt });

    const geminiResp = outResp.resp;
    const geminiJson = outResp.json;
    if (!geminiResp.ok) {
      const upstreamMsg = geminiJson?.error?.message || geminiJson?.message || geminiJson?.error || undefined;
      return json(
        req,
        {
          error: "gemini_error",
          status: geminiResp.status,
          upstreamMessage: upstreamMsg,
          details: geminiJson,
          modelTried,
          configuredModel,
          apiVersionTried,
        },
        500,
      );
    }

    const text =
      geminiJson?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text)
        .filter(Boolean)
        .join("\n") ||
      "";

    const out = text.trim() || "No Summary generated at this table.";
    return json(req, out);
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});
