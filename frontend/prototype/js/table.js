// 表格欄位設定：label 是欄位標題、format 決定數字怎麼呈現
// cost / impressions / clicks / conversions 是後端API算好的原始加總數字
// ctr、cpc、cpm、roas、cpa、cvr 也都是後端 /api/campaigns/performance 算好直接回傳的，這裡不用重算
const TABLE_METRIC_CONFIG = {
    cost: { label: "Spend", format: "currency" },
    impressions: { label: "Impressions", format: "integer" },
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

let campaignPerformanceRows = null;
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

// 把API回傳的欄位對應成表格要用的列資料（CPA/CPC/CPM/CTR/CVR/ROAS後端都已經算好了，這裡不用重算）
function buildTableRows(campaignRows) {
    return campaignRows.map((row) => ({
        name: row.name,
        cost: row.cost,
        impressions: row.impressions,
        clicks: row.clicks,
        conversions: row.conversions,
        ctr: row.ctr,
        cpc: row.cpc,
        cpm: row.cpm,
        roas: row.roas,
        cpa: row.cpa,
        cvr: row.cvr
    }));
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

// 加總所有廣告活動算出「總計」列
// CTR/CPC/CPM/CPA/CVR/ROAS 不能把每個廣告活動的數字直接加總或平均，要用加總後的原始數字重新計算才正確
function calcTotalsRow(rows) {
    const cost = rows.reduce((sum, row) => sum + row.cost, 0);
    const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
    const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
    const conversions = rows.reduce((sum, row) => sum + row.conversions, 0);

    // 後端沒有直接回傳「營收」欄位，但 roas = 營收 ÷ 花費，
    // 所以反推回去（roas × cost）就能還原每個廣告活動的營收，再加總算出正確的總計ROAS
    const hasRevenue = rows.some((row) => row.roas !== null);
    const revenue = rows.reduce((sum, row) => sum + (row.roas !== null ? row.roas * row.cost : 0), 0);

    return {
        name: "總計",
        cost,
        impressions,
        clicks,
        conversions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
        cpc: clicks > 0 ? cost / clicks : null,
        cpm: impressions > 0 ? (cost / impressions) * 1000 : null,
        roas: hasRevenue && cost > 0 ? revenue / cost : null,
        cpa: conversions > 0 ? cost / conversions : null,
        cvr: clicks > 0 ? (conversions / clicks) * 100 : null
    };
}

function renderTableFooter(totalsRow) {
    const footer = document.getElementById("performance-table-footer");
    footer.innerHTML = "";

    const tr = document.createElement("tr");
    tr.className = "border-t-2 border-slate-300 font-semibold bg-slate-50";
    tr.innerHTML = TABLE_COLUMNS.map((key) => {
        if (key === "name") {
            return `<td class="px-4 py-2 text-sm font-semibold whitespace-nowrap">${totalsRow.name}</td>`;
        }
        const format = TABLE_METRIC_CONFIG[key].format;
        return `<td class="px-4 py-2 text-sm whitespace-nowrap">${formatTableValue(totalsRow[key], format)}</td>`;
    }).join("");
    footer.appendChild(tr);
}

// 只是重新排序、重畫畫面，不會再打一次API——排序是純前端的操作，資料已經在 campaignPerformanceRows 裡了
function renderTable() {
    if (!campaignPerformanceRows) return;

    const sortedRows = sortRows(campaignPerformanceRows, tableSortState.key, tableSortState.direction);
    renderTableHeader();
    renderTableBody(sortedRows);
    renderTableFooter(calcTotalsRow(campaignPerformanceRows));
}

// 表格套用跟 KPI 卡片/趨勢圖同一個「時間區間」下拉選單，畫面上只需要一組日期篩選
// 時間區間改變時才需要重新打API拿資料，排序不用
async function loadAndRenderTable() {
    const range = document.getElementById("rangeSelect").value;
    const { startDate, endDate } = getDateRangeForPreset(range);

    try {
        const campaignRows = await fetchCampaignPerformance(startDate, endDate);
        campaignPerformanceRows = buildTableRows(campaignRows);
        renderTable();
    } catch (error) {
        console.error("讀取成效表格資料失敗：", error);
    }
}

loadAndRenderTable();
document.getElementById("rangeSelect").addEventListener("change", loadAndRenderTable);
