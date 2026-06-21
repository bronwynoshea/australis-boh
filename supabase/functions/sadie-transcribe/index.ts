// @ts-nocheck
// Sadie Transcribe Edge Function
// Handles audio transcription for voice input using Gemini

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
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
        JSON.stringify({ error: true, message: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secretKey = Deno.env.get("SB_SECRET_KEY");
    
    if (!supabaseUrl || !secretKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
      return new Response(
        JSON.stringify({ error: true, message: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authedClient = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authedClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: true, message: "Invalid or missing authentication" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    
    if (!contentType.includes("audio/") && !contentType.includes("application/octet-stream")) {
      return new Response(
        JSON.stringify({
          error: true,
          message: "Content-Type must be audio/webm or application/octet-stream",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const audioArrayBuffer = await req.arrayBuffer();
    
    if (audioArrayBuffer.byteLength === 0) {
      return new Response(
        JSON.stringify({
          error: true,
          message: "No audio data provided",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      console.error("GEMINI_API_KEY not configured");
      return new Response(
        JSON.stringify({
          error: true,
          message: "Transcription service not configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const audioBytes = new Uint8Array(audioArrayBuffer);
    const base64Data = btoa(
      Array.from(audioBytes, (b) => String.fromCharCode(b)).join("")
    );

    const endpoint =
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=" +
      apiKey;

    const mimeType = contentType.includes("webm") ? "audio/webm" : "audio/mpeg";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.0,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return new Response(
        JSON.stringify({
          error: true,
          message: `Transcription failed: ${response.status}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!transcript || transcript.trim().length === 0) {
      console.error("Empty transcript from Gemini:", data);
      return new Response(
        JSON.stringify({
          error: true,
          message: "Transcription returned empty result",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        transcript: transcript.trim(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in sadie-transcribe:", error);
    return new Response(
      JSON.stringify({
        error: true,
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
