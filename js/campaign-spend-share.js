// 廣告活動花費佔比：用甜甜圈圖顯示各廣告活動的花費佔比
// 只顯示花費前5名的廣告活動，其餘全部加總算成「其他」，避免圖表被切得太零碎
// 資料來源是後端 API（/api/campaigns/performance），不是本機的 mock JSON

// 前5名依序使用這5個顏色，「其他」固定用灰色（跟花費排名無關，一定是最後一色）
const SPEND_SHARE_COLORS = ["#3A65ED", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444"];
const SPEND_SHARE_OTHER_COLOR = "#9CA3AF";
const SPEND_SHARE_TOP_N = 5;

let spendShareChart = null;

// 取得（或第一次建立）浮動提示框，附加在 <body> 上，不受圖表窄容器限制
function getSpendShareTooltipEl() {
    let tooltipEl = document.getElementById("spend-share-tooltip");
    if (!tooltipEl) {
        tooltipEl = document.createElement("div");
        tooltipEl.id = "spend-share-tooltip";
        tooltipEl.className = "chart-tooltip";
        document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
}

// 自訂 tooltip：Chart.js 預設會把提示框畫在 canvas 裡面，
// 但這裡的甜甜圈圖被限制在 180px 窄欄位中，文字較長時會被切掉，
// 所以改成獨立的 HTML 方框，跟著滑鼠位置浮動顯示，並確保不會超出視窗邊界
function externalSpendShareTooltip(context) {
    const tooltipEl = getSpendShareTooltipEl();
    const tooltipModel = context.tooltip;

    if (tooltipModel.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
    }

    const dataPoint = tooltipModel.dataPoints && tooltipModel.dataPoints[0];
    if (dataPoint) {
        const item = context.chart.$spendShareSlices[dataPoint.dataIndex];
        tooltipEl.innerHTML = `${item.name}：NT$ ${Math.round(item.cost).toLocaleString("zh-TW")}（${item.percent.toFixed(1)}%）`;
    }

    const canvasRect = context.chart.canvas.getBoundingClientRect();
    let left = canvasRect.left + tooltipModel.caretX + 12;
    let top = canvasRect.top + tooltipModel.caretY - tooltipEl.offsetHeight / 2;

    // 如果超出視窗右邊，改成顯示在滑鼠左側，避免被畫面邊界切掉
    if (left + tooltipEl.offsetWidth > window.innerWidth) {
        left = canvasRect.left + tooltipModel.caretX - tooltipEl.offsetWidth - 12;
    }

    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.opacity = 1;
}

// 把每個廣告活動的花費，由高到低排序，超過前5名的部分合併成「其他」
function buildSpendShareSlices(campaignRows) {
    const costsByCampaign = campaignRows
        .map((row) => ({ name: row.name, cost: row.cost }))
        .sort((a, b) => b.cost - a.cost);

    const topSlices = costsByCampaign.slice(0, SPEND_SHARE_TOP_N);
    const restSlices = costsByCampaign.slice(SPEND_SHARE_TOP_N);

    if (restSlices.length > 0) {
        const otherCost = restSlices.reduce((sum, item) => sum + item.cost, 0);
        topSlices.push({ name: "其他", cost: otherCost, isOther: true });
    }

    const totalCost = topSlices.reduce((sum, item) => sum + item.cost, 0);
    return topSlices.map((item, index) => ({
        name: item.name,
        cost: item.cost,
        percent: totalCost > 0 ? (item.cost / totalCost) * 100 : 0,
        color: item.isOther ? SPEND_SHARE_OTHER_COLOR : SPEND_SHARE_COLORS[index]
    }));
}

function renderSpendShareChart(slices) {
    if (spendShareChart) {
        spendShareChart.destroy();
    }

    const ctx = document.getElementById("spendShareChart");
    spendShareChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: slices.map((item) => item.name),
            datasets: [{
                data: slices.map((item) => item.cost),
                backgroundColor: slices.map((item) => item.color),
                borderWidth: 2,
                borderColor: "#ffffff"
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: externalSpendShareTooltip
                }
            }
        }
    });

    // 提供給 externalSpendShareTooltip 用，才能在提示框裡顯示活動名稱、花費、佔比
    spendShareChart.$spendShareSlices = slices;
}

function renderSpendShareLegend(slices) {
    const container = document.getElementById("spend-share-legend");
    container.innerHTML = "";

    slices.forEach((item) => {
        const row = document.createElement("div");
        row.className = "flex items-center gap-2 text-sm";
        row.innerHTML = `
            <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${item.color}"></span>
            <span class="truncate">${item.name}</span>
            <span class="font-medium text-[#2B2B2B]">${item.percent.toFixed(1)}%</span>
        `;
        container.appendChild(row);
    });
}

async function renderSpendShare() {
    const range = document.getElementById("rangeSelect").value;
    const { startDate, endDate } = getDateRangeForPreset(range);

    try {
        const campaignRows = await fetchCampaignPerformance(startDate, endDate);
        const slices = buildSpendShareSlices(campaignRows);
        renderSpendShareChart(slices);
        renderSpendShareLegend(slices);
    } catch (error) {
        console.error("讀取廣告活動花費佔比資料失敗：", error);
    }
}

renderSpendShare();
document.getElementById("rangeSelect").addEventListener("change", renderSpendShare);
