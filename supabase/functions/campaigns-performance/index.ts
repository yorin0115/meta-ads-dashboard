import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 計算指標的函數
function calcCtr(clicks: number, impressions: number): number | null {
  return impressions === 0 ? null : Math.round((clicks / impressions) * 10000) / 10000;
}

function calcCpc(cost: number, clicks: number): number | null {
  return clicks === 0 ? null : Math.round((cost / clicks) * 100) / 100;
}

function calcCpm(cost: number, impressions: number): number | null {
  return impressions === 0 ? null : Math.round((cost / (impressions / 1000)) * 100) / 100;
}

function calcCpa(cost: number, conversions: number): number | null {
  return conversions === 0 ? null : Math.round((cost / conversions) * 100) / 100;
}

function calcCvr(conversions: number, clicks: number): number | null {
  return clicks === 0 ? null : Math.round((conversions / clicks) * 10000) / 10000;
}

function calcRoas(revenue: number | null, cost: number): number | null {
  if (revenue === null || cost === 0) return null;
  return Math.round((revenue / cost) * 100) / 100;
}

// 主 handler
Deno.serve(async (req) => {
  // 允許跨域請求
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const url = new URL(req.url);
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");

    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: "Missing date range" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // 查詢所有 campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("campaign_id, name")
      .order("campaign_id");

    if (campaignsError) throw campaignsError;

    // 查詢指定日期範圍的聚集數據
    const { data: aggData, error: aggError } = await supabase
      .from("daily_performance")
      .select(
        `
        cost,
        revenue,
        impressions,
        clicks,
        conversions,
        ad:ad_id!inner(
          adset:adset_id!inner(
            campaign_id
          )
        )
      `
      )
      .gte("date", startDate)
      .lte("date", endDate);

    if (aggError) throw aggError;

    // 聚集數據
    const aggById: Record<string, any> = {};
    (aggData || []).forEach((row: any) => {
      const campaignId = row.ad.adset.campaign_id;
      if (!aggById[campaignId]) {
        aggById[campaignId] = { cost: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 };
      }
      aggById[campaignId].cost += parseFloat(row.cost || 0);
      aggById[campaignId].revenue += parseFloat(row.revenue || 0);
      aggById[campaignId].impressions += row.impressions || 0;
      aggById[campaignId].clicks += row.clicks || 0;
      aggById[campaignId].conversions += row.conversions || 0;
    });

    // 組合結果
    const results = (campaigns || []).map((campaign: any) => {
      const agg = aggById[campaign.campaign_id] || {
        cost: 0,
        revenue: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
      };

      return {
        campaign_id: campaign.campaign_id,
        name: campaign.name,
        cost: agg.cost,
        impressions: agg.impressions,
        clicks: agg.clicks,
        conversions: agg.conversions,
        ctr: calcCtr(agg.clicks, agg.impressions),
        cpc: calcCpc(agg.cost, agg.clicks),
        cpm: calcCpm(agg.cost, agg.impressions),
        cpa: calcCpa(agg.cost, agg.conversions),
        cvr: calcCvr(agg.conversions, agg.clicks),
        roas: calcRoas(agg.revenue || null, agg.cost),
      };
    });

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
