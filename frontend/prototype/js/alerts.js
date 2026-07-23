// 兩個可監控的指標設定：CPA是「超過門檻」算超標，ROAS是「低於門檻」算超標
// 這個判斷邏輯現在在後端（/api/alerts），這裡只負責畫面上數字要怎麼顯示
const ALERT_METRIC_CONFIG = {
    cpa: {
        label: "CPA",
        defaultThreshold: 150,
        formatValue: (value) => `NT$ ${Math.round(value).toLocaleString("zh-TW")}`,
        formatThreshold: (threshold) => `NT$ ${threshold.toLocaleString("zh-TW")}`
    },
    roas: {
        label: "ROAS",
        defaultThreshold: 3.5,
        formatValue: (value) => `${value.toFixed(2)}x`,
        formatThreshold: (threshold) => `${threshold}x`
    }
};

const ALERT_METRIC_STORAGE_KEY = "metaAdsDashboard.alertMetric";
const ALERT_THRESHOLD_STORAGE_KEY_PREFIX = "metaAdsDashboard.alertThreshold.";

// 每頁最多顯示幾筆警示；超過的部分要靠分頁按鈕切換
const ALERTS_PAGE_SIZE = 5;

// 活動群組跟素材共用同一個頁碼，只需要一組分頁控制
let alertsCurrentPage = 1;

