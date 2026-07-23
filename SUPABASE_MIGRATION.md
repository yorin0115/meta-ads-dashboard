# Supabase 遷移說明

## 遷移狀態
✅ **已遷移到 Supabase Functions（2026-07-24）**

## 當前配置

### 前端
- **位置**: `frontend/prototype/`
- **後端地址**: Supabase Functions (`https://hgxpdrpalpqdxjduvcqx.supabase.co/functions/v1`)
- **API Endpoints**:
  - `GET /campaigns-performance`
  - `GET /performance-summary`
  - `GET /alerts`
  - `GET /top-creatives`

### 後端
- **Supabase 資料庫**: `postgres` (Pooler: aws-0-ap-southeast-1)
- **Functions**: 4 個 TypeScript Functions 託管在 Supabase
- **環境變數**: 
  - `backend/.env` 中的 `DATABASE_URL` 指向 Supabase（已配置）

## 數據導入

### 方案 1：繼續使用 import_csv.py（推薦）
```bash
# 1. 確保 backend/.env 指向 Supabase
# DATABASE_URL=postgresql+psycopg2://postgres.hgxpdrpalpqdxjduvcqx:...

# 2. 運行導入腳本
python backend/import_csv.py database/raw_data/campaign.csv
python backend/import_csv.py database/raw_data/adset.csv
python backend/import_csv.py database/raw_data/ad.csv
python backend/import_csv.py database/raw_data/daily_performance.csv
```

### 方案 2：Supabase SQL Editor
在 Supabase 控制面板 → SQL Editor 中直接執行 SQL 導入

## 回退到 PostgreSQL + FastAPI

如果需要回到原始的 PostgreSQL + FastAPI 架構：

### 步驟 1：切換到備份分支
```bash
git checkout postgresql-fastapi-backup
```

### 步驟 2：更新前端 API 配置
```javascript
// frontend/prototype/js/api-config.js
const API_BASE_URL = "http://127.0.0.1:8000";
```

並還原 API 路徑：
- `/campaigns-performance` → `/api/campaigns/performance`
- `/performance-summary` → `/api/performance/summary`
- `/alerts` → `/api/alerts`
- `/top-creatives` → `/api/top-creatives`

### 步驟 3：啟動本地 FastAPI 後端
```bash
cd backend
python -m uvicorn app.main:app --reload
```

### 步驟 4：更新 backend/.env（可選）
```
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/meta_ads_dashboard
```

## Git 分支結構

| 分支 | 說明 | 狀態 |
|------|------|------|
| `main` | 主分支，使用 Supabase Functions | ✅ 現用 |
| `postgresql-fastapi-backup` | 備份原始 PostgreSQL + FastAPI 配置 | 保留 |
| `feature/migrate-to-supabase` | 已合併到 main | 已完成 |

## 關鍵文件

### Supabase 相關
- `supabase/config.toml` - Supabase 項目配置
- `supabase/functions/*/index.ts` - 4 個 API Functions

### 前端
- `frontend/prototype/js/api-config.js` - API 基址配置

### 後端（如需使用 FastAPI）
- `backend/app/` - FastAPI 應用代碼
- `backend/import_csv.py` - CSV 數據導入腳本

## 數據庫遷移歷程

1. **原始**: 本地 PostgreSQL
2. **遷移**: 數據導出備份（`backup.dump`, `schema.sql`）
3. **現在**: Supabase PostgreSQL
4. **外鍵關係**: 已在 Supabase 中配置

## 注意事項

- ✅ 前端已在本地測試，正常顯示數據
- ✅ Supabase Functions 已部署並通過測試
- ✅ 數據庫外鍵關係已配置
- ⏳ GitHub Pages 部署尚未完成（可按需進行）
- 📌 `.env` 文件包含敏感信息，不提交到 Git

## 後續步驟

1. 部署前端到 GitHub Pages
2. 測試 GitHub Page 顯示數據
3. 若未來需要迴轉，切換回 `postgresql-fastapi-backup` 分支
