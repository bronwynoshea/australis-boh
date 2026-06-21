// Intelligent Model Router for OpenRouter + Direct APIs
// Routes tasks to cheapest appropriate model

import { corsHeaders, handleCors } from "../_shared/cors.ts"

// Model tiers with cost estimates (per 1M tokens)
const MODEL_TIERS = {
  // FREE TIER (OpenRouter)
  free: [
    { id: "google/gemini-2.0-flash-exp:free", name: "Gemini Flash", speed: "fast", bestFor: ["simple", "summarization", "extraction"], cost: 0 },
    { id: "deepseek/deepseek-coder:free", name: "DeepSeek Coder", speed: "fast", bestFor: ["coding", "technical", "debugging"], cost: 0 },
    { id: "meta-llama/llama-3.1-8b-instruct:free", name: "Llama 3.1 8B", speed: "fast", bestFor: ["simple", "chat", "general"], cost: 0 },
    { id: "qwen/qwen-2.5-coder-32b-instruct:free", name: "Qwen Coder", speed: "medium", bestFor: ["coding", "technical"], cost: 0 },
    { id: "microsoft/phi-4:free", name: "Phi-4", speed: "medium", bestFor: ["reasoning", "analysis", "mentor"], cost: 0 },
  ],
  // BUDGET TIER (OpenRouter - cheap but good)
  budget: [
    { id: "google/gemini-flash-1.5", name: "Gemini Flash", speed: "fast", bestFor: ["general", "long-context"], cost: 0.075 },
    { id: "moonshotai/kimi-k2.5", name: "Kimi K2.5", speed: "fast", bestFor: ["coding", "analysis"], cost: 0.50 },
  ],
  // PREMIUM TIER (OpenRouter or Direct)
  premium: [
    { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", speed: "medium", bestFor: ["complex", "reasoning", "creative"], cost: 3.0 },
    { id: "openai/gpt-4o", name: "GPT-4o", speed: "medium", bestFor: ["general", "multimodal"], cost: 5.0 },
    { id: "anthropic/claude-3-opus", name: "Claude 3 Opus", speed: "slow", bestFor: ["research", "complex-code"], cost: 15.0 },
  ]
}

// Task classifier
function classifyTask(prompt: string): { type: string; complexity: number; urgency: string } {
  const p = prompt.toLowerCase()
  
  // Check for code-related tasks
  if (/\b(code|programming|function|debug|error|syntax|python|javascript|typescript|react|api)\b/.test(p)) {
    return { type: "coding", complexity: 3, urgency: "normal" }
  }
  
  // Check for simple tasks
  if (/\b(summarize|extract|list|brief|short|quick|simple)\b/.test(p) && prompt.length < 500) {
    return { type: "simple", complexity: 1, urgency: "low" }
  }
  
  // Check for research/analysis
  if (/\b(analyze|research|investigate|compare|evaluate|assess|review)\b/.test(p)) {
    return { type: "analysis", complexity: 4, urgency: "normal" }
  }
  
  // Check for creative/complex
  if (/\b(design|create|architect|plan|strategy|complex|detailed)\b/.test(p)) {
    return { type: "complex", complexity: 5, urgency: "normal" }
  }
  
  // Check for urgent
  if (/\b(urgent|critical|asap|emergency|important)\b/.test(p)) {
    return { type: "general", complexity: 3, urgency: "high" }
  }
  
  // Default
  return { type: "general", complexity: 2, urgency: "normal" }
}

// Select best model based on classification
function selectModel(classification: { type: string; complexity: number; urgency: string }, preferFree: boolean = true) {
  const { type, complexity, urgency } = classification
  
  // High urgency or complex = premium
  if (urgency === "high" || complexity >= 4) {
    return MODEL_TIERS.premium[0] // Claude 3.5 Sonnet
  }
  
  // Coding tasks = DeepSeek Coder (best free) or Qwen
  if (type === "coding") {
    if (preferFree) {
      // Prefer DeepSeek Coder for coding, fallback to Qwen
      const deepseek = MODEL_TIERS.free.find(m => m.id === "deepseek/deepseek-coder:free")
      if (deepseek) return deepseek
      return MODEL_TIERS.free.find(m => m.bestFor.includes("coding")) || MODEL_TIERS.free[0]
    }
    return MODEL_TIERS.budget.find(m => m.bestFor.includes("coding")) || MODEL_TIERS.budget[0]
  }
  
  // Simple tasks = free tier
  if (complexity <= 2 && preferFree) {
    return MODEL_TIERS.free[0] // Gemini Flash
  }
  
  // Default to budget tier
  return MODEL_TIERS.budget[0]
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const body = await req.json()
    const { prompt, messages, preferFree = true, forceModel } = body
    
    if (!prompt && !messages) {
      return new Response(
        JSON.stringify({ error: "prompt or messages required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    
    const promptText = prompt || messages.map((m: any) => m.content).join(" ")
    
    // Classify task
    const classification = classifyTask(promptText)
    
    // Select model
    const selectedModel = forceModel ? { id: forceModel, name: "Forced", cost: 0 } : selectModel(classification, preferFree)
    
    // Call OpenRouter
    const openRouterKey = Deno.env.get("OPENROUTER_API_KEY")
    if (!openRouterKey) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    
    const startTime = Date.now()
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://jobzcafe.cloud", // Required by OpenRouter
        "X-Title": "JOBZ CAFE Central"
      },
      body: JSON.stringify({
        model: selectedModel.id,
        messages: messages || [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      })
    })
    
    const latency = Date.now() - startTime
    
    if (!response.ok) {
      const error = await response.text()
      return new Response(
        JSON.stringify({ error: "OpenRouter error", details: error }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    
    const result = await response.json()
    
    // Log for cost tracking
    console.log("[Model Router]", {
      model: selectedModel.id,
      classification,
      latency,
      estimatedCost: selectedModel.cost,
      tokens: result.usage
    })
    
    return new Response(JSON.stringify({
      ok: true,
      model: selectedModel,
      classification,
      latency,
      response: result.choices[0]?.message?.content,
      usage: result.usage,
      raw: result
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
    
  } catch (err) {
    console.error("[Model Router] Error:", err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

// Export for testing
export { classifyTask, selectModel }
