import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Ensure backend directory is in Python path for cloud deployments
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.routes.scenarios import router as scenario_router
from app.routes.explanation import router as explanation_router
from app.routes.infrastructure import router as infrastructure_router
from app.routes.auth import router as auth_router
from app.routes.copilot import router as copilot_router
from app.routes.architecture import router as architecture_router


app = FastAPI(
    title="CIVORA AI API",
    description="Explainable AI-powered Digital Twin backend",
    version="1.0.0"
)


# Permissive CORS supporting both localhost and deployed domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


app.include_router(scenario_router)
app.include_router(explanation_router)
app.include_router(infrastructure_router)
app.include_router(auth_router)
app.include_router(copilot_router)
app.include_router(architecture_router)


# Mount frontend production build if available
DIST_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")
    
    # Check for public data directory
    DATA_DIR = DIST_DIR / "data"
    if DATA_DIR.exists():
        app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Allow API routes and Swagger docs to be handled
        if full_path.startswith("api") or full_path in ("docs", "redoc", "openapi.json"):
            return None
        file_path = DIST_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(DIST_DIR / "index.html")
else:
    @app.get("/")
    def root():
        return {
            "project": "CIVORA AI",
            "status": "Backend is running",
            "version": "1.0.0"
        }
