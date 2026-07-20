// 每個指標的顯示設定：
// label 是中文名稱、format 決定數字怎麼呈現、better 決定「數字變大還是變小算是變好」
const KPI_CONFIG = {
    cost: { label: "花費", format: "currency", better: "down" },
    cpa: { label: "CPA（每次轉換成本）", format: "currency", better: "down" },
    roas: { label: "ROAS（廣告投報率）", format: "ratio", better: "up" },
    cvr: { label: "CVR（轉換率）", format: "percent", better: "up" },
    ctr: { label: "CTR（點擊率）", format: "percent", better: "up" }
};

let performanceData = null;

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

    container.addEventListener("change", renderCards);
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

fetch("../../data/performance_summary.json")
    .then((response) => response.json())
    .then((data) => {
        performanceData = data;
        renderCheckboxes();
        renderCards();
        document.getElementById("rangeSelect").addEventListener("change", renderCards);
    })
    .catch((error) => console.error("讀取成效資料失敗：", error));
