"""FastAPI endpoints for POC 1: AI Governance & Cost Platform."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from .gateway import route_completion, hash_prompt
from .cost_tracker import record_cost, get_cost_summary
from .sla_monitor import get_sla_metrics
from .forecasting import get_forecast
from .audit_log import get_audit_log

router = APIRouter()


# --- Request / Response schemas ---

class ChatRequest(BaseModel):
    message: str
    task_tier: str = "simple"  # simple | moderate | complex
    department: str = "Engineering"
    user_id: str = "anonymous"


class ChatResponse(BaseModel):
    response: Optional[str]
    model: str
    provider: str
    task_tier: str
    tokens: dict
    cost_usd: float
    latency_ms: float
    status: str
    error_message: Optional[str] = None


# --- Endpoints ---

@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Send a message through the AI gateway with tier-based routing."""
    messages = [{"role": "user", "content": req.message}]
    result = route_completion(
        messages=messages,
        task_tier=req.task_tier,
    )
    # route_completion is async
    result = await result

    # Record in DB for cost tracking + audit
    await record_cost(
        db,
        department=req.department,
        user_id=req.user_id,
        model=result["model"],
        provider=result["provider"],
        task_tier=req.task_tier,
        prompt_hash=hash_prompt(req.message),
        input_tokens=result["input_tokens"],
        output_tokens=result["output_tokens"],
        total_tokens=result["total_tokens"],
        cost_usd=result["cost_usd"],
        latency_ms=result["latency_ms"],
        status=result["status"],
        error_message=result["error_message"],
    )

    return ChatResponse(
        response=result["response_text"],
        model=result["model"],
        provider=result["provider"],
        task_tier=req.task_tier,
        tokens={
            "input": result["input_tokens"],
            "output": result["output_tokens"],
            "total": result["total_tokens"],
        },
        cost_usd=result["cost_usd"],
        latency_ms=result["latency_ms"],
        status=result["status"],
        error_message=result["error_message"],
    )


@router.get("/costs")
async def costs(
    days: int = Query(30, ge=1, le=365),
    department: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Get cost summary with department/model breakdowns and chargeback."""
    return await get_cost_summary(db, days=days, department=department)


@router.get("/sla")
async def sla(
    days: int = Query(7, ge=1, le=90),
    department: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Get SLA metrics: latency percentiles, error rates, uptime."""
    return await get_sla_metrics(db, days=days, department=department, model=model)


@router.get("/forecast")
async def forecast(
    history_days: int = Query(60, ge=7, le=180),
    monthly_budget: Optional[float] = Query(10000.0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Get token spend forecast with 30/60/90 day projections."""
    return await get_forecast(db, history_days=history_days, monthly_budget_usd=monthly_budget)


@router.get("/audit")
async def audit(
    days: int = Query(30, ge=1, le=365),
    department: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Get ISO 42001-aligned audit log of AI requests."""
    return await get_audit_log(
        db, days=days, department=department,
        model=model, status=status, limit=limit, offset=offset,
    )
