import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function calcCpa(cost: number, conversions: number): number | null {
  return conversions === 0 ? null : Math.round((cost / conversions) * 100) / 100;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const url = new URL(req.url);
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const targetCpa = parseFloat(url.searchParams.get("target_cpa") || "0");

    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: "Missing date range" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // 查詢日期範圍內的所有廣告數據
    const { data, error } = await supabase
      .from("daily_performance")
      .select(
        `
        date,
        cost,
        conversions,
        delivery_status,
        ad:ad_id!inner(
          ad_id,
          name,
          adset:adset_id!inner(
            name,
            campaign:campaign_id!inner(
              name
            )
          )
        )
      `
      )
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date");

    if (error) throw error;

    // 聚集同一廣告的多天數據
    const totals: Record<string, any> = {};
    (data || []).forEach((row: any) => {
      const adId = row.ad.ad_id;
      if (!totals[adId]) {
        totals[adId] = {
          name: row.ad.name,
          adset_name: row.ad.adset.name,
          campaign_name: row.ad.adset.campaign.name,
          cost: 0,
          conversions: 0,
          status: row.delivery_status,
        };
      }
      totals[adId].cost += parseFloat(row.cost || 0);
      totals[adId].conversions += row.conversions || 0;
      totals[adId].status = row.delivery_status; // 最後一天的狀態
    });

    // 篩選符合目標 CPA 的廣告
    const results = [];
    for (const [adId, entry] of Object.entries(totals)) {
      const cpa = calcCpa((entry as any).cost, (entry as any).conversions);
      if (cpa !== null && cpa <= targetCpa) {
        results.push({
          ad_id: adId,
          name: (entry as any).name,
          adset_name: (entry as any).adset_name,
          campaign_name: (entry as any).campaign_name,
          cpa,
          status: (entry as any).status,
        });
      }
    }

    // 按 CPA 排序（低在前）
    results.sort((a, b) => (a.cpa || 0) - (b.cpa || 0));

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as any).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
