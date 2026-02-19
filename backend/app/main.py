from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Seed data on first run
    from .poc1_governance.seed import seed_if_empty
    await seed_if_empty()
    yield


app = FastAPI(title="Gong AI Operating Model POC", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .poc1_governance.routes import router as governance_router
from .poc2_discovery.routes import router as discovery_router
from .poc3_onboarding.routes import router as onboarding_router

app.include_router(governance_router, prefix="/api/governance", tags=["governance"])
app.include_router(discovery_router, prefix="/api/discovery", tags=["discovery"])
app.include_router(onboarding_router, prefix="/api/onboarding", tags=["onboarding"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
