// 表格欄位設定：label 是欄位標題、format 決定數字怎麼呈現
// cost / impressions / clicks / reach / conversions / revenue 是 mock data 裡的原始數字
// ctr、cpc、cpm、roas、cpa、cvr 都是用原始數字「即時算出來」，不是寫死在資料裡
const TABLE_METRIC_CONFIG = {
    cost: { label: "Spend", format: "currency" },
    impressions: { label: "Impressions", format: "integer" },
    reach: { label: "Reach", format: "integer" },
    cpm: { label: "CPM", format: "currency" },    
    clicks: { label: "Clicks", format: "integer" },
    cpc: { label: "CPC", format: "currency" },
    ctr: { label: "CTR", format: "percent" },
    conversions: { label: "Conversion", format: "integer" },
    cpa: { label: "CPA", format: "currency" },
    roas: { label: "ROAS", format: "ratio" },
    cvr: { label: "CVR", format: "percent" }
};

const TABLE_COLUMNS = ["name", ...Object.keys(TABLE_METRIC_CONFIG)];

let campaignPerformanceData = null;
let tableSortState = { key: "cost", direction: "desc" };

function formatTableValue(value, format) {
    if (value === null) {
        return "–";
    }
    if (format === "currency") {
        return "NT$ " + Math.round(value).toLocaleString("zh-TW");
    }
    if (format === "integer") {
        return Math.round(value).toLocaleString("zh-TW");
    }
    if (format === "percent") {
        return value.toFixed(2) + "%";
    }
    if (format === "ratio") {
        return value.toFixed(2) + "x";
    }
    return value;
}

// 把每個廣告活動的原始數字，換算成表格要顯示的所有指標
function buildTableRows(rangeKey) {
    const rangeData = campaignPerformanceData.ranges[rangeKey].data;

    return campaignPerformanceData.campaigns.map((campaign) => {
        const raw = rangeData[campaign.id];

        // 分母是 0 的話（例如當天完全沒有點擊或轉換），指標算不出來，改用 null 表示「無資料」
        return {
            name: campaign.name,
            cost: raw.cost,
            impressions: raw.impressions,
            clicks: raw.clicks,
            reach: raw.reach,
            conversions: raw.conversions,
            ctr: raw.impressions > 0 ? (raw.clicks / raw.impressions) * 100 : null,
            cpc: raw.clicks > 0 ? raw.cost / raw.clicks : null,
            cpm: raw.impressions > 0 ? (raw.cost / raw.impressions) * 1000 : null,
            roas: raw.cost > 0 ? raw.revenue / raw.cost : null,
            cpa: raw.conversions > 0 ? raw.cost / raw.conversions : null,
            cvr: raw.clicks > 0 ? (raw.conversions / raw.clicks) * 100 : null
        };
    });
}

function sortRows(rows, key, direction) {
    return [...rows].sort((a, b) => {
        // 沒資料（null）的列不管升冪降冪都排在最後面，不然切換排序方向時位置會亂跳
        if (a[key] === null && b[key] === null) return 0;
        if (a[key] === null) return 1;
        if (b[key] === null) return -1;

        let comparison;
        if (typeof a[key] === "string") {
            comparison = a[key].localeCompare(b[key], "zh-Hant");
        } else {
            comparison = a[key] - b[key];
        }
        return direction === "desc" ? -comparison : comparison;
    });
}

function renderTableHeader() {
    const headerRow = document.getElementById("performance-table-header");
    headerRow.innerHTML = "";

    TABLE_COLUMNS.forEach((key) => {
        const label = key === "name" ? "廣告活動" : TABLE_METRIC_CONFIG[key].label;
        const isSorted = tableSortState.key === key;
        const arrow = isSorted ? (tableSortState.direction === "asc" ? " ▲" : " ▼") : "";

        const th = document.createElement("th");
        th.className = "px-4 py-2 text-left text-sm font-medium text-slate-600 cursor-pointer select-none whitespace-nowrap hover:bg-slate-50";
        th.textContent = label + arrow;
        th.addEventListener("click", () => {
            // 點同一欄：切換升冪/降冪；點不同欄：換成新欄位，預設先看數字最大的
            if (tableSortState.key === key) {
                tableSortState.direction = tableSortState.direction === "asc" ? "desc" : "asc";
            } else {
                tableSortState.key = key;
                tableSortState.direction = "desc";
            }
            renderTable();
        });
        headerRow.appendChild(th);
    });
}

function renderTableBody(rows) {
    const body = document.getElementById("performance-table-body");
    body.innerHTML = "";

    rows.forEach((row) => {
        const tr = document.createElement("tr");
        tr.className = "border-t border-slate-100 hover:bg-slate-50";
        tr.innerHTML = TABLE_COLUMNS.map((key) => {
            if (key === "name") {
                return `<td class="px-4 py-2 text-sm font-medium whitespace-nowrap">${row.name}</td>`;
            }
            const format = TABLE_METRIC_CONFIG[key].format;
            return `<td class="px-4 py-2 text-sm whitespace-nowrap">${formatTableValue(row[key], format)}</td>`;
        }).join("");
        body.appendChild(tr);
    });
}

// 表格套用跟 KPI 卡片/趨勢圖同一個「時間區間」下拉選單，畫面上只需要一組日期篩選
function renderTable() {
    const range = document.getElementById("rangeSelect").value;
    const rows = buildTableRows(range);
    const sortedRows = sortRows(rows, tableSortState.key, tableSortState.direction);

    renderTableHeader();
    renderTableBody(sortedRows);
}

fetch("../../data/campaign_performance.json")
    .then((response) => response.json())
    .then((data) => {
        campaignPerformanceData = data;
        renderTable();
        document.getElementById("rangeSelect").addEventListener("change", renderTable);
    })
    .catch((error) => console.error("讀取成效表格資料失敗：", error));
