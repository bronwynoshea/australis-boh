// Shared CORS utilities for Supabase Edge Functions
// These helpers ensure consistent handling of browser calls from BOH apps.

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000", // Local dev
  "http://localhost:3001", // Local dev (Vite preview)
  "http://localhost:5173", // Local Vite dev
  "http://127.0.0.1:5173", // Local Vite dev
  "https://dev-boh.jobzcafe.com",
  "https://boh.jobzcafe.com",
  "https://dev-boh.australis.cloud",
  "https://boh.australis.cloud",
  "https://loft.boh.australis.cloud",
  "https://slotz.boh.australis.cloud",
  "https://dev.boh-ccm.pages.dev",
  "https://boh-ccm.pages.dev",
  "https://dev.australis-boh.pages.dev",
  "https://australis-boh.pages.dev",
];

interface CorsOptions {
  allowMethods?: string[];
  allowHeaders?: string[];
  allowCredentials?: boolean;
}

const getEnvValue = (key: string): string | null => {
  const denoEnv = (globalThis as any)?.Deno?.env;
  return denoEnv?.get?.(key) ?? null;
};

function parseAllowedOrigins(): string[] {
  const fromEnv = getEnvValue("ALLOWED_ORIGINS");
  if (!fromEnv) return DEFAULT_ALLOWED_ORIGINS;
  return fromEnv
    .split(",")
    .map((origin: string) => origin.trim())
    .filter(Boolean);
}

function resolveOrigin(req: Request): string {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigins = parseAllowedOrigins();
  if (allowedOrigins.includes(origin)) {
    return origin;
  }

  try {
    const { protocol, hostname } = new URL(origin);
    if (
      hostname === "boh-ccm.pages.dev" ||
      hostname.endsWith(".boh-ccm.pages.dev") ||
      hostname === "australis-boh.pages.dev" ||
      hostname.endsWith(".australis-boh.pages.dev")
    ) {
      return origin;
    }

    const isLocalDevHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);

    if (protocol === "http:" && isLocalDevHost) {
      return origin;
    }
  } catch {
    // Keep the configured fallback for missing or malformed origins.
  }

  // Fall back to the first configured origin (local dev) to avoid wildcard responses.
  return allowedOrigins[0] ?? "";
}

export function buildCorsHeaders(req: Request, options: CorsOptions = {}): Record<string, string> {
  const allowMethods = options.allowMethods ?? ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
  const allowHeaders = options.allowHeaders ?? ["authorization", "x-client-info", "apikey", "content-type"];
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": resolveOrigin(req),
    "Access-Control-Allow-Methods": allowMethods.join(","),
    "Access-Control-Allow-Headers": allowHeaders.join(","),
    Vary: "Origin",
  };

  if (options.allowCredentials) {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

export function corsHeaders(origin: string | null = null, options: CorsOptions = {}): Record<string, string> {
  const req = new Request("https://edge.local", {
    headers: origin ? { origin } : {},
  });
  return buildCorsHeaders(req, options);
}

export function handleCors(req: Request, options: CorsOptions = {}): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(req, options),
    });
  }
  return null;
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
  options: CorsOptions = {},
): Response {
  const headers = {
    ...buildCorsHeaders(req, options),
    "Content-Type": "application/json",
  };

  return new Response(JSON.stringify(body), { status, headers });
}
