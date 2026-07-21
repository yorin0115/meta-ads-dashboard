"""這裡的每個函式都是「用原始數字算出衍生指標」的公式。

daily_performance 只存原始數字（cost、conversions、clicks、impressions、reach），
不會把 CPA/CPC/CPM/CTR/CVR/ROAS 這些算出來的數字存進資料庫，
每次要用的時候才用這裡的公式現算——這樣資料只有一份，不會有「存的數字」跟「算出來的數字」對不上的風險。

分母是 0（或缺資料）時回傳 None，代表「無法計算」，交給呼叫端決定怎麼顯示
（跟現在 frontend/prototype/js/table.js 用 null 顯示成 "–" 的邏輯一致）。
"""


def calc_cpa(cost: float, conversions: int) -> float | None:
    """CPA（每次購買成本） = 花費 ÷ 轉換數"""
    return cost / conversions if conversions > 0 else None


def calc_cpc(cost: float, clicks: int) -> float | None:
    """CPC（單次點擊成本） = 花費 ÷ 點擊數"""
    return cost / clicks if clicks > 0 else None


def calc_cpm(cost: float, impressions: int) -> float | None:
    """CPM（每千次廣告曝光成本） = 花費 ÷ 曝光數 × 1000"""
    return cost / impressions * 1000 if impressions > 0 else None


def calc_ctr(clicks: int, impressions: int) -> float | None:
    """CTR（連結點閱率，%） = 點擊數 ÷ 曝光數 × 100"""
    return clicks / impressions * 100 if impressions > 0 else None


def calc_cvr(conversions: int, clicks: int) -> float | None:
    """CVR（轉換率，%） = 轉換數 ÷ 點擊數 × 100"""
    return conversions / clicks * 100 if clicks > 0 else None


def calc_roas(revenue: float | None, cost: float) -> float | None:
    """ROAS（廣告投資報酬率） = 營收 ÷ 花費

    daily_performance 目前沒有營收欄位（見 models.py 裡的說明），
    這裡先把公式定義好，等營收資料來源確定、資料庫補上欄位後，
    直接把 revenue 傳進來就會自動算出來，不用改這個函式。
    """
    if revenue is None or cost <= 0:
        return None
    return revenue / cost
