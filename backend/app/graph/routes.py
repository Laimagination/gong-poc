"""FastAPI router for the Neo4j knowledge graph API."""

from fastapi import APIRouter, HTTPException

from .connection import check_health
from .queries import get_full_graph, get_department_subgraph, get_project_lineage, get_graph_stats, get_graph_insights

router = APIRouter()


@router.get("/health")
async def graph_health():
    """Neo4j connectivity check."""
    try:
        ok = await check_health()
        if ok:
            return {"status": "ok"}
        raise Exception("health check returned false")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Neo4j unavailable: {e}")


@router.get("/full")
async def full_graph():
    """Full graph: all nodes and links for visualization."""
    try:
        return await get_full_graph()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/department/{dept_id}")
async def department_subgraph(dept_id: str):
    """3-hop subgraph from a department node."""
    try:
        return await get_department_subgraph(dept_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/project/{project_id}/lineage")
async def project_lineage(project_id: int):
    """Compliance lineage for a single project."""
    try:
        return await get_project_lineage(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/insights")
async def graph_insights():
    """Cross-module insight data from the knowledge graph."""
    try:
        return await get_graph_insights()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def graph_stats():
    """Summary counts of nodes and relationships by type."""
    try:
        return await get_graph_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
