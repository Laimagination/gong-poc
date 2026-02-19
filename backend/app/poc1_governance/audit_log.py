"""ISO 42001-aligned AI request audit logging and retrieval."""

from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AIRequest


async def get_audit_log(
    db: AsyncSession,
    *,
    days: int = 30,
    department: Optional[str] = None,
    model: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    """Retrieve audit log entries with ISO 42001-aligned fields.

    ISO 42001 (AI Management System) requires:
    - Traceability of AI system actions
    - Risk assessment data (tier, model selection)
    - Performance monitoring (latency, status)
    - Data protection (prompt hash, not content)
    - Accountability (user/department tracking)
    """
    cutoff = datetime.utcnow() - timedelta(days=days)
    filters = [AIRequest.timestamp >= cutoff]
    if department:
        filters.append(AIRequest.department == department)
    if model:
        filters.append(AIRequest.model == model)
    if status:
        filters.append(AIRequest.status == status)

    # Total count
    count_stmt = select(func.count(AIRequest.id)).where(and_(*filters))
    total = (await db.execute(count_stmt)).scalar() or 0

    # Paginated records
    stmt = (
        select(AIRequest)
        .where(and_(*filters))
        .order_by(desc(AIRequest.timestamp))
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    records = result.scalars().all()

    entries = [
        {
            "id": r.id,
            # ISO 42001 traceability
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "user_id": r.user_id,
            "department": r.department,
            # AI system identification
            "model": r.model,
            "provider": r.provider,
            "task_tier": r.task_tier,
            # Data protection: hash only, no raw prompt
            "prompt_hash": r.prompt_hash,
            # Resource usage
            "input_tokens": r.input_tokens,
            "output_tokens": r.output_tokens,
            "total_tokens": r.total_tokens,
            "cost_usd": r.cost_usd,
            # Performance monitoring
            "latency_ms": r.latency_ms,
            "status": r.status,
            "error_message": r.error_message,
        }
        for r in records
    ]

    # Summary statistics for the filtered set
    summary_stmt = (
        select(
            func.count(AIRequest.id).label("total_requests"),
            func.sum(AIRequest.cost_usd).label("total_cost"),
            func.sum(AIRequest.total_tokens).label("total_tokens"),
            func.avg(AIRequest.latency_ms).label("avg_latency"),
        )
        .where(and_(*filters))
    )
    summary_row = (await db.execute(summary_stmt)).one()

    return {
        "period_days": days,
        "total_records": total,
        "limit": limit,
        "offset": offset,
        "summary": {
            "total_requests": summary_row.total_requests or 0,
            "total_cost_usd": round(float(summary_row.total_cost or 0), 4),
            "total_tokens": int(summary_row.total_tokens or 0),
            "avg_latency_ms": round(float(summary_row.avg_latency or 0), 1),
        },
        "entries": entries,
        "iso_42001_compliance": {
            "traceability": True,
            "data_protection": "prompt_hash_only",
            "accountability": "user_and_department_tracked",
            "risk_classification": "task_tier_based",
            "performance_monitoring": "latency_and_status_tracked",
        },
    }
