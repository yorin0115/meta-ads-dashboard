// 強勢素材清單：找出過去30天平均CPA有達成KPI目標的素材
// 判斷邏輯：CPA是「花多少錢才換到一次轉換」，數字越低越好，
// 所以「達成KPI」的定義是 -- 平均CPA 小於等於使用者設定的目標值
// CPA的計算跟「達成目標」的篩選都在後端（/api/top-creatives）做，這裡只負責顯示

const TOP_CREATIVE_TARGET_STORAGE_KEY = "metaAdsDashboard.topCreativeCpaTarget";
const TOP_CREATIVE_DEFAULT_TARGET = 150;

// 每頁最多顯示幾支素材；超過的部分要靠分頁按鈕切換
const TOP_CREATIVE_PAGE_SIZE = 5;

let topCreativeCurrentPage = 1;

// 素材的投遞狀態設定：label 是畫面上顯示的中文字、className 決定badge的顏色
// 這裡的key要對應Meta廣告的真實投遞狀態（active/inactive/not_delivering），不是mock data原本用的active/paused/deleted
const CREATIVE_STATUS_CONFIG = {
    active: { label: "投遞中", className: "bg-emerald-100 text-emerald-700" },
    inactive: { label: "已關閉", className: "bg-slate-200 text-slate-600" },
    not_delivering: { label: "未投遞", className: "bg-amber-100 text-amber-700" }
};
const UNKNOWN_STATUS_CONFIG = { label: "狀態不明", className: "bg-slate-200 text-slate-600" };

async function fetchTopCreatives(startDate, endDate, targetCpa) {
    const url = `${API_BASE_URL}/top-creatives?start_date=${startDate}&end_date=${endDate}&target_cpa=${targetCpa}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`API回應錯誤：${response.status}`);
    }
    return response.json();
}

// 把API回傳的欄位名稱（adset_name/campaign_name）對應成畫面要用的名稱（adsetName/campaignName）
function buildTopCreativeRows(apiRows) {
    return apiRows.map((row) => ({
        name: row.name,
        status: row.status,
        cpa: row.cpa,
        adsetName: row.adset_name,
        campaignName: row.campaign_name
    }));
}

function renderTopCreativeList(rows) {
    const container = document.getElementById("top-creative-list");
    container.innerHTML = "";

    if (rows.length === 0) {
        container.innerHTML = `<div class="text-sm text-slate-500 py-2">目前沒有素材達成這個KPI目標，可以試著調高目標CPA。</div>`;
        return;
    }

    const startIndex = (topCreativeCurrentPage - 1) * TOP_CREATIVE_PAGE_SIZE;
    const pageRows = rows.slice(startIndex, startIndex + TOP_CREATIVE_PAGE_SIZE);

    pageRows.forEach((row) => {
        const statusConfig = CREATIVE_STATUS_CONFIG[row.status] || UNKNOWN_STATUS_CONFIG;

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

function renderTopCreativePagination(totalPages) {
    const container = document.getElementById("top-creative-pagination");
    container.innerHTML = "";
    container.className = "flex items-center justify-end gap-2 mt-4";

    if (totalPages <= 1) return;

    const buttonClass = "text-xs px-2 py-1 border border-slate-300 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50";

    const prevButton = document.createElement("button");
    prevButton.textContent = "上一頁";
    prevButton.className = buttonClass;
    prevButton.disabled = topCreativeCurrentPage === 1;
    prevButton.addEventListener("click", () => {
        topCreativeCurrentPage -= 1;
        renderTopCreatives();
    });

    const pageText = document.createElement("div");
    pageText.className = "text-xs text-slate-500";
    pageText.textContent = `第 ${topCreativeCurrentPage} / ${totalPages} 頁`;

    const nextButton = document.createElement("button");
    nextButton.textContent = "下一頁";
    nextButton.className = buttonClass;
    nextButton.disabled = topCreativeCurrentPage === totalPages;
    nextButton.addEventListener("click", () => {
        topCreativeCurrentPage += 1;
        renderTopCreatives();
    });

    container.appendChild(prevButton);
    container.appendChild(pageText);
    container.appendChild(nextButton);
}

// 固定看「過去30天」，跟KPI卡片選的時間區間無關
async function renderTopCreatives() {
    const targetCpa = Number(document.getElementById("topCreativeTargetInput").value);
    localStorage.setItem(TOP_CREATIVE_TARGET_STORAGE_KEY, targetCpa);

    if (Number.isNaN(targetCpa)) return;

    const { startDate, endDate } = getDateRangeForPreset("30d");

    try {
        const apiRows = await fetchTopCreatives(startDate, endDate, targetCpa);
        const rows = buildTopCreativeRows(apiRows);

        const totalPages = Math.max(Math.ceil(rows.length / TOP_CREATIVE_PAGE_SIZE), 1);
        // 如果篩選條件改變導致總頁數變少，目前頁碼可能超出範圍，要拉回最後一頁
        if (topCreativeCurrentPage > totalPages) {
            topCreativeCurrentPage = totalPages;
        }

        renderTopCreativeList(rows);
        renderTopCreativePagination(totalPages);
    } catch (error) {
        console.error("讀取強勢素材資料失敗：", error);
    }
}

const savedTarget = localStorage.getItem(TOP_CREATIVE_TARGET_STORAGE_KEY);
document.getElementById("topCreativeTargetInput").value =
    savedTarget !== null ? savedTarget : TOP_CREATIVE_DEFAULT_TARGET;

renderTopCreatives();
document.getElementById("topCreativeTargetInput").addEventListener("input", () => {
    topCreativeCurrentPage = 1;
    renderTopCreatives();
});
