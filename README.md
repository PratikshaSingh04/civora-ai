<div align="center">

# 🌊 CIVORA AI
### An Explainable AI-Powered Digital Twin Platform for Smarter Urban Flood Risk Planning
**Case Study Area:** K/East Ward (Andheri East, Chakala, Saki Naka, Marol) — Mumbai, Maharashtra, India

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![XGBoost](https://img.shields.io/badge/Model-XGBoost%20Classifier-FF6F00.svg?logo=scikit-learn&logoColor=white)](https://xgboost.readthedocs.io/)
[![TreeSHAP](https://img.shields.io/badge/Explainability-TreeSHAP-7C5CFF.svg)](https://shap.readthedocs.io/)
[![Leaflet](https://img.shields.io/badge/GIS-Leaflet%20%7C%20MapLibre%203D-199900.svg?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Docker](https://img.shields.io/badge/Deployment-Docker%20%7C%20Render-2496ED.svg?logo=docker&logoColor=white)](https://render.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<p align="center">
  <b>A production-grade geospatial intelligence and decision-support system (DSS) designed to empower municipal town planners, civil engineers, and disaster management authorities to audit, predict, explain, and mitigate urban flash flooding before capital expenditure.</b>
</p>

[Explore Digital Twin](#-key-capabilities) • [System Architecture](#-system-architecture) • [Getting Started](#-local-installation--setup) • [Deployment](#-cloud-deployment-guide) • [API Reference](#-api-endpoints)

---

</div>

## 📌 Executive Summary & Context

Every monsoon, **Andheri East (K/East Ward, Mumbai)** experiences catastrophic flash flooding that inundates commercial hubs (MIDC, SEEPZ, Chakala), paralyzes major transit lifelines (Western Express Highway, Andheri-Kurla Road, Mumbai Metro Line 1), and inflicts crores in recurring infrastructure damage.

Traditional hydrodynamic stormwater flood simulations (e.g., SWMM, HEC-RAS) require months of manual parameter calibration, fine-grained underground pipe telemetry, and cannot compute real-time *What-If* policy scenarios. Meanwhile, standard machine learning models operate as "black boxes" that city engineers cannot inspect or trust.

**CIVORA AI bridges this gap** by combining:
1. **Micro-Spatial Discretization**: 405 uniform $250\text{m} \times 250\text{m}$ spatial grid cells covering 24.7 sq. km of K/East Ward.
2. **Multi-Source Remote Sensing & Vector Fusion**: Fusing **11,584 Microsoft building footprints**, **117.94 km OpenStreetMap road networks**, **European Space Agency Sentinel-2 satellite NDVI**, and **Open-Meteo IDW digital elevation models (DEM)**.
3. **Machine Learning Hazard Classification**: An **XGBoost Classifier** trained on topographic, infrastructural, and environmental features.
4. **Explainable AI (TreeSHAP)**: Decomposing the "black box" prediction for any cell into exact, cooperative game-theoretic physical feature contributions.
5. **What-If Scenario Simulation & Policy Testing**: Simulating municipal interventions (e.g., $+20\%$ urban greening, $-20\%$ road runoff density) in real-time.
6. **Municipal Cost-Benefit Analysis (CBA)**: Quantifying capital expenditure (CapEx), annual damage avoided, and Benefit-Cost Ratios (BCR) based on the **BMC Schedule of Rates (DSR 2024)**.
7. **Empirical Ground-Truth Validation**: Benchmarked directly against **57 official historical chronic waterlogging locations** logged by the Brihanmumbai Municipal Corporation (BMC), achieving a **92.65% top-tier hotspot capture rate**.

---

## 🚀 Key Capabilities

### 🗺️ 1. 2D Cartographic & 3D Extruded Digital Twin
* **Interactive Cartography**: High-performance multi-layer GIS rendering with Carto Dark Matter and Esri Canvas basemaps.
* **Metric Planar Reprojection**: On-the-fly reprojection from geographic `EPSG:4326` (WGS84 degrees) to planar `EPSG:32643` (UTM Zone 43N meters) via `pyproj`.
* **3D Building Extrusions**: MapLibre/Mapbox GL 3D visualization of 11,584 individual building footprints colored dynamically by flood risk.
* **Curated Landmark Autocomplete**: Instant search and camera fly-to for key Andheri East junctions (Chakala Metro, MIDC Central Road, Saki Naka Junction, Western Express Highway).

### 🔍 2. Explainable AI via TreeSHAP (Opening the Black Box)
* **The "Why Trust It?" Solution**: Rather than delivering an opaque probability score, CIVORA AI uses Lundberg & Lee’s **TreeSHAP algorithm ($O(TLD^2)$ time complexity)** to compute exact Shapley feature attributions.
* **Local Waterfall Decomposition**: For any inspected cell (e.g. `KE_G_0024`), the platform proves whether flood susceptibility is driven by:
  * Topographical depression (Elevation AMSL $\rightarrow +38\%$ risk)
  * Concrete imperviousness (Building footprint density $\rightarrow +22\%$ risk)
  * Lack of absorbent vegetative cover (Low NDVI $\rightarrow +15\%$ risk)

### 🧪 3. What-If Scenario Simulation Laboratory
* **Counterfactual Policy Modeling**: Test municipal interventions before committing capital expenditure:
  * **Scenario 1 (Urban Greening)**: $+20\%$ NDVI increase (roadside bioswales, Miyawaki micro-forests) $\rightarrow$ reduces flood probability across **280 grid cells**.
  * **Scenario 2 (Porous Pavements)**: $-20\%$ road runoff density (permeable interlocking asphalt pavers).
  * **Scenario 3 (Runoff Detention)**: $-20\%$ building runoff stress (commercial rainwater retention sumps in MIDC/SEEPZ).
* **Spatial Difference Rasters**: View absolute change deltas (pp) across the entire ward grid.

### 💰 4. Municipal Cost-Benefit Engine (CapEx & ROI)
* **Capital Outlay Estimation**: Built with official **CPWD & BMC District Schedule of Rates (DSR 2024)**:
  * **$+20\%$ Urban Greening CapEx**: **₹12.4 Crores** (targeted over 280 sensitive cells).
  * **Annual Flood Damage Avoided**: **₹34.8 Crores / year** in commercial inventory, transit delay, and road repair savings.
  * **Benefit-Cost Ratio (BCR)**: **2.81x** with a payback horizon of **4.3 months (< 1 monsoon season)**.

### 🛣️ 5. Infrastructure Corridor Feasibility Lab
* **Deterministic GIS Collision Detection**: Evaluates proposed flyovers, road widenings, or sponge transit corridors.
* **R-Tree Spatial Indexing**: Python `shapely.strtree.STRtree` performs hierarchical bounding-box intersection testing across all 11,584 buildings in $O(\log N)$ time.
* **Compensation Outlay**: Calculates land rehabilitation and structural compensation using official **Mumbai Ready Reckoner rates (₹75,000 / m²)** for Andheri East.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENT BROWSER                                      │
│                                                                                        │
│   React 19 SPA  •  TypeScript  •  Leaflet 2D GIS  •  MapLibre 3D  •  Vite Dev Proxy    │
│   Obsidian Dark UI System (#050914 / #101B2D)  •  Lucide SVGs  •  Tabular Numerals     │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP / JSON REST APIs (Reverse Proxy)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              FASTAPI ASYNC BACKEND (ASGI)                              │
│                                                                                        │
│   ├── /api/scenarios                     Summary stats, 405 grid predictions, hotspots │
│   ├── /api/scenarios/cost-benefit        Municipal CapEx, avoided damage & 2.81x BCR   │
│   ├── /api/explanation/{grid_id}         TreeSHAP local feature attribution vectors    │
│   ├── /api/infrastructure/analyze        Deterministic corridor conflict & costing     │
│   ├── /api/auth/departments              Role clearance (Urban, Disaster, Admin)       │
│   └── /api/copilot/query                 Natural language planning spatial interpreter │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
┌──────────────────────────────────────────┐  ┌──────────────────────────────────────────┐
│      MACHINE LEARNING & XAI ENGINE       │  │       GEOSPATIAL SPATIAL INDEXING        │
│                                          │  │                                          │
│ • XGBoost Classifier (XGBClassifier)     │  │ • Shapely 2.0 (STRtree R-Tree indexing)  │
│ • TreeSHAP (shap.TreeExplainer)          │  │ • PyProj (EPSG:4326 <-> EPSG:32643 UTM)  │
│ • Scikit-learn (Stratified K-Fold)       │  │ • 11,584 Microsoft Building Polygons     │
│ • Model Artifacts (.pkl & .json)         │  │ • 600 OpenStreetMap Road Segments        │
│ • 92.65% BMC Flood Spot Capture Rate     │  │ • 405 Uniform 250m Spatial Cells         │
└──────────────────────────────────────────┘  └──────────────────────────────────────────┘
```

---

## 📁 Repository Directory Structure

```text
CIVORA AI/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI entrypoint, CORS, static file mount
│   │   ├── routes/
│   │   │   ├── scenarios.py           # Scenario statistics, hotspots, cost-benefit API
│   │   │   ├── explanation.py         # TreeSHAP feature attribution endpoint
│   │   │   ├── infrastructure.py      # Corridor alignment screening & comparison
│   │   │   ├── auth.py                # Municipal department roles & session tokens
│   │   │   ├── copilot.py             # Spatial planning Copilot query interpreter
│   │   │   └── architecture.py        # System ER entity and module schema metadata
│   │   └── services/
│   │       └── feasibility.py         # GIS engine, PyProj UTM 43N, STRtree indexing
│   └── requirements.txt               # Backend Python dependency manifest
├── frontend/
│   ├── src/
│   │   ├── main.tsx                   # React 19 application mount
│   │   ├── App.tsx                    # Root component, telemetry, client-side routing
│   │   ├── config/
│   │   │   └── api.ts                 # Centralized API base URL resolver
│   │   ├── components/
│   │   │   ├── CivoraMap.tsx          # 2D Leaflet GIS digital twin map & search
│   │   │   ├── Civora3DDigitalTwin.tsx# 3D MapLibre building extrusion viewport
│   │   │   ├── ScenarioSimulator.tsx  # Policy simulation & Cost-Benefit (CBA) card
│   │   │   ├── CorridorFeasibilityLab.tsx # Alignment screening & Ready Reckoner costing
│   │   │   ├── HotspotExplorer.tsx    # Chronic waterlogging ranking table
│   │   │   ├── UrbanCopilot.tsx       # AI municipal copilot chat interface
│   │   │   ├── ValidationBenchmark.tsx# Official BMC ground-truth benchmark card
│   │   │   ├── WhatIfSandbox.tsx      # Micro-sensitivity slider controls
│   │   │   └── ArchitectureModal.tsx  # Interactive ER diagram & DFD module inspector
│   │   └── types/
│   │       └── civora.ts              # Strict TypeScript data schemas & interfaces
│   ├── public/data/                   # High-resolution WGS84 GeoJSON spatial layers
│   ├── package.json                   # Vite, React, Leaflet dependencies
│   ├── vite.config.ts                 # Vite bundler configuration & /api reverse proxy
│   └── vercel.json                    # Vercel deployment rewrite rules
├── data/
│   ├── environmental/                 # Historical weather (2015-2025) & OpenAQ datasets
│   └── raw/                           # Raw pre-processed GIS callsets & QGIS projects
├── scripts/
│   ├── openaq/                        # Air quality ETL data extraction pipelines
│   ├── scenarios/                     # Offline scenario sensitivity calculators
│   └── tests/                         # End-to-end integration test utilities
├── CIVORA_Flood_ML_Dataset_Final.csv  # 405-grid feature matrix for training
├── CIVORA_Flood_XGBoost_Model.pkl     # Serialized trained XGBoost model artifact
├── CIVORA_Flood_XGBoost_Model.json    # JSON representation of XGBoost decision trees
├── CIVORA_Scenario_Summary.json       # Pre-computed scenario simulation statistics
├── K_East_CIVORA_Scenario_Decision_WGS84.geojson # 405-cell decision boundary layer
├── train_flood_model.py               # Machine learning model training script
├── civora_flood_xgboost.py            # SHAP calculation & inference pipeline
├── render.yaml                        # Render unified fullstack blueprint
├── Dockerfile                         # Multi-stage production container build
├── requirements.txt                   # Root Python dependencies
└── README.md                          # Project documentation
```

---

## 🛠️ Local Installation & Setup

### Prerequisites
* **Python**: `3.10` or higher ([Download Python](https://www.python.org/downloads/))
* **Node.js**: `v20.x` or higher ([Download Node.js](https://nodejs.org/))
* **Git**: Installed and on `PATH`

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/PratikshaSingh04/CIVORA-AI.git
cd "CIVORA AI"
```

---

### Step 2: Set Up & Start the Python Backend

```bash
# Navigate to the backend directory
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
* The backend API will be live at: **`http://127.0.0.1:8000`**
* Interactive Swagger documentation: **`http://127.0.0.1:8000/docs`**

---

### Step 3: Set Up & Start the React Frontend

Open a **new terminal window**:

```bash
# Navigate to the frontend directory
cd frontend

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
```
* The web application will launch at: **`http://localhost:5173/`**
* *(All `/api/*` calls from the frontend are automatically reverse-proxied to the FastAPI server on port 8000)*.

---

### Step 4 (Optional): Run with Docker

To build and run the entire unified full-stack platform using Docker:

```bash
# Build and run container
docker compose up --build
```
* Access the unified application at: **`http://localhost:8000/`**

---

## ☁️ Cloud Deployment Guide

### Option 1: Unified Full-Stack on Render (1-Click / Free Tier)
CIVORA AI includes a multi-stage [`Dockerfile`](Dockerfile) and [`render.yaml`](render.yaml) that compiles the React frontend into static assets and serves it directly through FastAPI on a single URL:

1. Push your repository to GitHub:
   ```bash
   git push origin main
   ```
2. Log into [**dashboard.render.com**](https://dashboard.render.com/).
3. Click **New +** $\rightarrow$ **Blueprint**.
4. Select your `CIVORA-AI` repository.
5. Render will automatically detect `render.yaml`, build the Docker container, and deploy your live platform (e.g. `https://civora-ai.onrender.com`).

---

### Option 2: Hybrid Deployment (Vercel Frontend + Render Backend)
* **Backend**: Deploy the `backend/` directory on Render as a Python Web Service.
* **Frontend**: Deploy `frontend/` on Vercel with an environment variable:
  ```env
  VITE_API_URL=https://your-backend.onrender.com
  ```

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description | Query / Body Parameters |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Service health check & metadata | None |
| `GET` | `/api/scenarios` | Full ward summary, baseline statistics, and dominant policy counts | None |
| `GET` | `/api/scenarios/hotspots` | Chronic waterlogging grid cells ranked by probability | `limit` (default: 50) |
| `GET` | `/api/scenarios/cost-benefit` | CapEx, avoided damage, BCR (2.81x), and payback periods | None |
| `GET` | `/api/scenarios/benchmark/metrics`| Official BMC 57-spot empirical validation statistics | None |
| `GET` | `/api/explanation/{grid_id}` | TreeSHAP exact feature attribution decomposition | `grid_id` (e.g., `KE_G_0024`) |
| `GET` | `/api/infrastructure/presets` | Verified K/East Ward corridor screening presets | None |
| `POST`| `/api/infrastructure/analyze-alignment` | Deterministic GIS corridor collision & Ready Reckoner costing | `coordinates`, `corridor_width_m`, `project_type` |
| `POST`| `/api/copilot/query` | Natural language spatial planning assistant | `query`, `department_id`, `selected_grid_id` |

---

## 📊 Empirical Ground-Truth Validation

Rather than relying on abstract train-test splits, CIVORA AI was benchmarked against the **57 official historical chronic waterlogging locations** recorded by the **Municipal Corporation of Greater Mumbai (MCGM / BMC) Disaster Management Department**:

* **Top-Tier Hotspot Capture Rate (Recall)**: **`92.65%`** (63 out of 68 historical flood grid zones flagged in top risk tier).
* **Risk Concentration Ratio**: **`5.55x`** higher flood probability in official waterlogging sites vs. unaffected zones.
* **Mean Flood Probability**:
  * In Ground-Truth Flood Spots: **`53.06%`**
  * In Unaffected Grids: **`9.56%`**
* **Topographical Validation**: Mean elevation in flood zones is **`23.29 m AMSL`** vs. **`24.91 m AMSL`** in non-flood zones, confirming accurate physical depression learning.

---

## 📜 Technology Stack Summary

* **Frontend**: React 19, TypeScript, Vite 8, Leaflet 1.9, MapLibre GL 4.7, CSS Variables (Obsidian Dark Theme)
* **Backend**: Python 3.10+, FastAPI, Uvicorn, Pydantic v2, Starlette
* **Machine Learning**: XGBoost Classifier (`xgboost`), TreeSHAP (`shap`), Scikit-Learn (`scikit-learn`), Joblib
* **Geospatial & Vector GIS**: Shapely 2.0 (`STRtree`), PyProj (Coordinate Transformation), GeoJSON
* **Data Processing**: Pandas, NumPy
* **Infrastructure**: Docker Multi-stage Builds, Docker Compose, Render Blueprint (`render.yaml`), Vercel (`vercel.json`)

---

## 📄 License & Attribution

This project is open-source under the **[MIT License](LICENSE)**.

Developed for academic specialization, municipal planning research, and sustainable urban resilience in Mumbai, India.
