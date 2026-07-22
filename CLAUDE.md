# Meta Ads Dashboard

*所有回答請使用繁體中文*

## 專案目標

讓沒有廣告投放經驗的人，快速掌握Meta廣告成效，並透過趨勢分析、預算配置與成效提醒，作為廣告優化與預算調整的參考依據。

## Tech Stack

### Backend
- Python
- FastAPI
- PostgreSQL
- SQLAlchemy

### Frontend
- HTML
- Tailwind CSS
- JavaScript

### Development Tools
- Git
- GitHub
- VS Code
- Claude

## 專案結構

- `frontend/prototype/` — 前端原型頁面，直接打後端 API（不是純 mock data）
- `backend/` — FastAPI 後端（已開發：app/、routers/、alembic migrations、pytest 測試）
- `database/` — PostgreSQL 資料庫 + `raw_data/` 底下的原始 CSV（campaign/adset/ad/performance），用 `backend/import_csv.py` 匯入
- `data/` — 舊的 JSON mock data 資料夾（已不使用，前端已改接後端 API）
- `docs/` — 專案文件

## 目前開發階段

- 前端原型已串接 FastAPI 後端，不再是 mock data
- 後端已用 SQLAlchemy 建立 Campaign/AdSet/Ad/DailyPerformance 四張表，並用 Alembic 管理 migration
- CPA/CPC/CPM/CTR/CVR/ROAS 等指標在後端即時計算（`backend/app/metrics.py`），不存進資料庫
- 已有 pytest 單元測試（`backend/tests/`）
- 尚未串接 Meta API（目前資料來自匯入的 CSV，不是即時拉 Meta 官方資料）
- 不使用 React
- 尚未使用 Supabase

## 開發風格

- 我是程式初學者，請用簡單易懂的方式說明
- 每一步請解釋在做什麼、為什麼這樣做
- 檔案保持模組化，避免單一檔案過長
- 一次只做一個功能，完成並確認後再進行下一個

## Git 規則

- commit message 不要加上 `Co-Authored-By: Claude`
