import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function calcCpa(cost: number, conversions: number): number | null {
  return conversions === 0 ? null : Math.round((cost / conversions) * 100) / 100;
}

function calcRoas(revenue: number | null, cost: number): number | null {
  if (revenue === null || cost === 0) return null;
  return Math.round((revenue / cost) * 100) / 100;
}

function calcAlertMetric(metric: string, cost: number, revenue: number | null, conversions: number): number | null {
  if (metric === "cpa") {
    return calcCpa(cost, conversions);
  }
  return calcRoas(revenue, cost);
}

function isExceeded(metric: string, value: number | null, threshold: number): boolean {
  if (value === null) return false;
  if (metric === "cpa") {
    return value > threshold;
  }
  return value < threshold; // roas
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const url = new URL(req.url);
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const metric = url.searchParams.get("metric") || "cpa";
    const threshold = parseFloat(url.searchParams.get("threshold") || "0");

    if (!startDate || !endDate || !["cpa", "roas"].includes(metric)) {
      return new Response(JSON.stringify({ error: "Invalid parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // 查詢廣告組合警示
    const { data: adsetData, error: adsetError } = await supabase
      .from("daily_performance")
      .select(
        `
        cost,
        revenue,
        conversions,
        ad:ad_id!inner(
          adset:adset_id!inner(
            adset_id,
            name,
            campaign:campaign_id!inner(
              name
            )
          )
        )
      `
      )
      .gte("date", startDate)
      .lte("date", endDate);

    if (adsetError) throw adsetError;

    const adsetMap: Record<string, any> = {};
    (adsetData || []).forEach((row: any) => {
      const adsetId = row.ad.adset.adset_id;
      if (!adsetMap[adsetId]) {
        adsetMap[adsetId] = {
          name: row.ad.adset.name,
          campaign_name: row.ad.adset.campaign.name,
          cost: 0,
          revenue: 0,
          conversions: 0,
        };
      }
      adsetMap[adsetId].cost += parseFloat(row.cost || 0);
      adsetMap[adsetId].revenue += parseFloat(row.revenue || 0);
      adsetMap[adsetId].conversions += row.conversions || 0;
    });

    const adsetAlerts = [];
    for (const [_, entry] of Object.entries(adsetMap)) {
      const value = calcAlertMetric(metric, (entry as any).cost, (entry as any).revenue || null, (entry as any).conversions);
      if (isExceeded(metric, value, threshold)) {
        adsetAlerts.push({
          name: (entry as any).name,
          parent_name: (entry as any).campaign_name,
          metric,
          value,
          threshold,
        });
      }
    }

    // 查詢廣告警示
    const { data: adData, error: adError } = await supabase
      .from("daily_performance")
      .select(
        `
        cost,
        revenue,
        conversions,
        ad:ad_id!inner(
          name,
          adset:adset_id!inner(
            name
          )
        )
      `
      )
      .gte("date", startDate)
      .lte("date", endDate);

    if (adError) throw adError;

    const adMap: Record<string, any> = {};
    (adData || []).forEach((row: any) => {
      const adId = row.ad.name; // Using name as key for simplicity
      if (!adMap[adId]) {
        adMap[adId] = {
          name: row.ad.name,
          adset_name: row.ad.adset.name,
          cost: 0,
          revenue: 0,
          conversions: 0,
        };
      }
      adMap[adId].cost += parseFloat(row.cost || 0);
      adMap[adId].revenue += parseFloat(row.revenue || 0);
      adMap[adId].conversions += row.conversions || 0;
    });

    const creativeAlerts = [];
    for (const [_, entry] of Object.entries(adMap)) {
      const value = calcAlertMetric(metric, (entry as any).cost, (entry as any).revenue || null, (entry as any).conversions);
      if (isExceeded(metric, value, threshold)) {
        creativeAlerts.push({
          name: (entry as any).name,
          parent_name: (entry as any).adset_name,
          metric,
          value,
          threshold,
        });
      }
    }

    return new Response(
      JSON.stringify({
        adset_alerts: adsetAlerts,
        creative_alerts: creativeAlerts,
      }),
      {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as any).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
