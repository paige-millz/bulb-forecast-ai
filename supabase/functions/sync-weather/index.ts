import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latitude, longitude, startDate, endDate } = await req.json();

    if (!latitude || !longitude || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: "latitude, longitude, startDate, endDate are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch from Open-Meteo (free, no API key needed)
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean&temperature_unit=fahrenheit&timezone=America%2FNew_York`;

    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Open-Meteo API error [${resp.status}]: ${text}`);
    }

    const json = await resp.json();
    const dates: string[] = json.daily?.time ?? [];
    const tmax: (number | null)[] = json.daily?.temperature_2m_max ?? [];
    const tmin: (number | null)[] = json.daily?.temperature_2m_min ?? [];
    const tavg: (number | null)[] = json.daily?.temperature_2m_mean ?? [];

    const rows = dates
      .map((date: string, i: number) => ({
        date,
        tmax_f: tmax[i],
        tmin_f: tmin[i],
        tavg_f: tavg[i],
        source: "open-meteo",
      }))
      .filter((r: any) => r.tavg_f != null);

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No weather data returned for the given parameters." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert into weather_daily
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from("weather_daily").upsert(chunk, { onConflict: "date" });
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ success: true, daysImported: rows.length, range: { start: dates[0], end: dates[dates.length - 1] } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
