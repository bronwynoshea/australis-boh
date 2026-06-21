// @ts-nocheck
// Sadie Session Edge Function
// Handles conversation with Sadie AI for ticket intake
// REFACTORED: Uses shared CORS helpers

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const GEMINI_TIMEOUT_MS = 25000;


const VALID_APPS = [
  "Career Studio",
  "Cafe",
  "Journey",
  "Coach",
  "Mentor",
  "DNA",
  "Talent",
  "Back of House",
  "Counter",
  "Kitchen",
  "Cookbook",
  "Patron",
];


const VALID_CATEGORIES = [
  "Bug",
  "Feature idea",
  "Question",
  "Account issue",
  "Other",
];


const VALID_SEVERITIES = ["Critical", "High", "Medium", "Low"];


function getMissingFields(slots: any) {
  const missing: string[] = [];
  if (!slots.app) missing.push("app");
  if (!slots.category) missing.push("category");
  if (!slots.severity) missing.push("severity");
  if (!slots.description) missing.push("description");
  if (!slots.title) missing.push("title");
  return missing;
}


/**
 * Detect whether this is an INTERNAL conversation.
 * We treat it as internal if the phrase "back of house"
 * appears anywhere in the conversation or slots.
 *
 * This is a secret phrase for JOBZ CAFE® team members,
 * not something external users would typically say.
 */
function detectInternalMode(
  history: { role: string; content: string }[],
  currentSlots: any,
) {
  const INTERNAL_KEYWORD = "back of house";


  const haystack = [
    ...history.map((m) => (m.content || "").toLowerCase()),
    (currentSlots.app || "").toLowerCase(),
    (currentSlots.feature || "").toLowerCase(),
    (currentSlots.func || "").toLowerCase(),
  ].join(" ");


  return haystack.includes(INTERNAL_KEYWORD.toLowerCase());
}


