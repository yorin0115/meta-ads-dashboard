from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import get_db
from .routers import alerts, campaigns, performance, top_creatives

app = FastAPI(title="Meta Ads Dashboard API")

# 開發階段先允許所有來源打API，之後前端網址固定下來了再收緊成只允許那個網址
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(campaigns.router)
app.include_router(performance.router)
app.include_router(alerts.router)
app.include_router(top_creatives.router)


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """確認 API 有跑起來、而且真的能連到資料庫"""
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
