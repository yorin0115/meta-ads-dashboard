from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import metrics
from ..database import get_db
from ..dependencies import validate_date_range
from ..models import Ad, AdSet, Campaign, DailyPerformance
from ..schemas import TopCreativeItem

router = APIRouter(prefix="/api/top-creatives", tags=["top-creatives"])


@router.get("", response_model=list[TopCreativeItem])
def get_top_creatives(
    target_cpa: float,
    date_range: tuple[date, date] = Depends(validate_date_range),
    db: Session = Depends(get_db),
):
    """找出這段期間平均CPA有達成目標的廣告（素材），CPA低（表現好）的排最前面

    對應前端 frontend/prototype/js/top-creatives.js。

    ad.csv本身沒有「狀態」欄位（見models.py的說明），這裡用「這段期間最後一天的投遞狀態」
    當作這個廣告目前的狀態，比較貼近「現在還有沒有在投遞」這個問題。
    """
    start_date, end_date = date_range
    rows = (
        db.query(
            Ad.ad_id,
            Ad.name.label("ad_name"),
            AdSet.name.label("adset_name"),
            Campaign.name.label("campaign_name"),
            DailyPerformance.date,
            DailyPerformance.cost,
            DailyPerformance.conversions,
            DailyPerformance.delivery_status,
        )
        .join(AdSet, AdSet.adset_id == Ad.adset_id)
        .join(Campaign, Campaign.campaign_id == AdSet.campaign_id)
        .join(DailyPerformance, DailyPerformance.ad_id == Ad.ad_id)
        .filter(DailyPerformance.date >= start_date, DailyPerformance.date <= end_date)
        .order_by(DailyPerformance.date)
        .all()
    )

    # 把同一個廣告在期間內的每一天資料加總起來；因為 rows 已經照日期排序，
    # 迴圈跑到最後一筆時 status 會自然變成「期間內最後一天」的狀態
    totals: dict[str, dict] = {}
    for row in rows:
        entry = totals.setdefault(
            row.ad_id,
            {
                "name": row.ad_name,
                "adset_name": row.adset_name,
                "campaign_name": row.campaign_name,
                "cost": 0.0,
                "conversions": 0,
                "status": row.delivery_status,
            },
        )
        entry["cost"] += float(row.cost)
        entry["conversions"] += row.conversions
        entry["status"] = row.delivery_status

    results = []
    for ad_id, entry in totals.items():
        cpa = metrics.calc_cpa(entry["cost"], entry["conversions"])
        if cpa is not None and cpa <= target_cpa:
            results.append(
                TopCreativeItem(
                    ad_id=ad_id,
                    name=entry["name"],
                    adset_name=entry["adset_name"],
                    campaign_name=entry["campaign_name"],
                    cpa=cpa,
                    status=entry["status"],
                )
            )

    results.sort(key=lambda item: item.cpa)
    return results
