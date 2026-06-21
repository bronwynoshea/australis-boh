// TEMPLATE: Admin/Internal Edge Function
// Pattern B: Standard authentication for BOH admin functions
// Copy this file as a starting point for new admin-only functions
// @ts-nocheck

import { requireAdmin } from "../_shared/auth.ts";
import { handleCors } from "_shared/cors.ts";
import { jsonResponse, successResponse, errorResponse, badRequest, validateRequired } from "_shared/responses.ts";

// ============================================================================
// Configuration
// ============================================================================

const FUNCTION_NAME = "your-admin-function";
const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

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

  // Step 3: Authenticate and authorize admin (Pattern B: Admin/Internal)
  const auth = await requireAdmin(req);
  if (!auth.success) {
    console.error(`[${FUNCTION_NAME}] Admin auth failed:`, auth.error);
    return jsonResponse(req, { success: false, error: auth.error }, auth.status);
  }

  const { context, serviceClient } = auth;
  const { authUser, bohUser } = context;

  // Admin is verified - proceed with privileged operations
  console.log(`[${FUNCTION_NAME}] Admin operation by ${authUser.email} (${bohUser?.id})`);

  // Step 4: Parse and validate request body
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

  // Step 5: Extract query parameters
  const url = new URL(req.url);
  const queryParam = url.searchParams.get("param");

  try {
    // =========================================================================
    // YOUR ADMIN FUNCTION LOGIC HERE
    // =========================================================================

    // Example: Query all users (admin-only operation)
    // const { data: users, error } = await serviceClient
    //   .from("boh_user")
    //   .select("*")
    //   .eq("app_context", "boh");

    // Example: Modify user access (admin-only)
    // const { data, error } = await serviceClient
    //   .from("boh_user_role")
    //   .upsert({ user_id: body.userId, role_id: body.roleId });

    // Example: System-wide configuration change
    // const { data, error } = await serviceClient
    //   .from("system_config")
    //   .update({ value: body.configValue })
    //   .eq("key", body.configKey);

    // Return success response
    return successResponse(
      req,
      {
        message: "Admin operation completed",
        adminUserId: bohUser?.id,
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
Frontend call example (admin interface):

const { data, error } = await supabase.functions.invoke('your-admin-function', {
  method: 'POST',
  body: {
    targetUserId: 'uuid-here',
    newRole: 'admin',
  },
});

if (error) {
  console.error('Admin function error:', error);
  // Handle 403 if current user is not super_admin
} else {
  console.log('Admin operation success:', data);
}
*/

/*
Admin functions should only be accessible to users with super_admin role.
The requireAdmin() helper automatically checks for this role.
*/
