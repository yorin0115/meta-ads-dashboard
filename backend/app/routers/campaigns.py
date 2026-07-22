from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import metrics
from ..database import get_db
from ..models import Ad, AdSet, Campaign, DailyPerformance
from ..schemas import CampaignPerformance

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


@router.get("/performance", response_model=list[CampaignPerformance])
def get_campaigns_performance(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
):
    """依行銷活動加總指定日期區間的花費/曝光/點擊/轉換，並算出衍生指標

    用「先查全部campaign，再用查出來的加總資料去對應」的方式，
    是為了讓某個時間區間內完全沒有成效資料的campaign也會出現在結果裡（顯示0），
    而不是直接消失不見——這樣跟現在前端的行為一致。
    """
    campaigns = db.query(Campaign).order_by(Campaign.campaign_id).all()

    agg_rows = (
        db.query(
            Campaign.campaign_id,
            func.sum(DailyPerformance.cost).label("cost"),
            func.sum(DailyPerformance.impressions).label("impressions"),
            func.sum(DailyPerformance.clicks).label("clicks"),
            func.sum(DailyPerformance.conversions).label("conversions"),
        )
        .join(AdSet, AdSet.campaign_id == Campaign.campaign_id)
        .join(Ad, Ad.adset_id == AdSet.adset_id)
        .join(DailyPerformance, DailyPerformance.ad_id == Ad.ad_id)
        .filter(DailyPerformance.date >= start_date, DailyPerformance.date <= end_date)
        .group_by(Campaign.campaign_id)
        .all()
    )
    agg_by_campaign_id = {row.campaign_id: row for row in agg_rows}

    results = []
    for campaign in campaigns:
        agg = agg_by_campaign_id.get(campaign.campaign_id)
        cost = float(agg.cost) if agg else 0.0
        impressions = agg.impressions if agg else 0
        clicks = agg.clicks if agg else 0
        conversions = agg.conversions if agg else 0

        results.append(
            CampaignPerformance(
                campaign_id=campaign.campaign_id,
                name=campaign.name,
                cost=cost,
                impressions=impressions,
                clicks=clicks,
                conversions=conversions,
                ctr=metrics.calc_ctr(clicks, impressions),
                cpc=metrics.calc_cpc(cost, clicks),
                cpm=metrics.calc_cpm(cost, impressions),
                cpa=metrics.calc_cpa(cost, conversions),
                cvr=metrics.calc_cvr(conversions, clicks),
                roas=None,  # 目前沒有營收資料來源，先固定回傳 None
            )
        )
    return results
