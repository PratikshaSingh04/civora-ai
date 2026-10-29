from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


@app.get("/")
def root():

    return {
        "project": "CIVORA AI",
        "status": "Backend is running",
        "version": "1.0.0"
    }