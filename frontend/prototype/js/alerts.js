// 兩個可監控的指標設定：
// direction 決定「超標」的方向 -- CPA 是「超過門檻」算超標，ROAS 是「低於門檻」算超標
// formatValue / formatThreshold 決定畫面上的數字要怎麼顯示
const ALERT_METRIC_CONFIG = {
    cpa: {
        label: "CPA",
        defaultThreshold: 150,
        direction: "high",
        formatValue: (value) => `NT$ ${Math.round(value).toLocaleString("zh-TW")}`,
        formatThreshold: (threshold) => `NT$ ${threshold.toLocaleString("zh-TW")}`
    },
    roas: {
        label: "ROAS",
        defaultThreshold: 3.5,
        direction: "low",
        formatValue: (value) => `${value.toFixed(2)}x`,
        formatThreshold: (threshold) => `${threshold}x`
    }
};

const ALERT_METRIC_STORAGE_KEY = "metaAdsDashboard.alertMetric";
const ALERT_THRESHOLD_STORAGE_KEY_PREFIX = "metaAdsDashboard.alertThreshold.";

// 把多天的原始數字加總，才能算出「這段期間」的 CPA / ROAS
// （CPA / ROAS 不能用每天的數字直接平均，要先加總花費/轉換/營收再相除）
function aggregateDaily(dailyEntries) {
    const totals = dailyEntries.reduce((acc, day) => {
        acc.cost += day.cost;
        acc.conversions += day.conversions;
        acc.revenue += day.revenue;
        return acc;
    }, { cost: 0, conversions: 0, revenue: 0 });

    return {
        cpa: totals.conversions > 0 ? totals.cost / totals.conversions : null,
        roas: totals.cost > 0 ? totals.revenue / totals.cost : null
    };
}

// 只看使用者選定的那個指標（CPA 或 ROAS 二擇一），沒超標回傳 null
function findExceededReason(metrics, settings) {
    const config = ALERT_METRIC_CONFIG[settings.metric];
    const value = metrics[settings.metric];
    if (value === null || Number.isNaN(settings.threshold)) return null;

    const isExceeded = config.direction === "high" ? value > settings.threshold : value < settings.threshold;
    if (!isExceeded) return null;

    return `${config.label} ${config.formatValue(value)}（門檻 ${config.formatThreshold(settings.threshold)}）`;
}

// 素材的每日資料現在存了過去30天，這裡只取最後7筆（最近7天），警示才不會被30天平均掉
const ALERTS_LOOKBACK_DAYS = 7;
function lastNDays(dailyEntries, n) {
    return dailyEntries.slice(-n);
}

// 活動群組跟素材都統一看「過去7天」的加總數字
function buildAdsetAlerts(data, settings) {
    const campaignById = new Map(data.campaigns.map((campaign) => [campaign.id, campaign]));

    return data.adsets
        .map((adset) => {
            const recentDays = lastNDays(data.dailyData.adsets[adset.id], ALERTS_LOOKBACK_DAYS);
            const reason = findExceededReason(aggregateDaily(recentDays), settings);
            if (!reason) return null;

            const parentCampaign = campaignById.get(adset.campaignId);
            return { name: adset.name, parentName: parentCampaign ? parentCampaign.name : null, reason };
        })
        .filter((alert) => alert !== null);
}

function buildCreativeAlerts(data, settings) {
    const adsetById = new Map(data.adsets.map((adset) => [adset.id, adset]));

    return data.creatives
        .map((creative) => {
            const recentDays = lastNDays(data.dailyData.creatives[creative.id], ALERTS_LOOKBACK_DAYS);
            const reason = findExceededReason(aggregateDaily(recentDays), settings);
            if (!reason) return null;

            const parentAdset = adsetById.get(creative.adsetId);
            return { name: creative.name, parentName: parentAdset ? parentAdset.name : null, reason };
        })
        .filter((alert) => alert !== null);
}

// 每頁最多顯示幾筆警示；超過的部分要靠分頁按鈕切換
const ALERTS_PAGE_SIZE = 5;

// 活動群組跟素材共用同一個頁碼，只需要一組分頁控制
let alertsCurrentPage = 1;

// 把警示清單畫進指定的容器，summaryElementId 顯示「共 N 個」，listElementId 顯示每一筆的名稱與超標原因
// 兩份清單都用 alertsCurrentPage 這個共用頁碼去切分頁面
function renderAlertList(alerts, { summaryElementId, listElementId, emptyText }) {
    document.getElementById(summaryElementId).textContent =
        alerts.length > 0 ? `共 ${alerts.length} 個` : "目前沒有超標項目";

    const container = document.getElementById(listElementId);
    container.innerHTML = "";

    if (alerts.length === 0) {
        container.innerHTML = `<div class="text-sm text-slate-500 py-2">${emptyText}</div>`;
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
        row.className = "py-2 border-t border-slate-100 first:border-t-0";
        row.innerHTML = `
            <div class="text-sm font-medium">${alert.name}</div>
            <div class="text-xs text-slate-500">${parentText}</div>
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

let creativePerformanceData = null;

function renderAlerts() {
    if (!creativePerformanceData) return;

    const settings = getAlertSettings();
    localStorage.setItem(ALERT_METRIC_STORAGE_KEY, settings.metric);
    localStorage.setItem(ALERT_THRESHOLD_STORAGE_KEY_PREFIX + settings.metric, settings.threshold);

    document.getElementById("alertThresholdUnitText").textContent =
        settings.metric === "cpa" ? "元" : "倍";

    const adsetAlerts = buildAdsetAlerts(creativePerformanceData, settings);
    const creativeAlerts = buildCreativeAlerts(creativePerformanceData, settings);

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
}

// 切換指標時，把輸入框換成該指標上次儲存的門檻值（沒儲存過就用預設值），而不是沿用另一個指標的數字
function loadThresholdInputForMetric(metric) {
    const saved = localStorage.getItem(ALERT_THRESHOLD_STORAGE_KEY_PREFIX + metric);
    document.getElementById("alertThresholdInput").value =
        saved !== null ? saved : ALERT_METRIC_CONFIG[metric].defaultThreshold;
}

fetch("../../data/creative_performance.json")
    .then((response) => response.json())
    .then((data) => {
        creativePerformanceData = data;

        const savedMetric = localStorage.getItem(ALERT_METRIC_STORAGE_KEY) || "cpa";
        document.getElementById("alertMetricSelect").value = savedMetric;
        loadThresholdInputForMetric(savedMetric);
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
    })
    .catch((error) => console.error("讀取成效警示資料失敗：", error));
