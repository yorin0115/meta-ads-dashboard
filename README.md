# Meta Ads Dashboard

## Project Overview

A dashboard for small businesses and individual sellers to monitor Meta advertising performance.

## Objective

Help users identify whether performance changes come from audience targeting or creative performance, and provide budget allocation suggestions.

## Current Status

- Backend is implemented: FastAPI + SQLAlchemy on PostgreSQL, with Alembic migrations and pytest unit tests
- Frontend prototype now calls the backend API directly (no longer using mock JSON data)
- Metrics (CPA/CPC/CPM/CTR/CVR/ROAS) are calculated on the fly in the backend, not stored in the database
- Not yet integrated with the Meta Ads API — data currently comes from imported CSV files (`database/raw_data/`)
- Not using React or Supabase

## Project Structure

- `frontend/prototype/` — frontend prototype pages, calling the backend API
- `backend/` — FastAPI backend (`app/`, `routers/`, Alembic migrations, pytest tests)
- `database/` — PostgreSQL database + raw CSV data, imported via `backend/import_csv.py`
- `docs/` — project documentation

## Tech Stack

### Backend
- Python
- FastAPI
- PostgreSQL
- SQLAlchemy
- Alembic
- Pytest

### Frontend
- HTML
- Tailwind CSS
- JavaScript

### Development Tools
- Git
- GitHub
- VS Code
- Claude