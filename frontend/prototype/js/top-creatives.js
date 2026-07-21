// 強勢素材清單：找出過去30天平均CPA有達成KPI目標的素材
// 判斷邏輯：CPA是「花多少錢才換到一次轉換」，數字越低越好，
// 所以「達成KPI」的定義是 -- 平均CPA 小於等於使用者設定的目標值

const TOP_CREATIVE_TARGET_STORAGE_KEY = "metaAdsDashboard.topCreativeCpaTarget";
const TOP_CREATIVE_DEFAULT_TARGET = 150;

// 素材的投遞狀態設定：label 是畫面上顯示的中文字、className 決定badge的顏色
const CREATIVE_STATUS_CONFIG = {
    active: { label: "投遞中", className: "bg-emerald-100 text-emerald-700" },
    paused: { label: "已關閉", className: "bg-slate-200 text-slate-600" },
    deleted: { label: "已刪除", className: "bg-red-100 text-red-600" }
};

let topCreativePerformanceData = null;

// 把過去30天的每日數字加總，算出這段期間真正的CPA（不能先算出每天的CPA再平均，要先加總花費/轉換再相除）
function calcCpa30d(dailyEntries) {
    const totals = dailyEntries.reduce((acc, day) => {
        acc.cost += day.cost;
        acc.conversions += day.conversions;
        return acc;
    }, { cost: 0, conversions: 0 });

    return totals.conversions > 0 ? totals.cost / totals.conversions : null;
}

// 找出所有「30天平均CPA <= 目標值」的素材，並附上所屬的Adset、Campaign名稱
function buildTopCreatives(data, targetCpa) {
    const adsetById = new Map(data.adsets.map((adset) => [adset.id, adset]));
    const campaignById = new Map(data.campaigns.map((campaign) => [campaign.id, campaign]));

    return data.creatives
        .map((creative) => {
            const cpa = calcCpa30d(data.dailyData.creatives[creative.id]);
            if (cpa === null || Number.isNaN(targetCpa) || cpa > targetCpa) return null;

            const parentAdset = adsetById.get(creative.adsetId);
            const parentCampaign = parentAdset ? campaignById.get(parentAdset.campaignId) : null;

            return {
                name: creative.name,
                status: creative.status,
                cpa: cpa,
                adsetName: parentAdset ? parentAdset.name : "-",
                campaignName: parentCampaign ? parentCampaign.name : "-"
            };
        })
        .filter((row) => row !== null)
        .sort((a, b) => a.cpa - b.cpa); // CPA 最低（表現最好）排最前面
}

function renderTopCreativeList(rows) {
    const container = document.getElementById("top-creative-list");
    container.innerHTML = "";

    if (rows.length === 0) {
        container.innerHTML = `<div class="text-sm text-slate-500 py-2">目前沒有素材達成這個KPI目標，可以試著調高目標CPA。</div>`;
        return;
    }

    rows.forEach((row) => {
        const statusConfig = CREATIVE_STATUS_CONFIG[row.status] || CREATIVE_STATUS_CONFIG.active;

        const rowEl = document.createElement("div");
        rowEl.className = "py-2.5 px-3 mb-2 last:mb-0 border-l-4 border-[#0BD99F] bg-[#F2F2F2] rounded-r-md flex items-center justify-between gap-3";
        rowEl.innerHTML = `
            <div>
                <div class="text-sm font-medium text-[#2B2B2B]">${row.name}</div>
                <div class="text-xs text-slate-500">${row.campaignName} > ${row.adsetName}</div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <span class="text-sm font-semibold text-[#10B981]">CPA NT$ ${Math.round(row.cpa).toLocaleString("zh-TW")}</span>
                <span class="text-xs px-2 py-0.5 rounded-full ${statusConfig.className}">${statusConfig.label}</span>
            </div>
        `;
        container.appendChild(rowEl);
    });
}

function renderTopCreatives() {
    if (!topCreativePerformanceData) return;

    const targetCpa = Number(document.getElementById("topCreativeTargetInput").value);
    localStorage.setItem(TOP_CREATIVE_TARGET_STORAGE_KEY, targetCpa);

    const rows = buildTopCreatives(topCreativePerformanceData, targetCpa);
    renderTopCreativeList(rows);
}

fetch("../../data/creative_performance.json")
    .then((response) => response.json())
    .then((data) => {
        topCreativePerformanceData = data;

        const savedTarget = localStorage.getItem(TOP_CREATIVE_TARGET_STORAGE_KEY);
        document.getElementById("topCreativeTargetInput").value =
            savedTarget !== null ? savedTarget : TOP_CREATIVE_DEFAULT_TARGET;

        renderTopCreatives();

        document.getElementById("topCreativeTargetInput").addEventListener("input", renderTopCreatives);
    })
    .catch((error) => console.error("讀取強勢素材資料失敗：", error));
