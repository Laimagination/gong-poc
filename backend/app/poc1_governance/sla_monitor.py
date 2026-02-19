"""SLA monitoring: latency percentiles, error rates, uptime, and alert thresholds."""

from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, func, and_, case, cast, Float
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AIRequest

# Default SLA thresholds
SLA_THRESHOLDS = {
    "p95_latency_ms": 5000,   # 5s p95
    "p99_latency_ms": 10000,  # 10s p99
    "error_rate_pct": 5.0,    # 5% max error rate
    "uptime_pct": 99.0,       # 99% uptime target
}


async def get_sla_metrics(
    db: AsyncSession,
    *,
    days: int = 7,
    department: Optional[str] = None,
    model: Optional[str] = None,
) -> dict:
    """Compute SLA metrics: latency percentiles, error rate, uptime."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    filters = [AIRequest.timestamp >= cutoff]
    if department:
        filters.append(AIRequest.department == department)
    if model:
        filters.append(AIRequest.model == model)

    # Fetch all latencies for percentile calculation
    latency_stmt = (
        select(AIRequest.latency_ms)
        .where(and_(*filters, AIRequest.status == "success"))
        .order_by(AIRequest.latency_ms)
    )
    latency_result = await db.execute(latency_stmt)
    latencies = [row[0] for row in latency_result.all()]

    p50 = _percentile(latencies, 50)
    p95 = _percentile(latencies, 95)
    p99 = _percentile(latencies, 99)

    # Total counts and error rate
    count_stmt = (
        select(
            func.count(AIRequest.id).label("total"),
            func.sum(case((AIRequest.status != "success", 1), else_=0)).label("errors"),
        )
        .where(and_(*filters))
    )
    count_result = await db.execute(count_stmt)
    row = count_result.one()
    total = row.total or 0
    errors = row.errors or 0
    error_rate = round((errors / total * 100) if total > 0 else 0, 2)
    uptime = round(100 - error_rate, 2)

    # Per-model breakdown
    model_stmt = (
        select(
            AIRequest.model,
            func.count(AIRequest.id).label("total"),
            func.sum(case((AIRequest.status != "success", 1), else_=0)).label("errors"),
            func.avg(AIRequest.latency_ms).label("avg_latency"),
        )
        .where(and_(*filters))
        .group_by(AIRequest.model)
    )
    model_result = await db.execute(model_stmt)
    by_model = []
    for r in model_result.all():
        m_total = r.total or 0
        m_errors = r.errors or 0
        by_model.append({
            "model": r.model,
            "request_count": m_total,
            "error_count": m_errors,
            "error_rate_pct": round((m_errors / m_total * 100) if m_total > 0 else 0, 2),
            "avg_latency_ms": round(r.avg_latency or 0, 1),
        })

    # Hourly trend (last 24h or full period, whichever is shorter)
    trend_cutoff = max(cutoff, datetime.utcnow() - timedelta(hours=72))
    hourly_stmt = (
        select(
            func.strftime("%Y-%m-%d %H:00", AIRequest.timestamp).label("hour"),
            func.count(AIRequest.id).label("count"),
            func.avg(AIRequest.latency_ms).label("avg_latency"),
            func.sum(case((AIRequest.status != "success", 1), else_=0)).label("errors"),
        )
        .where(and_(AIRequest.timestamp >= trend_cutoff, *filters[1:]))
        .group_by(func.strftime("%Y-%m-%d %H:00", AIRequest.timestamp))
        .order_by(func.strftime("%Y-%m-%d %H:00", AIRequest.timestamp))
    )
    hourly_result = await db.execute(hourly_stmt)
    hourly_trend = [
        {
            "hour": r.hour,
            "request_count": r.count,
            "avg_latency_ms": round(r.avg_latency or 0, 1),
            "error_count": r.errors or 0,
        }
        for r in hourly_result.all()
    ]

    # Alert checks
    alerts = []
    if p95 and p95 > SLA_THRESHOLDS["p95_latency_ms"]:
        alerts.append({"type": "p95_latency", "value": p95, "threshold": SLA_THRESHOLDS["p95_latency_ms"]})
    if p99 and p99 > SLA_THRESHOLDS["p99_latency_ms"]:
        alerts.append({"type": "p99_latency", "value": p99, "threshold": SLA_THRESHOLDS["p99_latency_ms"]})
    if error_rate > SLA_THRESHOLDS["error_rate_pct"]:
        alerts.append({"type": "error_rate", "value": error_rate, "threshold": SLA_THRESHOLDS["error_rate_pct"]})
    if uptime < SLA_THRESHOLDS["uptime_pct"]:
        alerts.append({"type": "uptime", "value": uptime, "threshold": SLA_THRESHOLDS["uptime_pct"]})

    return {
        "period_days": days,
        "total_requests": total,
        "error_count": errors,
        "latency": {
            "p50_ms": p50,
            "p95_ms": p95,
            "p99_ms": p99,
        },
        "error_rate_pct": error_rate,
        "uptime_pct": uptime,
        "by_model": by_model,
        "hourly_trend": hourly_trend,
        "alerts": alerts,
        "thresholds": SLA_THRESHOLDS,
    }


def _percentile(sorted_values: list[float], pct: int) -> Optional[float]:
    """Compute percentile from a pre-sorted list."""
    if not sorted_values:
        return None
    n = len(sorted_values)
    idx = (pct / 100) * (n - 1)
    lower = int(idx)
    upper = min(lower + 1, n - 1)
    frac = idx - lower
    return round(sorted_values[lower] * (1 - frac) + sorted_values[upper] * frac, 1)