async function callGemini(history: any[], currentSlots: any) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }


  const endpoint =
    "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=" +
    apiKey;


  const conversationText = history
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n\n");


  // 🔐 Determine if this is an INTERNAL conversation
  const isInternal = detectInternalMode(history, currentSlots);
  const modeLabel = isInternal ? "internal" : "external";


  const internalBehavior = isInternal
    ? `
You are talking to an INTERNAL JOBZ CAFE® team member working in "Back of House".
They understand internal terminology like "bug", "feature idea", "account issue", etc.


For INTERNAL users you MAY:
- Use the category labels directly (Bug, Feature idea, Question, Account issue, Other).
- Ask very direct slot-filling questions like:
  - "Which app is this for? Counter, Talent, Career Studio, Tablez & Chairz, etc.?"
  - "Would you classify this as a bug, a feature idea, a question, or an account issue?"
- Be efficient and structured so they can get the ticket ready quickly.
`
    : `
You are talking to an EXTERNAL JOBZ CAFE® user (job seeker, recruiter, etc.).


For EXTERNAL users you MUST follow these rules:
- NEVER list the category options like:
  "Bug / Feature idea / Question / Account issue / Other".
- NEVER ask directly:
  "Is this a bug or a feature request?" or any similar classification question.
- NEVER mention raw slot names like "category", "severity", or "title".


Instead:
- Ask SHORT, friendly, conversational questions.
- Try to INFER the category from what they say:
  - If something is broken or not working as expected → internally classify as "Bug".
  - If they are asking for a new capability or improvement → internally classify as "Feature idea".
  - If they are asking how to use something → internally classify as "Question".
  - If it's about login, billing, account access, etc. → internally classify as "Account issue".
- Only ask a gentle clarification if you genuinely cannot infer the type.


Examples of GOOD external questions:
- "Which part of JOBZ CAFE® are you using when this happens?"
- "What were you trying to do when this happened?"
- "Is something not working the way it should, or are you hoping it could do something new for you?"
- "How much is this getting in your way — is it stopping you completely, making things harder, or more of a small annoyance?"


For SEVERITY with external users:
- Do NOT say "Critical / High / Medium / Low" directly.
- Instead ask things like:
  - "Is this completely blocking you from using the app?"
  - "Is it making things much harder, or more of a minor annoyance?"
You should still set the internal severity slot to Critical / High / Medium / Low, but keep the wording conversational.
`;


  const systemPrompt = `You are Sadie, the JOBZ CAFE® AI ticket assistant. Your role is to help users create well-structured support tickets by extracting information from conversations.


CONVERSATION MODE: ${modeLabel.toUpperCase()}
${internalBehavior}


SLOTS (fields to extract):
- app: Which application/module (${VALID_APPS.join(", ")})
- feature: Specific feature or area within the app
- func: Screen or smaller functional unit (optional)
- category: Type of issue (${VALID_CATEGORIES.join(", ")})
- severity: Impact level (${VALID_SEVERITIES.join(", ")})
- title: Short, descriptive title for the ticket
- description: Detailed description of the issue
- requesterEmail: Email of the person reporting (if mentioned)
- initialUserMessage: The first message from the user (if this is early in conversation)


SEVERITY NARRATIVES:
- Critical: Cannot use the system, completely blocked from work
- High: Significantly impacting work, major inconvenience
- Medium: Moderate impact, workable but problematic
- Low: Minor issue, cosmetic or nice-to-have


REQUIRED FIELDS for ready_for_review = true:
- app (required)
- category (required)
- severity (required)
- description (required)
- title (required)


Current slots already filled:
- app: ${currentSlots.app || "null"}
- feature: ${currentSlots.feature || "null"}
- func: ${currentSlots.func || "null"}
- category: ${currentSlots.category || "null"}
- severity: ${currentSlots.severity || "null"}
- title: ${currentSlots.title || "null"}
- description: ${currentSlots.description || "null"}
- requesterEmail: ${currentSlots.requesterEmail || "null"}
- initialUserMessage: ${currentSlots.initialUserMessage || "null"}


Your task:
1. Extract any new slot values from the conversation.
2. Generate a helpful assistant_message that:
   - For INTERNAL users: may use explicit labels and direct questions to fill slots quickly.
   - For EXTERNAL users: stays conversational, avoids listing options, and infers values whenever possible.
3. Determine missing_fields (all required fields that are still null).
4. Set ready_for_review to true only when all required fields are non-null.


VERY IMPORTANT RULES:
- For EXTERNAL users:
  - Do NOT list raw options like "Bug, Feature idea, Question, Account issue, Other".
  - Do NOT ask "which category is this?" or "is this a bug or a feature request?".
  - Do NOT mention internal slot names like "category", "severity", or "title".
- You may still internally SET category and severity based on their answers.
- Keep messages short, friendly, and natural.


Return ONLY a JSON object with this exact structure:
{
  "assistant_message": "your message to the user",
  "slots": {
    "app": "value or null",
    "feature": "value or null",
    "func": "value or null",
    "category": "value or null",
    "severity": "value or null",
    "title": "value or null",
    "description": "value or null",
    "requesterEmail": "value or null",
    "initialUserMessage": "value or null"
  },
  "ready_for_review": true/false,
  "missing_fields": ["app", "severity", ...]
}


Only set fields you can confidently infer from the conversation. Leave others as null.`;


  const currentSlotsJson = JSON.stringify(currentSlots, null, 2);


  const prompt = `${systemPrompt}


Current slots (JSON):
${currentSlotsJson}


Conversation:
${conversationText}


Now respond ONLY with the JSON schema defined above.`;


  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      }),
    });
  } catch (error) {
    if ((error as any)?.name === "AbortError") {
      throw new Error(`Gemini API timeout after ${GEMINI_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }


  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }


  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in Gemini response");
  }


  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Failed to parse Gemini response. Raw text:", text);
    throw new Error("Invalid JSON in Gemini response");
  }
}


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }


  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: true,
          message: "Missing Authorization header",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }


    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secretKey = Deno.env.get("SB_SECRET_KEY");
    if (!supabaseUrl || !secretKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
      return new Response(
        JSON.stringify({
          error: true,
          message: "Server configuration error",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }


    const authedClient = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });


    const {
      data: { user },
      error: authError,
    } = await authedClient.auth.getUser();


    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: true,
          message: "Invalid or missing authentication",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }


    const body = await req.json();
    const { history = [], slots = {}, fallback_mode = false } = body;


    if (!Array.isArray(history)) {
      return jsonResponse(req, {
        error: true,
        message: "Invalid history format",
      }, 400);
    }


    // First message: send a friendly greeting
    if (history.length === 0) {
      return new Response(
        JSON.stringify({
          assistant_message:
            "Hi, I'm Sadie. Tell me briefly what's going on, and I'll help you create a ticket.",
          slots: slots || {},
          ready_for_review: false,
          missing_fields: getMissingFields(slots || {}),
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }


    const lastUserMessage = history
      .slice()
      .reverse()
      .find((msg) => msg.role === "user");


    if (!lastUserMessage) {
      return new Response(
        JSON.stringify({
          assistant_message: "I'm ready to help. What would you like to report?",
          slots: slots || {},
          ready_for_review: false,
          missing_fields: getMissingFields(slots || {}),
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }


    let extractedData;
    try {
      extractedData = await callGemini(history, slots);
    } catch (error) {
      console.error("Error calling Gemini:", error);


      if (error instanceof Error && error.message.includes("Invalid JSON")) {
        return new Response(
          JSON.stringify({
            error: true,
            message: "Sadie returned invalid JSON.",
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }


      const missingFields = getMissingFields(slots);
      return new Response(
        JSON.stringify({
          assistant_message:
            missingFields.length > 0
              ? "I'm having trouble processing that. Could you tell me a bit more about the issue you're experiencing?"
              : "Thanks, I've got what I need. I'll show you the ticket so you can review and edit it before we submit.",
          slots: slots,
          missing_fields: missingFields,
          ready_for_review: missingFields.length === 0,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }


    const result = {
      assistant_message: extractedData.assistant_message ?? "",
      slots: {
        ...slots,
        ...(extractedData.slots ?? {}),
      },
      ready_for_review: extractedData.ready_for_review ?? false,
      missing_fields:
        extractedData.missing_fields ??
        getMissingFields({
          ...slots,
          ...(extractedData.slots ?? {}),
        }),
    };


    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error in sadie-session:", error);
    return new Response(
      JSON.stringify({
        error: true,
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});

