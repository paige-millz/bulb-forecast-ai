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
    const body = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Mode 1: CSV data upload
    if (body.rows && Array.isArray(body.rows)) {
      const rows = body.rows;
      let imported = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase.from("weather_daily").upsert(chunk, { onConflict: "date" });
        if (error) throw error;
        imported += chunk.length;
      }
      return new Response(
        JSON.stringify({ success: true, daysImported: imported }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mode 2: Forecast (no DB write)
    if (body.forecast) {
      const { latitude, longitude } = body;
      if (!latitude || !longitude) {
        return new Response(
          JSON.stringify({ error: "Provide latitude and longitude for forecast" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const fUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean&temperature_unit=fahrenheit&forecast_days=16&timezone=America%2FNew_York`;
      const fResp = await fetch(fUrl);
      if (!fResp.ok) {
        const text = await fResp.text();
        throw new Error(`Open-Meteo forecast error [${fResp.status}]: ${text}`);
      }
      const fJson = await fResp.json();
      return new Response(JSON.stringify(fJson), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode 3: Open-Meteo API sync (archive)
    const { latitude, longitude, startDate, endDate } = body;
    if (!latitude || !longitude || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: "Provide either 'rows' array, forecast:true, or latitude/longitude/startDate/endDate" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const apiRows = dates
      .map((date: string, i: number) => ({
        date,
        tmax_f: tmax[i],
        tmin_f: tmin[i],
        tavg_f: tavg[i],
        source: "open-meteo",
      }))
      .filter((r: any) => r.tavg_f != null);

    if (apiRows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No weather data returned for the given parameters." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (let i = 0; i < apiRows.length; i += 500) {
      const chunk = apiRows.slice(i, i + 500);
      const { error } = await supabase.from("weather_daily").upsert(chunk, { onConflict: "date" });
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ success: true, daysImported: apiRows.length, range: { start: dates[0], end: dates[dates.length - 1] } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
