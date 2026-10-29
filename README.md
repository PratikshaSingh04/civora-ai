# CIVORA AI

CIVORA AI is an urban digital-twin prototype for flood-risk analysis, scenario planning, air-quality context, and geospatial exploration in Mumbai's K-East ward.

## Project structure

- `frontend/` — React, TypeScript, and Vite application.
- `backend/` — FastAPI application and API routes.
- Root-level files — analysis scripts, datasets, model artifacts, and reports.

## Run the frontend

```powershell
cd frontend
npm ci
npm run dev
```

The optional CARTO basemap key can be configured in `frontend/.env` using `frontend/.env.example` as a template. Do not commit `.env` files or API keys.

## Backend

The FastAPI application entry point is `backend/app/main.py`. A backend dependency manifest is not currently included.
