import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import get_db
from .routers import alerts, campaigns, performance, top_creatives

load_dotenv()

app = FastAPI(title="Meta Ads Dashboard API")

# 前端網址固定下來後，在 .env 設定 ALLOWED_ORIGINS（多個網址用逗號分隔），
# 例如 ALLOWED_ORIGINS=https://example.com,https://www.example.com
# 沒設定的話，開發階段預設允許所有來源
_allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
allowed_origins = (
    [origin.strip() for origin in _allowed_origins_env.split(",")]
    if _allowed_origins_env
    else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
