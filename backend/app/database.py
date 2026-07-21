import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# 在 backend/ 資料夾底下放一個 .env 檔案，就可以設定自己的 DATABASE_URL
# （例如密碼跟預設值不一樣的話）。沒有 .env、或 .env 裡沒設定的話，就用下面這組預設值
# （帳號/密碼: postgres/postgres，資料庫名稱: meta_ads_dashboard）
load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/meta_ads_dashboard",
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# 所有資料表模型（models.py）都要繼承這個 Base，SQLAlchemy 才知道要幫哪些類別建表
Base = declarative_base()


def get_db():
    """給 FastAPI 用的資料庫連線，每個API request會拿到一個獨立的連線，用完自動關閉"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
