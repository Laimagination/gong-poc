import logging
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
    from .poc3_aims.seed import seed_if_empty as seed_aims
    await seed_aims()

    # Sync knowledge graph (non-fatal if Neo4j is unavailable)
    from .graph.sync import full_sync
    try:
        await full_sync()
    except Exception as e:
        logging.warning(f"Neo4j graph sync failed (non-fatal): {e}")

    yield

    # Shutdown: close Neo4j driver
    from .graph.connection import close_driver
    await close_driver()


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
from .poc3_aims.routes import router as aims_router
from .graph.routes import router as graph_router

app.include_router(governance_router, prefix="/api/governance", tags=["governance"])
app.include_router(discovery_router, prefix="/api/discovery", tags=["discovery"])
app.include_router(aims_router, prefix="/api/aims", tags=["aims"])
app.include_router(graph_router, prefix="/api/graph", tags=["graph"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
