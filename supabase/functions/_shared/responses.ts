// Shared response helpers for BOH Edge Functions
// Provides standardized JSON and error responses with consistent CORS handling
// @ts-nocheck

import { buildCorsHeaders } from "./cors.ts";

// ============================================================================
// Response Types
// ============================================================================

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: Record<string, any>;
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

// ============================================================================
// Standard JSON Response
// ============================================================================

/**
 * Creates a standardized JSON response with CORS headers
 * 
 * @example
 * return jsonResponse(req, { data: result });
 * return jsonResponse(req, { error: "Not found" }, 404);
 */
export function jsonResponse(
  req: Request,
  body: Record<string, any>,
  status = 200,
  corsOptions?: { allowCredentials?: boolean }
): Response {
  const headers = {
    ...buildCorsHeaders(req, corsOptions),
    "Content-Type": "application/json",
  };

  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Success response wrapper
 * 
 * @example
 * return successResponse(req, { items: [...] });
 * return successResponse(req, user, { total: 100 });
 */
export function successResponse<T>(
  req: Request,
  data: T,
  meta?: Record<string, any>,
  status = 200
): Response {
  const body: SuccessResponse<T> = {
    success: true,
    data,
    ...(meta && { meta }),
  };
  return jsonResponse(req, body, status);
}

/**
 * Error response wrapper
 * 
 * @example
 * return errorResponse(req, "Invalid input", 400);
 * return errorResponse(req, "Not found", 404, "NOT_FOUND");
 */
export function errorResponse(
  req: Request,
  message: string,
  status = 400,
  code?: string
): Response {
  const body: ErrorResponse = {
    success: false,
    error: message,
    ...(code && { code }),
  };
  return jsonResponse(req, body, status);
}

// ============================================================================
// Common HTTP Error Responses
// ============================================================================

export function unauthorized(req: Request, message = "Unauthorized"): Response {
  return errorResponse(req, message, 401, "UNAUTHORIZED");
}

export function forbidden(req: Request, message = "Forbidden"): Response {
  return errorResponse(req, message, 403, "FORBIDDEN");
}

export function notFound(req: Request, message = "Not found"): Response {
  return errorResponse(req, message, 404, "NOT_FOUND");
}

export function badRequest(req: Request, message: string): Response {
  return errorResponse(req, message, 400, "BAD_REQUEST");
}

export function methodNotAllowed(req: Request, allowed: string[]): Response {
  const response = errorResponse(
    req,
    `Method not allowed. Allowed: ${allowed.join(", ")}`,
    405,
    "METHOD_NOT_ALLOWED"
  );
  // Add Allow header
  const headers = new Headers(response.headers);
  headers.set("Allow", allowed.join(", "));
  return new Response(response.body, { status: response.status, headers });
}

export function serverError(req: Request, message = "Internal server error"): Response {
  return errorResponse(req, message, 500, "SERVER_ERROR");
}

export function serviceUnavailable(req: Request, message: string): Response {
  return errorResponse(req, message, 503, "SERVICE_UNAVAILABLE");
}

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateRequired(
  req: Request,
  body: Record<string, any>,
  fields: string[]
): { valid: true } | { valid: false; response: Response } {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null);
  if (missing.length > 0) {
    return {
      valid: false,
      response: badRequest(req, `Missing required fields: ${missing.join(", ")}`),
    };
  }
  return { valid: true };
}

export function validateUUID(
  req: Request,
  value: string,
  fieldName: string
): { valid: true } | { valid: false; response: Response } {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    return {
      valid: false,
      response: badRequest(req, `Invalid UUID format for ${fieldName}: ${value}`),
    };
  }
  return { valid: true };
}

export function validateOneOf<T>(
  req: Request,
  value: T,
  allowed: T[],
  fieldName: string
): { valid: true } | { valid: false; response: Response } {
  if (!allowed.includes(value)) {
    return {
      valid: false,
      response: badRequest(
        req,
        `Invalid value for ${fieldName}: ${value}. Allowed: ${allowed.join(", ")}`
      ),
    };
  }
  return { valid: true };
}

// ============================================================================
// Empty Response Helpers
// ============================================================================

export function noContent(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(req),
  });
}

export function accepted(req: Request, data?: any): Response {
  return jsonResponse(req, data || { success: true }, 202);
}

// ============================================================================
// Stream/Binary Responses
// ============================================================================

export function fileResponse(
  req: Request,
  buffer: Uint8Array,
  contentType: string,
  filename?: string,
  status = 200
): Response {
  const headers = {
    ...buildCorsHeaders(req),
    "Content-Type": contentType,
    ...(filename && {
      "Content-Disposition": `attachment; filename="${filename}"`,
    }),
  };

  return new Response(buffer, { status, headers });
}

export function streamResponse(
  req: Request,
  stream: ReadableStream,
  contentType: string,
  status = 200
): Response {
  const headers = {
    ...buildCorsHeaders(req),
    "Content-Type": contentType,
  };

  return new Response(stream, { status, headers });
}

// ============================================================================
// Legacy Compatibility
// ============================================================================

/**
 * @deprecated Use jsonResponse() or errorResponse() instead
 * Old jsonResponse signature for backward compatibility
 */
export function legacyJsonResponse(
  body: unknown,
  status = 200,
  corsHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
