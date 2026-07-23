"""把 database/raw_data/ 底下的4個CSV匯入資料庫。

執行方式（要在 backend/ 這個資料夾底下執行）：
    alembic upgrade head   # 第一次執行，或 models.py 有更新時，先建好/更新資料表
    python import_csv.py

四個檔案怎麼串起來：
    campaign.csv / adset.csv / ad.csv 彼此都用「編號」直接對應，很乾淨。
    performance.csv 沒有編號，只有「行銷活動名稱 + 廣告組合名稱 + 廣告名稱」這三個文字欄位，
    所以要先用前三個檔案建立一份「名稱 -> 廣告編號」的對照表，才能知道每一筆每日成效屬於哪個廣告。

這支腳本可以重複執行：每次執行都會先清空這4張表再重新匯入一次，
這樣不會因為重複執行而把資料匯入兩次。
"""

import csv
import io
from datetime import date, datetime
from pathlib import Path

from app.database import SessionLocal
from app.models import Ad, AdSet, Campaign, DailyPerformance

RAW_DATA_DIR = Path(__file__).resolve().parent.parent / "database" / "raw_data"


def read_csv_rows(filename: str) -> list[dict]:
    path = RAW_DATA_DIR / filename
    with open(path, "rb") as f:
        text = f.read().decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def parse_date(value: str) -> date:
    """CSV 裡的日期格式是 "2026/2/1" 這種年/月/日"""
    return datetime.strptime(value.strip(), "%Y/%m/%d").date()


def parse_int(value: str) -> int:
    """conv、clicks 這些欄位，Meta 匯出時「0」常常會留空白，這裡統一當作0"""
    value = value.strip()
    return int(float(value)) if value else 0


def parse_float(value: str) -> float:
    value = value.strip()
    return float(value) if value else 0.0


def parse_optional_float(value: str | None) -> float | None:
    """給「沒有資料就代表無法得知」的欄位用（例如營收）。

    跟 parse_float 不一樣的地方：沒有值的時候回傳 None（無法得知），
    不是 0（確定就是零）——這樣之後 calc_roas 才能正確分辨這兩種情況。
    """
    if value is None:
        return None
    value = value.strip()
    return float(value) if value else None


def import_campaigns(session) -> None:
    rows = read_csv_rows("campaign.csv")
    for row in rows:
        session.add(
            Campaign(
                campaign_id=row["行銷活動編號"],
                name=row["行銷活動名稱"],
                status=row["行銷活動投遞"],
                objective=row["目標"],
                budget_type=row["廣告組合預算類型"],
                start_date=parse_date(row["開始"]),
            )
        )
    print(f"匯入 {len(rows)} 筆行銷活動 (campaigns)")


def import_adsets(session) -> None:
    rows = read_csv_rows("adset.csv")
    for row in rows:
        session.add(
            AdSet(
                adset_id=row["廣告組合編號"],
                campaign_id=row["行銷活動編號"],
                name=row["廣告組合名稱"],
                status=row["廣告組合投遞"],
                optimization_goal=row["成效目標"],
                budget=parse_float(row["廣告組合預算"]),
                budget_type=row["廣告組合預算類型"],
                start_date=parse_date(row["開始"]),
            )
        )
    print(f"匯入 {len(rows)} 筆廣告組合 (adsets)")


def import_ads(session) -> None:
    rows = read_csv_rows("ad.csv")
    for row in rows:
        session.add(
            Ad(
                ad_id=row["廣告編號"],
                adset_id=row["廣告組合編號"],
                name=row["廣告名稱"],
                start_date=parse_date(row["開始"]),
            )
        )
    print(f"匯入 {len(rows)} 筆廣告 (ads)")


def build_name_to_ad_id_lookup(session) -> dict[tuple[str, str, str], str]:
    """建立 (行銷活動名稱, 廣告組合名稱, 廣告名稱) -> 廣告編號 的對照表

    用來把 performance.csv 的每一列，對應回正確的 ad_id。
    """
    campaign_id_to_name = {c.campaign_id: c.name for c in session.query(Campaign).all()}
    adsets = session.query(AdSet).all()
    adset_id_to_name = {a.adset_id: a.name for a in adsets}
    adset_id_to_campaign_id = {a.adset_id: a.campaign_id for a in adsets}

    lookup: dict[tuple[str, str, str], str] = {}
    for ad in session.query(Ad).all():
        campaign_id = adset_id_to_campaign_id[ad.adset_id]
        key = (campaign_id_to_name[campaign_id], adset_id_to_name[ad.adset_id], ad.name)
        lookup[key] = ad.ad_id
    return lookup


def import_daily_performance(session, name_to_ad_id: dict) -> None:
    rows = read_csv_rows("performance.csv")
    unmatched = []

    for row in rows:
        key = (row["行銷活動名稱"], row["廣告組合名稱"], row["廣告名稱"])
        ad_id = name_to_ad_id.get(key)
        if ad_id is None:
            unmatched.append(key)
            continue

        session.add(
            DailyPerformance(
                date=parse_date(row["分析報告開始"]),
                ad_id=ad_id,
                delivery_status=row["廣告投遞"],
                cost=parse_float(row["Cost"]),
                revenue=parse_optional_float(row.get("購買轉換價值")),
                conversions=parse_int(row["conv"]),
                reach=parse_int(row["觸及人數"]),
                impressions=parse_int(row["Imp"]),
                clicks=parse_int(row["clicks"]),
            )
        )

    print(f"匯入 {len(rows) - len(unmatched)} / {len(rows)} 筆每日成效 (daily_performance)")
    if unmatched:
        print(f"警告：有 {len(unmatched)} 筆對不到廣告，內容如下：")
        for key in unmatched[:10]:
            print("  ", key)


def main() -> None:
    session = SessionLocal()
    try:
        # 先清空這4張表，這樣重複執行這支腳本不會把資料匯入兩次
        session.query(DailyPerformance).delete()
        session.query(Ad).delete()
        session.query(AdSet).delete()
        session.query(Campaign).delete()
        session.commit()

        import_campaigns(session)
        import_adsets(session)
        import_ads(session)
        session.commit()  # 先把 campaigns/adsets/ads 存進去，才能查得到它們的關聯

        name_to_ad_id = build_name_to_ad_id_lookup(session)
        import_daily_performance(session, name_to_ad_id)
        session.commit()

        print("匯入完成！")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