async function fetchAlerts(startDate, endDate, metric, threshold) {
    const url = `${API_BASE_URL}/alerts?start_date=${startDate}&end_date=${endDate}&metric=${metric}&threshold=${threshold}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`API回應錯誤：${response.status}`);
    }
    return response.json();
}

// 把API回傳的一筆警示（name/parent_name/metric/value/threshold），組成畫面要顯示的文字說明
function toAlertViewModel(item) {
    const config = ALERT_METRIC_CONFIG[item.metric];
    return {
        name: item.name,
        parentName: item.parent_name,
        reason: `${config.label} ${config.formatValue(item.value)}`
    };
}

// 把警示清單畫進指定的容器，summaryElementId 顯示「共 N 個」，listElementId 顯示每一筆的名稱與超標原因
// 兩份清單都用 alertsCurrentPage 這個共用頁碼去切分頁面
function renderAlertList(alerts, { summaryElementId, listElementId, emptyText }) {
    document.getElementById(summaryElementId).textContent =
        alerts.length > 0 ? `共 ${alerts.length} 個` : "目前沒有超標項目";

    const container = document.getElementById(listElementId);
    container.innerHTML = "";

    if (alerts.length === 0) {
        container.innerHTML = `<div class="text-sm text-[#0BD99F] py-2">✅ ${emptyText}</div>`;
        return;
    }

    const startIndex = (alertsCurrentPage - 1) * ALERTS_PAGE_SIZE;
    const pageAlerts = alerts.slice(startIndex, startIndex + ALERTS_PAGE_SIZE);

    if (pageAlerts.length === 0) {
        container.innerHTML = `<div class="text-sm text-slate-500 py-2">本頁沒有項目。</div>`;
        return;
    }

    pageAlerts.forEach((alert) => {
        const parentText = alert.parentName ? `所屬：${alert.parentName}` : "";

        const row = document.createElement("div");
        row.className = "py-2 px-3 mb-2 last:mb-0 border-l-4 border-[#FFEA7A] bg-[#F2F2F2] rounded-r-md";
        row.innerHTML = `
            <div class="text-sm font-medium text-[#2B2B2B]">${alert.name}</div>
            <div class="text-xs text-slate-500">${parentText}</div>
            <div class="text-xs font-medium text-[#FC9626] mt-1">⚠ ${alert.reason}</div>
        `;
        container.appendChild(row);
    });
}

// 頁數以兩份清單中較長的那份為準，這樣任一份清單還有下一頁時都能繼續切換
function renderAlertPagination(totalPages) {
    const container = document.getElementById("alert-pagination");
    container.innerHTML = "";
    container.className = "flex items-center justify-end gap-2 mt-4";

    if (totalPages <= 1) return;

    const buttonClass = "text-xs px-2 py-1 border border-slate-300 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50";

    const prevButton = document.createElement("button");
    prevButton.textContent = "上一頁";
    prevButton.className = buttonClass;
    prevButton.disabled = alertsCurrentPage === 1;
    prevButton.addEventListener("click", () => {
        alertsCurrentPage -= 1;
        renderAlerts();
    });

    const pageText = document.createElement("div");
    pageText.className = "text-xs text-slate-500";
    pageText.textContent = `第 ${alertsCurrentPage} / ${totalPages} 頁`;

    const nextButton = document.createElement("button");
    nextButton.textContent = "下一頁";
    nextButton.className = buttonClass;
    nextButton.disabled = alertsCurrentPage === totalPages;
    nextButton.addEventListener("click", () => {
        alertsCurrentPage += 1;
        renderAlerts();
    });

    container.appendChild(prevButton);
    container.appendChild(pageText);
    container.appendChild(nextButton);
}

// 讀取目前下拉選單選了哪個指標、輸入框填了多少門檻值
function getAlertSettings() {
    const metric = document.getElementById("alertMetricSelect").value;
    const threshold = Number(document.getElementById("alertThresholdInput").value);
    return { metric, threshold };
}

// 活動群組跟素材都統一看「過去7天」，跟KPI卡片選的時間區間無關
async function renderAlerts() {
    const settings = getAlertSettings();
    localStorage.setItem(ALERT_METRIC_STORAGE_KEY, settings.metric);
    localStorage.setItem(ALERT_THRESHOLD_STORAGE_KEY_PREFIX + settings.metric, settings.threshold);

    document.getElementById("alertThresholdUnitText").textContent =
        settings.metric === "cpa" ? "元" : "倍";

    if (Number.isNaN(settings.threshold)) return;

    const { startDate, endDate } = getDateRangeForPreset("7d");

    try {
        const data = await fetchAlerts(startDate, endDate, settings.metric, settings.threshold);
        const adsetAlerts = data.adset_alerts.map(toAlertViewModel);
        const creativeAlerts = data.creative_alerts.map(toAlertViewModel);

        const totalPages = Math.max(
            Math.ceil(adsetAlerts.length / ALERTS_PAGE_SIZE),
            Math.ceil(creativeAlerts.length / ALERTS_PAGE_SIZE),
            1
        );
        // 如果篩選條件改變導致總頁數變少，目前頁碼可能超出範圍，要拉回最後一頁
        if (alertsCurrentPage > totalPages) {
            alertsCurrentPage = totalPages;
        }

        renderAlertList(adsetAlerts, {
            summaryElementId: "adsetAlertSummaryText",
            listElementId: "adset-alert-list",
            emptyText: "所有活動群組過去7天成效都在正常範圍內。"
        });

        renderAlertList(creativeAlerts, {
            summaryElementId: "creativeAlertSummaryText",
            listElementId: "creative-alert-list",
            emptyText: "所有素材過去7天成效都在正常範圍內。"
        });

        renderAlertPagination(totalPages);
    } catch (error) {
        console.error("讀取成效警示資料失敗：", error);
    }
}

// 切換指標時，把輸入框換成該指標上次儲存的門檻值（沒儲存過就用預設值），而不是沿用另一個指標的數字
function loadThresholdInputForMetric(metric) {
    const saved = localStorage.getItem(ALERT_THRESHOLD_STORAGE_KEY_PREFIX + metric);
    document.getElementById("alertThresholdInput").value =
        saved !== null ? saved : ALERT_METRIC_CONFIG[metric].defaultThreshold;
}

const savedAlertMetric = localStorage.getItem(ALERT_METRIC_STORAGE_KEY) || "cpa";
document.getElementById("alertMetricSelect").value = savedAlertMetric;
loadThresholdInputForMetric(savedAlertMetric);
renderAlerts();

document.getElementById("alertMetricSelect").addEventListener("change", (event) => {
    loadThresholdInputForMetric(event.target.value);
    alertsCurrentPage = 1;
    renderAlerts();
});
document.getElementById("alertThresholdInput").addEventListener("input", () => {
    alertsCurrentPage = 1;
    renderAlerts();
});
