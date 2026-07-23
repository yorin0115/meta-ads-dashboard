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

function calcCvr(conversions: number, clicks: number): number | null {
  return clicks === 0 ? null : Math.round((conversions / clicks) * 10000) / 10000;
}

function calcCtr(clicks: number, impressions: number): number | null {
  return impressions === 0 ? null : Math.round((clicks / impressions) * 10000) / 10000;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateAsISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function aggregateTotals(
  startDate: string,
  endDate: string
): Promise<{
  cost: number;
  cpa: number | null;
  roas: number | null;
  cvr: number | null;
  ctr: number | null;
  is_complete: boolean;
}> {
  const { data, error } = await supabase
    .from("daily_performance")
    .select(
      `
      cost,
      revenue,
      impressions,
      clicks,
      conversions,
      date
    `
    )
    .gte("date", startDate)
    .lte("date", endDate);

  if (error) throw error;

  let cost = 0;
  let revenue = 0;
  let impressions = 0;
  let clicks = 0;
  let conversions = 0;
  const daysWithData = new Set<string>();

  (data || []).forEach((row: any) => {
    cost += parseFloat(row.cost || 0);
    revenue += parseFloat(row.revenue || 0);
    impressions += row.impressions || 0;
    clicks += row.clicks || 0;
    conversions += row.conversions || 0;
    daysWithData.add(row.date);
  });

  const start = new Date(startDate);
  const end = new Date(endDate);
  const periodLengthDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const isComplete = daysWithData.size >= periodLengthDays;

  return {
    cost,
    cpa: calcCpa(cost, conversions),
    roas: calcRoas(revenue || null, cost),
    cvr: calcCvr(conversions, clicks),
    ctr: calcCtr(clicks, impressions),
    is_complete: isComplete,
  };
}

async function getDailyTrend(
  startDate: string,
  endDate: string
): Promise<
  Array<{
    date: string;
    cost: number;
    cpa: number | null;
    roas: number | null;
    cvr: number | null;
    ctr: number | null;
  }>
> {
  const { data, error } = await supabase
    .from("daily_performance")
    .select(
      `
      date,
      cost,
      revenue,
      impressions,
      clicks,
      conversions
    `
    )
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");

  if (error) throw error;

  // 按日期聚合數據（sum all rows for the same date）
  const aggregatedByDate: Record<string, any> = {};
  (data || []).forEach((row: any) => {
    const date = row.date;
    if (!aggregatedByDate[date]) {
      aggregatedByDate[date] = {
        cost: 0,
        revenue: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
      };
    }
    aggregatedByDate[date].cost += parseFloat(row.cost || 0);
    aggregatedByDate[date].revenue += parseFloat(row.revenue || 0);
    aggregatedByDate[date].impressions += row.impressions || 0;
    aggregatedByDate[date].clicks += row.clicks || 0;
    aggregatedByDate[date].conversions += row.conversions || 0;
  });

  const points = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = formatDateAsISO(current);
    const aggregated = aggregatedByDate[dateStr];
    const cost = aggregated ? aggregated.cost : 0;
    const revenue = aggregated ? aggregated.revenue : 0;
    const impressions = aggregated ? aggregated.impressions : 0;
    const clicks = aggregated ? aggregated.clicks : 0;
    const conversions = aggregated ? aggregated.conversions : 0;

    points.push({
      date: dateStr,
      cost,
      cpa: calcCpa(cost, conversions),
      roas: calcRoas(revenue || null, cost),
      cvr: calcCvr(conversions, clicks),
      ctr: calcCtr(clicks, impressions),
    });

    current.setDate(current.getDate() + 1);
  }

  return points;
}

Deno.serve(async (req) => {
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

    // 計算前一個等長期間
    const start = new Date(startDate);
    const end = new Date(endDate);
    const periodLengthDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const previousEnd = addDays(start, -1);
    const previousStart = addDays(previousEnd, -(periodLengthDays - 1));

    const previousStartStr = formatDateAsISO(previousStart);
    const previousEndStr = formatDateAsISO(previousEnd);

    const current = await aggregateTotals(startDate, endDate);
    const previous = await aggregateTotals(previousStartStr, previousEndStr);
    const trend = await getDailyTrend(startDate, endDate);

    return new Response(
      JSON.stringify({
        current,
        previous,
        trend,
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
