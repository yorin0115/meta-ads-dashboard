// 後端API的位置。之後如果換到別的地方跑（例如部署到伺服器上），只要改這一個地方就好
const API_BASE_URL = "http://127.0.0.1:8000";

// 把某個日期往前/往後推 N 天
function addDays(dateObj, days) {
    const result = new Date(dateObj);
    result.setDate(result.getDate() + days);
    return result;
}

// 注意：不能用 dateObj.toISOString()，那個會先轉換成UTC時間，
// 在台灣（UTC+8）以外的時區，日期可能會因此差了一天
function formatDateAsISO(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// 把畫面上「時間區間」下拉選單選的值（過去1/7/30天、當月），換算成打API要用的實際日期區間。
// 資料只算到「昨天」為止（跟 app.js 裡當月預算計算的規則一致：今天的花費還沒完整，不列入計算）
function getDateRangeForPreset(rangeKey) {
    const today = new Date();
    const yesterday = addDays(today, -1);

    if (rangeKey === "1d") {
        return { startDate: formatDateAsISO(yesterday), endDate: formatDateAsISO(yesterday) };
    }
    if (rangeKey === "7d") {
        return { startDate: formatDateAsISO(addDays(yesterday, -6)), endDate: formatDateAsISO(yesterday) };
    }
    if (rangeKey === "30d") {
        return { startDate: formatDateAsISO(addDays(yesterday, -29)), endDate: formatDateAsISO(yesterday) };
    }

    // month：當月1號到昨天
    // 注意：每個月1號當天，「昨天」是上個月的最後一天，會比「當月1號」還早，
    // 這樣結束日期就會變得比開始日期早，區間反過來、打API會查不到資料。
    // 這種情況下，代表這個月還沒有任何一整天的資料可以看，結束日期就用當月1號頂著。
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEndDate = yesterday < firstDayOfMonth ? firstDayOfMonth : yesterday;
    return { startDate: formatDateAsISO(firstDayOfMonth), endDate: formatDateAsISO(monthEndDate) };
}

// 依行銷活動列出指定日期區間的成效（花費、曝光、點擊...等，CPA/CPC/CPM/CTR/CVR/ROAS後端已經算好）
// 花費佔比圖表（campaign-spend-share.js）跟成效表格（table.js）都會用到這個
async function fetchCampaignPerformance(startDate, endDate) {
    const url = `${API_BASE_URL}/api/campaigns/performance?start_date=${startDate}&end_date=${endDate}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`API回應錯誤：${response.status}`);
    }
    return response.json();
}
