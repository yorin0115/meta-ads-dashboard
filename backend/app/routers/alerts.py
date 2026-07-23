from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import metrics
from ..database import get_db
from ..dependencies import validate_date_range
from ..models import Ad, AdSet, Campaign, DailyPerformance
from ..schemas import AlertItem, AlertsResponse

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


def _is_exceeded(metric: str, value: float | None, threshold: float) -> bool:
    """value是None代表算不出來（例如沒有轉換、或沒有營收資料），一律當作沒有超標"""
    if value is None:
        return False
    if metric == "cpa":
        return value > threshold
    return value < threshold  # roas


def _calc_alert_metric(metric: str, row) -> float | None:
    if metric == "cpa":
        return metrics.calc_cpa(float(row.cost), row.conversions)
    revenue = float(row.revenue) if row.revenue is not None else None
    return metrics.calc_roas(revenue, float(row.cost))


@router.get("", response_model=AlertsResponse)
def get_alerts(
    date_range: tuple[date, date] = Depends(validate_date_range),
    metric: str = Query(pattern="^(cpa|roas)$"),
    threshold: float = Query(...),
    db: Session = Depends(get_db),
):
    """找出這段期間CPA超過門檻（或ROAS低於門檻）的廣告組合跟廣告

    對應前端 frontend/prototype/js/alerts.js。
    """
    start_date, end_date = date_range
    adset_rows = (
        db.query(
            AdSet.name,
            Campaign.name.label("campaign_name"),
            func.sum(DailyPerformance.cost).label("cost"),
            func.sum(DailyPerformance.revenue).label("revenue"),
            func.sum(DailyPerformance.conversions).label("conversions"),
        )
        .join(Campaign, Campaign.campaign_id == AdSet.campaign_id)
        .join(Ad, Ad.adset_id == AdSet.adset_id)
        .join(DailyPerformance, DailyPerformance.ad_id == Ad.ad_id)
        .filter(DailyPerformance.date >= start_date, DailyPerformance.date <= end_date)
        .group_by(AdSet.adset_id, AdSet.name, Campaign.name)
        .all()
    )

    adset_alerts = []
    for row in adset_rows:
        value = _calc_alert_metric(metric, row)
        if _is_exceeded(metric, value, threshold):
            adset_alerts.append(
                AlertItem(name=row.name, parent_name=row.campaign_name, metric=metric, value=value, threshold=threshold)
            )

    ad_rows = (
        db.query(
            Ad.name,
            AdSet.name.label("adset_name"),
            func.sum(DailyPerformance.cost).label("cost"),
            func.sum(DailyPerformance.revenue).label("revenue"),
            func.sum(DailyPerformance.conversions).label("conversions"),
        )
        .join(AdSet, AdSet.adset_id == Ad.adset_id)
        .join(DailyPerformance, DailyPerformance.ad_id == Ad.ad_id)
        .filter(DailyPerformance.date >= start_date, DailyPerformance.date <= end_date)
        .group_by(Ad.ad_id, Ad.name, AdSet.name)
        .all()
    )

    creative_alerts = []
    for row in ad_rows:
        value = _calc_alert_metric(metric, row)
        if _is_exceeded(metric, value, threshold):
            creative_alerts.append(
                AlertItem(name=row.name, parent_name=row.adset_name, metric=metric, value=value, threshold=threshold)
            )

    return AlertsResponse(adset_alerts=adset_alerts, creative_alerts=creative_alerts)
