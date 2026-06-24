/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(req.headers.get("origin")),
      "Content-Type": "application/json",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}

function truncateText(raw: unknown, maxLen = 2000): string {
  const s = String(raw ?? "");
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "…";
}

async function sendAlertEmail(opts: {
  resendApiKey: string;
  to: string;
  summary: any;
}) {
  const { resendApiKey, to, summary } = opts;
  const subject = "[Loft] Gemini model healthcheck failed";
  const bodyText = truncateText(JSON.stringify(summary, null, 2), 8000);

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Loft Healthcheck <alerts@jobzcafe.com>",
      to: [to],
      subject,
      text: bodyText,
    }),
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        ...corsHeaders(req.headers.get("origin")),
        "Access-Control-Allow-Headers": "content-type, x-healthcheck-token",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  }
  if (req.method !== "GET" && req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const healthcheckToken = (Deno.env.get("HEALTHCHECK_TOKEN") || "").trim();
  if (healthcheckToken) {
    const provided = req.headers.get("x-healthcheck-token") || "";
    if (provided !== healthcheckToken) {
      return json(req, { error: "unauthorized" }, 401);
    }
  }

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || "";
  const configuredModel = (Deno.env.get("GEMINI_MODEL") || "").trim() || "gemini-2.5-flash";
  const resendApiKey = (Deno.env.get("RESEND_API_KEY") || "").trim();
  const alertEmailTo = (Deno.env.get("ALERT_EMAIL_TO") || "").trim();

  if (!geminiApiKey) {
    const summary = {
      ok: false,
      configuredModel,
      found: false,
      supportsGenerateContent: false,
      availableModelsSample: [],
      error: "gemini_not_configured",
    };

    try {
      if (resendApiKey && alertEmailTo) await sendAlertEmail({ resendApiKey, to: alertEmailTo, summary });
    } catch {
      // ignore
    }

    return json(req, summary, 500);
  }

  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`;
  const resp = await fetch(listUrl);
  const modelsJson = await resp.json().catch(() => ({}));

  const models = Array.isArray((modelsJson as any)?.models) ? (modelsJson as any).models : [];
  const names: string[] = models
    .map((m: any) => String(m?.name || "").trim())
    .filter(Boolean);

  const findName1 = configuredModel;
  const findName2 = configuredModel.startsWith("models/") ? configuredModel : `models/${configuredModel}`;

  const matched = models.find((m: any) => {
    const name = String(m?.name || "").trim();
    return name === findName1 || name === findName2;
  });

  const found = !!matched;
  const supportedMethods = Array.isArray((matched as any)?.supportedGenerationMethods)
    ? (matched as any).supportedGenerationMethods
    : Array.isArray((matched as any)?.supportedMethods)
      ? (matched as any).supportedMethods
      : null;

  const supportsGenerateContent = Array.isArray(supportedMethods)
    ? supportedMethods.map((s: any) => String(s)).some((s: string) => s.toLowerCase().includes("generatecontent"))
    : false;

  const ok = found && (supportedMethods ? supportsGenerateContent : false);

  const summary = {
    ok,
    configuredModel,
    found,
    supportsGenerateContent: supportedMethods ? supportsGenerateContent : false,
    availableModelsSample: names.slice(0, 25),
    listStatus: resp.status,
    listErrorFirst200: resp.ok ? null : truncateText(JSON.stringify(modelsJson), 200),
  };

  if (!ok) {
    try {
      if (resendApiKey && alertEmailTo) await sendAlertEmail({ resendApiKey, to: alertEmailTo, summary });
    } catch {
      // ignore
    }
  }

  return json(req, summary, ok ? 200 : 500);
});
