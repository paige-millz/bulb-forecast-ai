import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, recommendationContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a knowledgeable agricultural advisor specializing in Easter bulb forcing (tulips, hyacinths, daffodils, lilies, etc.). You help growers understand their data and make practical decisions about bulb removal timing.

You have access to the grower's current recommendation data:
${JSON.stringify(recommendationContext, null, 2)}

Key terms you understand:
- **DBE (Days Before Easter)**: How many days before Easter the bulbs are removed from coolers. A higher DBE means earlier removal.
- **Median DBE**: The middle value of historical removal timings — the best single estimate.
- **IQR (Interquartile Range)**: The spread between the 25th and 75th percentile of DBE values. A smaller IQR means more consistent timing across years.
- **Confidence**: Based on number of records and IQR — High (5+ records, IQR ≤ 5), Medium, or Low.
- **Degree Hours**: Accumulated heat units above 40°F after removal — drives growth rate.

Instructions:
- Answer in plain, practical grower language. Avoid jargon unless asked.
- Reference the specific data when answering (dates, numbers, confidence levels).
- If asked about timing adjustments, consider that warmer temps = faster growth = can remove later, cooler temps = slower growth = remove earlier.
- Keep answers concise but helpful. Use bullet points when listing multiple items.
- If you don't know something or the data doesn't support an answer, say so honestly.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("grower-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
