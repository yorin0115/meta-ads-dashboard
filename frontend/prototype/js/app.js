// 每個指標的顯示設定：
// label 是中文名稱、format 決定數字怎麼呈現、better 決定「數字變大還是變小算是變好」
// color 是趨勢圖線條顏色、axis 決定趨勢圖要畫在哪一條 Y 軸（花費之後會有專屬的進度圖，這裡不需要 axis）
const KPI_CONFIG = {
    cost: { label: "花費", format: "currency", better: "down", color: "#1877F2" },
    cpa: { label: "CPA（每次轉換成本）", format: "currency", better: "down", color: "#F59E0B", axis: "yCurrency" },
    roas: { label: "ROAS（廣告投報率）", format: "ratio", better: "up", color: "#10B981", axis: "yRate" },
    cvr: { label: "CVR（轉換率）", format: "percent", better: "up", color: "#8B5CF6", axis: "yRate" },
    ctr: { label: "CTR（點擊率）", format: "percent", better: "up", color: "#EF4444", axis: "yRate" }
};

// 成效趨勢圖不畫花費（花費之後會有專屬的「花費進度圖」功能）
const TREND_CHART_EXCLUDED_METRICS = ["cost"];

let performanceData = null;
let trendChart = null;

function formatValue(value, format) {
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

function formatChange(current, previous, better) {
    const changePercent = ((current - previous) / previous) * 100;
    const sign = changePercent > 0 ? "+" : "";
    const isGood = better === "up" ? changePercent > 0 : changePercent < 0;
    const colorClass = isGood ? "text-emerald-600" : "text-red-500";
    return `<span class="${colorClass} text-sm font-medium">${sign}${changePercent.toFixed(1)}%</span>`;
}

function getCheckedMetrics() {
    const checkboxes = document.querySelectorAll("#kpi-checkboxes input[type=checkbox]");
    return Array.from(checkboxes)
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value);
}

function renderCheckboxes() {
    const container = document.getElementById("kpi-checkboxes");
    container.innerHTML = "";

    Object.keys(KPI_CONFIG).forEach((key) => {
        const label = document.createElement("label");
        label.className = "inline-flex items-center gap-1.5 text-sm cursor-pointer";
        label.innerHTML = `
            <input type="checkbox" value="${key}" class="rounded border-slate-300" checked>
            ${KPI_CONFIG[key].label}
        `;
        container.appendChild(label);
    });

    container.addEventListener("change", renderAll);
}

function renderCards() {
    const range = document.getElementById("rangeSelect").value;
    const rangeData = performanceData.ranges[range];
    const checkedMetrics = getCheckedMetrics();

    const container = document.getElementById("kpi-cards");
    container.innerHTML = "";

    checkedMetrics.forEach((key) => {
        const config = KPI_CONFIG[key];
        const current = rangeData.current[key];
        const previous = rangeData.previous[key];

        const card = document.createElement("div");
        card.className = "kpi-card";
        card.innerHTML = `
            <div class="kpi-label">${config.label}</div>
            <div class="kpi-value">${formatValue(current, config.format)}</div>
            <div class="mt-1">${formatChange(current, previous, config.better)} 較上一期間</div>
        `;
        container.appendChild(card);
    });
}

function renderChart() {
    const range = document.getElementById("rangeSelect").value;
    const rangeData = performanceData.ranges[range];
    const checkedMetrics = getCheckedMetrics()
        .filter((key) => !TREND_CHART_EXCLUDED_METRICS.includes(key));

    const datasets = checkedMetrics.map((key) => {
        const config = KPI_CONFIG[key];
        return {
            label: config.label,
            data: rangeData.trend.series[key],
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

    const ctx = document.getElementById("trendChart");
    trendChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: rangeData.trend.labels,
            datasets: datasets
        },
        options: {
            scales: {
                yCurrency: {
                    type: "linear",
                    position: "left",
                    title: { display: true, text: "CPA（NT$）" }
                },
                yRate: {
                    type: "linear",
                    position: "right",
                    title: { display: true, text: "ROAS / CVR / CTR" },
                    grid: { drawOnChartArea: false }
                }
            },
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

// 算出當月預算相關的所有數字：花費進度、時間進度、理想日花費、燈號
function calcBudgetPacing() {
    const budget = Number(document.getElementById("monthlyBudgetInput").value) || 0;
    const spend = performanceData.budgetPacing.spendMonthToDate;

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

function renderBudgetPacing() {
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

fetch("../../data/performance_summary.json")
    .then((response) => response.json())
    .then((data) => {
        performanceData = data;
        renderCheckboxes();
        renderAll();

        document.getElementById("monthlyBudgetInput").value = data.budgetPacing.monthlyBudgetDefault;
        renderBudgetPacing();

        document.getElementById("rangeSelect").addEventListener("change", renderAll);
        document.getElementById("monthlyBudgetInput").addEventListener("input", renderBudgetPacing);
    })
    .catch((error) => console.error("讀取成效資料失敗：", error));
