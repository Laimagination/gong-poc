"""Token cost tracking, aggregation, and department chargeback allocation."""

from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AIRequest


async def record_cost(
    db: AsyncSession,
    *,
    department: str,
    user_id: str,
    model: str,
    provider: str,
    task_tier: str,
    prompt_hash: str,
    input_tokens: int,
    output_tokens: int,
    total_tokens: int,
    cost_usd: float,
    latency_ms: float,
    status: str,
    error_message: Optional[str] = None,
    timestamp: Optional[datetime] = None,
) -> AIRequest:
    """Persist a single LLM request record."""
    record = AIRequest(
        timestamp=timestamp or datetime.utcnow(),
        department=department,
        user_id=user_id,
        model=model,
        provider=provider,
        task_tier=task_tier,
        prompt_hash=prompt_hash,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        cost_usd=cost_usd,
        latency_ms=latency_ms,
        status=status,
        error_message=error_message,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def get_cost_summary(
    db: AsyncSession,
    *,
    days: int = 30,
    department: Optional[str] = None,
) -> dict:
    """Aggregate costs by department and model for the last N days."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    filters = [AIRequest.timestamp >= cutoff]
    if department:
        filters.append(AIRequest.department == department)

    # Department breakdown
    dept_stmt = (
        select(
            AIRequest.department,
            func.sum(AIRequest.cost_usd).label("total_cost"),
            func.sum(AIRequest.total_tokens).label("total_tokens"),
            func.count(AIRequest.id).label("request_count"),
        )
        .where(and_(*filters))
        .group_by(AIRequest.department)
        .order_by(func.sum(AIRequest.cost_usd).desc())
    )
    dept_result = await db.execute(dept_stmt)
    by_department = [
        {
            "department": row.department,
            "total_cost": round(row.total_cost or 0, 4),
            "total_tokens": row.total_tokens or 0,
            "request_count": row.request_count,
        }
        for row in dept_result.all()
    ]

    # Model breakdown
    model_stmt = (
        select(
            AIRequest.model,
            AIRequest.provider,
            func.sum(AIRequest.cost_usd).label("total_cost"),
            func.sum(AIRequest.total_tokens).label("total_tokens"),
            func.count(AIRequest.id).label("request_count"),
        )
        .where(and_(*filters))
        .group_by(AIRequest.model, AIRequest.provider)
        .order_by(func.sum(AIRequest.cost_usd).desc())
    )
    model_result = await db.execute(model_stmt)
    by_model = [
        {
            "model": row.model,
            "provider": row.provider,
            "total_cost": round(row.total_cost or 0, 4),
            "total_tokens": row.total_tokens or 0,
            "request_count": row.request_count,
        }
        for row in model_result.all()
    ]

    # Daily trend
    daily_stmt = (
        select(
            func.date(AIRequest.timestamp).label("date"),
            func.sum(AIRequest.cost_usd).label("total_cost"),
            func.count(AIRequest.id).label("request_count"),
        )
        .where(and_(*filters))
        .group_by(func.date(AIRequest.timestamp))
        .order_by(func.date(AIRequest.timestamp))
    )
    daily_result = await db.execute(daily_stmt)
    daily_trend = [
        {
            "date": str(row.date),
            "total_cost": round(row.total_cost or 0, 4),
            "request_count": row.request_count,
        }
        for row in daily_result.all()
    ]

    grand_total = sum(d["total_cost"] for d in by_department)

    # Chargeback allocation (percentage of total)
    chargeback = [
        {
            "department": d["department"],
            "cost": d["total_cost"],
            "share_pct": round(d["total_cost"] / grand_total * 100, 2) if grand_total > 0 else 0,
        }
        for d in by_department
    ]

    return {
        "period_days": days,
        "grand_total_usd": round(grand_total, 4),
        "by_department": by_department,
        "by_model": by_model,
        "daily_trend": daily_trend,
        "chargeback": chargeback,
    }
