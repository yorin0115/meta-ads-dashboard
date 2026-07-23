from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import metrics
from ..database import get_db
from ..dependencies import validate_date_range
from ..models import DailyPerformance
from ..schemas import PerformanceSummary, PeriodMetrics, TrendPoint

router = APIRouter(prefix="/api/performance", tags=["performance"])


def _get_previous_period(start_date: date, end_date: date) -> tuple[date, date]:
    """算出「跟現在這段期間一樣長、緊接在前面」的區間，給KPI卡片的「較上一期間」用"""
    period_length_days = (end_date - start_date).days + 1
    previous_end = start_date - timedelta(days=1)
    previous_start = previous_end - timedelta(days=period_length_days - 1)
    return previous_start, previous_end


def _aggregate_totals(db: Session, start_date: date, end_date: date) -> PeriodMetrics:
    """整個帳號（不分行銷活動）在這段期間的加總指標"""
    row = (
        db.query(
            func.sum(DailyPerformance.cost).label("cost"),
            func.sum(DailyPerformance.revenue).label("revenue"),
            func.sum(DailyPerformance.impressions).label("impressions"),
            func.sum(DailyPerformance.clicks).label("clicks"),
            func.sum(DailyPerformance.conversions).label("conversions"),
        )
        .filter(DailyPerformance.date >= start_date, DailyPerformance.date <= end_date)
        .one()
    )
    cost = float(row.cost or 0)
    revenue = float(row.revenue) if row.revenue is not None else None
    impressions = row.impressions or 0
    clicks = row.clicks or 0
    conversions = row.conversions or 0

    return PeriodMetrics(
        cost=cost,
        cpa=metrics.calc_cpa(cost, conversions),
        roas=metrics.calc_roas(revenue, cost),
        cvr=metrics.calc_cvr(conversions, clicks),
        ctr=metrics.calc_ctr(clicks, impressions),
    )


def _daily_trend(db: Session, start_date: date, end_date: date) -> list[TrendPoint]:
    """每天的加總指標，缺資料的那天用0補齊，這樣圖表上才不會有斷掉的日期"""
    rows = (
        db.query(
            DailyPerformance.date,
            func.sum(DailyPerformance.cost).label("cost"),
            func.sum(DailyPerformance.revenue).label("revenue"),
            func.sum(DailyPerformance.impressions).label("impressions"),
            func.sum(DailyPerformance.clicks).label("clicks"),
            func.sum(DailyPerformance.conversions).label("conversions"),
        )
        .filter(DailyPerformance.date >= start_date, DailyPerformance.date <= end_date)
        .group_by(DailyPerformance.date)
        .all()
    )
    row_by_date = {row.date: row for row in rows}

    points = []
    current_date = start_date
    while current_date <= end_date:
        row = row_by_date.get(current_date)
        cost = float(row.cost) if row else 0.0
        revenue = float(row.revenue) if row and row.revenue is not None else None
        impressions = row.impressions if row else 0
        clicks = row.clicks if row else 0
        conversions = row.conversions if row else 0

        points.append(
            TrendPoint(
                date=current_date,
                cost=cost,
                cpa=metrics.calc_cpa(cost, conversions),
                roas=metrics.calc_roas(revenue, cost),
                cvr=metrics.calc_cvr(conversions, clicks),
                ctr=metrics.calc_ctr(clicks, impressions),
            )
        )
        current_date += timedelta(days=1)

    return points


@router.get("/summary", response_model=PerformanceSummary)
def get_performance_summary(
    date_range: tuple[date, date] = Depends(validate_date_range),
    db: Session = Depends(get_db),
):
    """整個帳號的KPI摘要：這段期間的加總指標、上一個等長期間的加總指標（用來算漲跌%）、
    還有這段期間每天的趨勢
    """
    start_date, end_date = date_range
    previous_start, previous_end = _get_previous_period(start_date, end_date)

    return PerformanceSummary(
        current=_aggregate_totals(db, start_date, end_date),
        previous=_aggregate_totals(db, previous_start, previous_end),
        trend=_daily_trend(db, start_date, end_date),
    )
