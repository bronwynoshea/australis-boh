// TEMPLATE: Protected User Edge Function
// Pattern A: Standard authentication for BOH user functions
// Copy this file as a starting point for new protected user functions
// @ts-nocheck

import { requireUser } from "../_shared/auth.ts";
import { handleCors } from "_shared/cors.ts";
import { jsonResponse, successResponse, errorResponse, badRequest, validateRequired } from "_shared/responses.ts";

// ============================================================================
// Configuration
// ============================================================================

const FUNCTION_NAME = "your-function-name";
const ALLOWED_METHODS = ["GET", "POST"]; // Adjust as needed

// ============================================================================
// Request Handler
// ============================================================================

Deno.serve(async (req) => {
  // Step 1: Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Step 2: Validate HTTP method
  if (!ALLOWED_METHODS.includes(req.method)) {
    return errorResponse(req, `Method ${req.method} not allowed`, 405);
  }

  // Step 3: Authenticate user (Pattern A: Protected User)
  const auth = await requireUser(req);
  if (!auth.success) {
    console.error(`[${FUNCTION_NAME}] Auth failed:`, auth.error);
    return jsonResponse(req, { success: false, error: auth.error }, auth.status);
  }

  const { context, serviceClient } = auth;
  const { authUser, bohUser, isSuperAdmin } = context;

  // Step 4: Parse and validate request body (for POST/PUT/PATCH)
  let body = {};
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    try {
      body = await req.json();
    } catch (e) {
      return badRequest(req, "Invalid JSON body");
    }

    // Validate required fields
    // const validation = validateRequired(req, body, ["field1", "field2"]);
    // if (!validation.valid) return validation.response;
  }

  // Step 5: Extract query parameters (for GET)
  const url = new URL(req.url);
  const queryParam = url.searchParams.get("param");

  try {
    // =========================================================================
    // YOUR FUNCTION LOGIC HERE
    // =========================================================================

    // Example: Database query using service client
    // const { data, error } = await serviceClient
    //   .from("your_table")
    //   .select("*")
    //   .eq("user_id", bohUser?.id || authUser.id)
    //   .maybeSingle();

    // Example: Check ownership before operation
    // if (!isSuperAdmin && data?.owner_id !== bohUser?.id) {
    //   return errorResponse(req, "Access denied to this resource", 403);
    // }

    // Example: Insert/update operation
    // const { data: result, error } = await serviceClient
    //   .from("your_table")
    //   .insert({ user_id: bohUser?.id, ...body })
    //   .select()
    //   .single();

    // Return success response
    return successResponse(
      req,
      {
        // Your response data
        message: "Operation completed",
        userId: bohUser?.id || authUser.id,
        // data: result,
      },
      { timestamp: new Date().toISOString() }
    );
  } catch (error) {
    console.error(`[${FUNCTION_NAME}] Unexpected error:`, error);
    return errorResponse(req, "Internal server error", 500);
  }
});

// ============================================================================
// Usage Examples
// ============================================================================

/*
Frontend call example:

const { data, error } = await supabase.functions.invoke('your-function-name', {
  method: 'POST',
  body: {
    field1: 'value1',
    field2: 'value2',
  },
});

if (error) {
  console.error('Function error:', error);
} else {
  console.log('Success:', data);
}
*/
