// TEMPLATE: Public/Webhook Edge Function
// Pattern C: API Key authentication for external webhooks and public endpoints
// Copy this file as a starting point for new public webhook functions
// WARNING: Use sparingly. Prefer Pattern A (protected-user) where possible.
// @ts-nocheck

import { requireApiKey } from "../_shared/auth.ts";
import { handleCors } from "_shared/cors.ts";
import { jsonResponse, successResponse, errorResponse, badRequest, validateRequired, accepted } from "_shared/responses.ts";

// ============================================================================
// Configuration
// ============================================================================

const FUNCTION_NAME = "your-webhook-function";
const ALLOWED_METHODS = ["GET", "POST"];
const API_KEY_ENV_VAR = "YOUR_WEBHOOK_API_KEY"; // Must be set in Supabase secrets

// ============================================================================
// Webhook Handler
// ============================================================================

Deno.serve(async (req) => {
  // Step 1: Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Step 2: Validate HTTP method
  if (!ALLOWED_METHODS.includes(req.method)) {
    return errorResponse(req, `Method ${req.method} not allowed`, 405);
  }

  // Step 3: Validate API Key (Pattern C: Public/Webhook)
  // Supports header: X-API-Key or query param: ?api_key=...
  const auth = await requireApiKey(req, API_KEY_ENV_VAR, {
    headerName: "X-API-Key",
    queryParamName: "api_key",
  });

  if (!auth.success) {
    console.error(`[${FUNCTION_NAME}] API key validation failed:`, auth.error);
    return jsonResponse(req, { success: false, error: auth.error }, auth.status);
  }

  const { serviceClient } = auth;

  // Step 4: Parse request body or query params
  let body = {};
  let queryParams: Record<string, string> = {};

  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch (e) {
      // Webhooks may have non-JSON bodies - handle appropriately
      const text = await req.text();
      console.log(`[${FUNCTION_NAME}] Received non-JSON body:`, text);
      // Parse as needed for your webhook provider (Stripe, GitHub, etc.)
    }
  }

  const url = new URL(req.url);
  url.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  // Step 5: Validate webhook signature (if provider supports it)
  // Example for Stripe:
  // const signature = req.headers.get("stripe-signature");
  // const isValid = verifyStripeSignature(body, signature, webhookSecret);
  // if (!isValid) return errorResponse(req, "Invalid signature", 401);

  try {
    // =========================================================================
    // YOUR WEBHOOK LOGIC HERE
    // =========================================================================

    // Webhooks should be idempotent - use external ID to deduplicate
    // const externalId = body.id || queryParams.id;
    // const { data: existing } = await serviceClient
    //   .from("webhook_events")
    //   .select("id")
    //   .eq("external_id", externalId)
    //   .maybeSingle();
    // if (existing) return accepted(req, { message: "Already processed" });

    // Process the webhook event
    // switch (body.event_type) {
    //   case "payment.success":
    //     await handlePaymentSuccess(serviceClient, body);
    //     break;
    //   case "user.created":
    //     await handleUserCreated(serviceClient, body);
    //     break;
    // }

    // Store webhook event for audit/debugging
    // await serviceClient.from("webhook_events").insert({
    //   external_id: externalId,
    //   source: FUNCTION_NAME,
    //   payload: body,
    //   processed_at: new Date().toISOString(),
    // });

    // Return success (webhooks often expect 200 even for duplicate events)
    return successResponse(
      req,
      {
        message: "Webhook processed",
        receivedAt: new Date().toISOString(),
      },
      { eventId: body.id || "unknown" }
    );
  } catch (error) {
    console.error(`[${FUNCTION_NAME}] Webhook error:`, error);
    // Return 500 to signal to sender that webhook failed
    return errorResponse(req, "Webhook processing failed", 500);
  }
});

// ============================================================================
// Security Considerations
// ============================================================================

/*
IMPORTANT SECURITY NOTES:

1. IP Allowlisting: Consider checking req.headers.get("x-forwarded-for") against
   known provider IPs (e.g., Stripe publishes their IP ranges).

2. Signature Verification: Always verify webhook signatures when the provider
   supports it (Stripe, GitHub, Slack, etc.).

3. Idempotency: Store processed event IDs to prevent duplicate processing.

4. Rate Limiting: Webhooks can be flooded. Consider implementing rate limiting
   or queue-based processing for high-volume webhooks.

5. Minimal Scope: This function runs with service role access. Limit database
   operations to only what's necessary.
*/

// ============================================================================
// Usage Examples
// ============================================================================

/*
External system webhook setup:

URL: https://<project>.supabase.co/functions/v1/your-webhook-function?api_key=YOUR_API_KEY
Headers:
  X-API-Key: YOUR_API_KEY
  Content-Type: application/json

Body: (varies by provider)
{
  "event_type": "payment.success",
  "id": "evt_1234567890",
  "data": { ... }
}
*/

/*
Testing locally:

curl -X POST http://localhost:54321/functions/v1/your-webhook-function \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-test-api-key" \
  -d '{"event_type":"test","id":"test-123","data":{}}'
*/
