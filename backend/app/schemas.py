"""Pydantic schema：定義每個API回應的資料格式，FastAPI會自動照這個格式檢查、轉成JSON"""

from datetime import date

from pydantic import BaseModel


class CampaignPerformance(BaseModel):
    campaign_id: str
    name: str
    cost: float
    impressions: int
    clicks: int
    conversions: int
    ctr: float | None
    cpc: float | None
    cpm: float | None
    cpa: float | None
    cvr: float | None
    roas: float | None


class PeriodMetrics(BaseModel):
    """整個帳號在某一段期間的加總指標（KPI卡片會用到）"""

    cost: float
    cpa: float | None
    roas: float | None
    cvr: float | None
    ctr: float | None
    is_complete: bool
    """這段期間每一天是不是都有資料。False代表資料庫裡這段期間有缺天數
    （常見於帳號剛開始投放、還沒累積滿選擇的時間長度），漲跌%僅供參考"""


class TrendPoint(BaseModel):
    """成效趨勢圖的其中一天"""

    date: date
    cost: float
    cpa: float | None
    roas: float | None
    cvr: float | None
    ctr: float | None


class PerformanceSummary(BaseModel):
    current: PeriodMetrics
    previous: PeriodMetrics
    trend: list[TrendPoint]


class AlertItem(BaseModel):
    """一筆超標警示：CPA太高或ROAS太低的廣告組合／廣告"""

    name: str
    parent_name: str | None
    metric: str
    value: float
    threshold: float


class AlertsResponse(BaseModel):
    adset_alerts: list[AlertItem]
    creative_alerts: list[AlertItem]


class TopCreativeItem(BaseModel):
    """一筆達成KPI目標的強勢素材"""

    ad_id: str
    name: str
    adset_name: str
    campaign_name: str
    cpa: float
    status: str
