// 每個指標的顯示設定：
// label 是中文名稱、format 決定數字怎麼呈現、better 決定「數字變大還是變小算是變好」
// color 是趨勢圖線條顏色、axis 決定趨勢圖要畫在哪一條 Y 軸（花費之後會有專屬的進度圖，這裡不需要 axis）
const KPI_CONFIG = {
    cost: { label: "花費", format: "currency", better: "down", color: "#3A65ED" },
    cpa: { label: "CPA (每次轉換成本)", format: "currency", better: "down", color: "#F59E0B", axis: "yCurrency" },
    roas: { label: "ROAS (廣告投報率)", format: "ratio", better: "up", color: "#10B981", axis: "yRate" },
    cvr: { label: "CVR (轉換率)", format: "percent", better: "up", color: "#8B5CF6", axis: "yRate" },
    ctr: { label: "CTR (點擊率)", format: "percent", better: "up", color: "#EF4444", axis: "yRate" }
};

// 成效趨勢圖不畫花費（花費之後會有專屬的「花費進度圖」功能）
const TREND_METRICS = Object.keys(KPI_CONFIG).filter((key) => key !== "cost");

// currentSummary 是 /api/performance/summary 的回應：{ current, previous, trend }
// 跟著 rangeSelect 變動；月預算用的「當月至今花費」是另一個獨立的數字，不受 rangeSelect 影響，見 spendMonthToDate
let currentSummary = null;
let spendMonthToDate = 0;
let trendChart = null;

// ROAS目前沒有營收資料來源，後端一律回傳null，這裡統一顯示成"–"
function formatValue(value, format) {
    if (value === null) {
        return "–";
    }
    if (format === "currency") {
        return "NT$ " + Math.round(value).toLocaleString("zh-TW");
    }
    if (format === "percent") {
        return value.toFixed(2) + "%";
    }
    if (format === "ratio") {
        return value.toFixed(1) + "x";
    }
    return value;
}

// current/previous任何一個算不出來（null）、或上一期間完全沒有花費資料（0），都沒辦法算漲跌%
function formatChange(current, previous, better) {
    if (current === null || previous === null || previous === 0) {
        return `<span class="text-slate-400 text-sm font-medium">–</span>`;
    }

    const changePercent = ((current - previous) / previous) * 100;
    const sign = changePercent > 0 ? "+" : "";
    const isGood = better === "up" ? changePercent > 0 : changePercent < 0;
    const colorClass = isGood ? "text-emerald-600" : "text-red-500";
    return `<span class="${colorClass} text-sm font-medium">${sign}${changePercent.toFixed(1)}%</span>`;
}

// current或previous只要有一邊資料天數不足選擇的時間長度（例如帳號才剛開始投放，還沒累積滿30天），
// 漲跌%會被資料缺天數扭曲、失去意義，這種情況顯示警示文字取代漲跌%
function formatChangeOrWarning(current, previous, better, isPeriodComplete) {
    if (!isPeriodComplete) {
        return `<span class="text-amber-500 text-sm font-medium" title="所選期間或上一期間的資料天數不足，漲跌幅暫不提供">⚠ 資料時間區間不足</span>`;
    }
    return formatChange(current, previous, better);
}

function getCheckedMetrics(containerId) {
    const checkboxes = document.querySelectorAll(`#${containerId} input[type=checkbox]`);
    return Array.from(checkboxes)
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value);
}

// 產生一組指標勾選框，metricKeys 決定要出現哪些指標、onChange 決定勾選變動時要重畫什麼
function renderCheckboxGroup(containerId, metricKeys, onChange) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    metricKeys.forEach((key) => {
        const label = document.createElement("label");
        label.className = "inline-flex items-center gap-1.5 text-sm cursor-pointer";
        label.innerHTML = `
            <input type="checkbox" value="${key}" class="rounded border-slate-300" checked>
            ${KPI_CONFIG[key].label}
        `;
        container.appendChild(label);
    });

    container.addEventListener("change", onChange);
}

