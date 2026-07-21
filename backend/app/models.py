from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Campaign(Base):
    """行銷活動（campaign.csv 的每一列對應這裡的一筆資料）"""

    __tablename__ = "campaigns"

    campaign_id: Mapped[str] = mapped_column(String(30), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20))
    objective: Mapped[str] = mapped_column(String(50))
    budget_type: Mapped[str] = mapped_column(String(20))
    start_date: Mapped[date] = mapped_column(Date)

    adsets: Mapped[list["AdSet"]] = relationship(back_populates="campaign")


class AdSet(Base):
    """廣告組合（adset.csv），每個廣告組合都屬於一個行銷活動"""

    __tablename__ = "adsets"

    adset_id: Mapped[str] = mapped_column(String(30), primary_key=True)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.campaign_id"))
    name: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20))
    optimization_goal: Mapped[str] = mapped_column(String(100))
    budget: Mapped[float] = mapped_column(Numeric(12, 2))
    budget_type: Mapped[str] = mapped_column(String(20))
    start_date: Mapped[date] = mapped_column(Date)

    campaign: Mapped["Campaign"] = relationship(back_populates="adsets")
    ads: Mapped[list["Ad"]] = relationship(back_populates="adset")


class Ad(Base):
    """廣告（ad.csv），每個廣告都屬於一個廣告組合

    ad.csv 本身沒有「狀態」欄位——廣告的投遞狀態每天都會變動（今天投遞中、明天可能關閉），
    所以狀態放在 DailyPerformance（每日成效）那張表，不是放在這裡。
    """

    __tablename__ = "ads"

    ad_id: Mapped[str] = mapped_column(String(30), primary_key=True)
    adset_id: Mapped[str] = mapped_column(ForeignKey("adsets.adset_id"))
    name: Mapped[str] = mapped_column(String(255))
    start_date: Mapped[date] = mapped_column(Date)

    adset: Mapped["AdSet"] = relationship(back_populates="ads")
    daily_performance: Mapped[list["DailyPerformance"]] = relationship(back_populates="ad")


class DailyPerformance(Base):
    """每日成效（performance.csv），是整個資料庫最重要的一張表

    畫面上會看到的所有數字（KPI卡片、趨勢圖、花費佔比、成效表格...）都是從這張表
    「即時算出來」的，不會再像 mock data 一樣，每個功能各自準備一份寫死的加總數字。

    目前故意不放「營收」欄位，因為 performance.csv 沒有這個資料來源；等之後決定好
    營收要從哪裡取得，再另外新增欄位或新增一張表。
    """

    __tablename__ = "daily_performance"
    __table_args__ = (UniqueConstraint("date", "ad_id", name="uq_daily_performance_date_ad"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[date] = mapped_column(Date)
    ad_id: Mapped[str] = mapped_column(ForeignKey("ads.ad_id"))
    delivery_status: Mapped[str] = mapped_column(String(20))
    cost: Mapped[float] = mapped_column(Numeric(12, 2))
    conversions: Mapped[int] = mapped_column(Integer, default=0)
    reach: Mapped[int] = mapped_column(Integer, default=0)
    impressions: Mapped[int] = mapped_column(Integer, default=0)
    clicks: Mapped[int] = mapped_column(Integer, default=0)

    ad: Mapped["Ad"] = relationship(back_populates="daily_performance")
