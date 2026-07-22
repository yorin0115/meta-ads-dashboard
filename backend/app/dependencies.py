from datetime import date

from fastapi import HTTPException


def validate_date_range(start_date: date, end_date: date) -> tuple[date, date]:
    """給四個查詢類API共用：檢查 start_date 不能晚於 end_date，區間顛倒就直接回400錯誤，
    而不是讓後面的查詢默默回傳空結果。
    """
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date 不能晚於 end_date",
        )
    return start_date, end_date