// 純畫面重畫，不會打API——資料已經在 currentSummary 裡了，勾選指標只是決定要顯示哪幾張卡片
function renderCards() {
    const checkedMetrics = getCheckedMetrics("kpi-checkboxes");

    const container = document.getElementById("kpi-cards");
    container.innerHTML = "";

    const isPeriodComplete = currentSummary.current.is_complete && currentSummary.previous.is_complete;

    checkedMetrics.forEach((key) => {
        const config = KPI_CONFIG[key];
        const current = currentSummary.current[key];
        const previous = currentSummary.previous[key];

        const card = document.createElement("div");
        card.className = "kpi-card";
        card.innerHTML = `
            <div class="kpi-label">${config.label}</div>
            <div class="kpi-value">${formatValue(current, config.format)}</div>
            <div class="mt-1">${formatChangeOrWarning(current, previous, config.better, isPeriodComplete)} 較上一期間</div>
        `;
        container.appendChild(card);
    });
}

// 純畫面重畫，不會打API，道理跟 renderCards 一樣
function renderChart() {
    const checkedMetrics = getCheckedMetrics("trend-checkboxes");
    const trend = currentSummary.trend;

    const datasets = checkedMetrics.map((key) => {
        const config = KPI_CONFIG[key];
        return {
            label: config.label,
            data: trend.map((point) => point[key]),
            format: config.format,
            borderColor: config.color,
            backgroundColor: config.color,
            yAxisID: config.axis,
            tension: 0.3,
            pointRadius: 2
        };
    });

    // 每次都整個重畫一次圖表，邏輯比較單純好懂
    if (trendChart) {
        trendChart.destroy();
    }

    // 沒有指標用到的軸就不畫出來，不然會出現一條 0~1 的空白刻度
    const usedAxes = new Set(checkedMetrics.map((key) => KPI_CONFIG[key].axis));
    const scales = {};
    // 左右兩軸的刻度數量要一樣，格線才會左右對齊（不然兩邊各自算刻度，數字會對不齊）
    if (usedAxes.has("yCurrency")) {
        scales.yCurrency = {
            type: "linear",
            position: "left",
            title: { display: true, text: "CPA（NT$）" },
            ticks: { count: 5 }
        };
    }
    if (usedAxes.has("yRate")) {
        scales.yRate = {
            type: "linear",
            position: "right",
            title: { display: true, text: "ROAS / CVR / CTR" },
            grid: { drawOnChartArea: false },
            ticks: { count: 5 }
        };
    }

    const ctx = document.getElementById("trendChart");
    trendChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: trend.map((point) => point.date),
            datasets: datasets
        },
        options: {
            scales: scales,
            plugins: {
                tooltip: {
                    callbacks: {
                        // 滑鼠移到點上時，用該指標對應的格式顯示數字（金額 / 百分比 / 倍數）
                        label: (context) => {
                            const dataset = context.dataset;
                            return dataset.label + "：" + formatValue(context.parsed.y, dataset.format);
                        }
                    }
                }
            }
        }
    });
}

function renderAll() {
    renderCards();
    renderChart();
}

async function fetchPerformanceSummary(startDate, endDate) {
    const url = `${API_BASE_URL}/api/performance/summary?start_date=${startDate}&end_date=${endDate}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`API回應錯誤：${response.status}`);
    }
    return response.json();
}

// 時間區間改變時才需要重新打API——KPI卡片跟趨勢圖都是同一份 currentSummary，一起重新抓、一起重畫
async function loadAndRenderAll() {
    const range = document.getElementById("rangeSelect").value;
    const { startDate, endDate } = getDateRangeForPreset(range);

    try {
        currentSummary = await fetchPerformanceSummary(startDate, endDate);
        renderAll();
    } catch (error) {
        console.error("讀取成效摘要資料失敗：", error);
    }
}

// 算出當月預算相關的所有數字：花費進度、時間進度、理想日花費、燈號
function calcBudgetPacing() {
    const budget = Number(document.getElementById("monthlyBudgetInput").value) || 0;
    const spend = spendMonthToDate;

    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysElapsed = today.getDate() - 1; // 花費資料只算到「昨天」為止
    const daysRemaining = daysInMonth - daysElapsed;

    const spendProgressPercent = budget > 0 ? (spend / budget) * 100 : 0;
    const timeProgressPercent = (daysElapsed / daysInMonth) * 100;
    const diff = spendProgressPercent - timeProgressPercent;
    const idealDailySpend = (budget - spend) / daysRemaining;

    return { budget, spend, daysRemaining, spendProgressPercent, diff, idealDailySpend };
}

const MONTHLY_BUDGET_STORAGE_KEY = "metaAdsDashboard.monthlyBudget";
const DEFAULT_MONTHLY_BUDGET = 150000; // 使用者還沒自己輸入過金額時，先顯示這個預設值

function renderBudgetPacing() {
    localStorage.setItem(MONTHLY_BUDGET_STORAGE_KEY, document.getElementById("monthlyBudgetInput").value);

    const result = calcBudgetPacing();

    document.getElementById("budgetProgressText").textContent =
        `花費進度 ${result.spendProgressPercent.toFixed(1)}%（NT$ ${Math.round(result.spend).toLocaleString("zh-TW")} / NT$ ${Math.round(result.budget).toLocaleString("zh-TW")}）`;

    let statusColor, statusLabel;
    const absDiff = Math.abs(result.diff);
    if (absDiff <= 5) {
        statusColor = "bg-emerald-500";
        statusLabel = "綠燈：花費進度正常";
    } else if (absDiff <= 10) {
        statusColor = "bg-amber-500";
        statusLabel = result.diff > 0 ? "黃燈：花費稍快" : "黃燈：花費稍慢";
    } else {
        statusColor = "bg-red-500";
        statusLabel = result.diff > 0 ? "紅燈：花費過快" : "紅燈：花費過慢";
    }

    const progressBarWidth = Math.min(result.spendProgressPercent, 100);
    document.getElementById("budgetProgressBar").className = "h-2 rounded-full " + statusColor;
    document.getElementById("budgetProgressBar").style.width = progressBarWidth + "%";
    document.getElementById("budgetStatusLight").className = "w-4 h-4 rounded-full flex-shrink-0 " + statusColor;
    document.getElementById("budgetStatusText").textContent = statusLabel;
    document.getElementById("idealDailySpendText").textContent =
        `剩餘 ${result.daysRemaining} 天，建議每天花費 NT$ ${Math.round(result.idealDailySpend).toLocaleString("zh-TW")}`;
}

// 當月預算卡片的「花費進度」，不管KPI卡片那邊選了哪個時間區間，永遠都是看「當月至今」
async function loadMonthToDateSpend() {
    const { startDate, endDate } = getDateRangeForPreset("month");
    const summary = await fetchPerformanceSummary(startDate, endDate);
    return summary.current.cost;
}

async function init() {
    try {
        const range = document.getElementById("rangeSelect").value;
        const { startDate, endDate } = getDateRangeForPreset(range);

        const [summary, monthToDateSpend] = await Promise.all([
            fetchPerformanceSummary(startDate, endDate),
            loadMonthToDateSpend()
        ]);

        currentSummary = summary;
        spendMonthToDate = monthToDateSpend;

        renderCheckboxGroup("kpi-checkboxes", Object.keys(KPI_CONFIG), renderCards);
        renderCheckboxGroup("trend-checkboxes", TREND_METRICS, renderChart);
        renderAll();

        const savedBudget = localStorage.getItem(MONTHLY_BUDGET_STORAGE_KEY);
        document.getElementById("monthlyBudgetInput").value = savedBudget !== null ? savedBudget : DEFAULT_MONTHLY_BUDGET;
        renderBudgetPacing();

        document.getElementById("rangeSelect").addEventListener("change", loadAndRenderAll);
        document.getElementById("monthlyBudgetInput").addEventListener("input", renderBudgetPacing);
    } catch (error) {
        console.error("讀取成效資料失敗：", error);
    }
}

init();
