"""Token spend forecasting: linear regression + exponential smoothing, budget alerts."""

from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AIRequest

# Budget alert thresholds
BUDGET_ALERT_THRESHOLDS = [
    {"level": "warning", "pct": 70},
    {"level": "critical", "pct": 90},
]


async def get_forecast(
    db: AsyncSession,
    *,
    history_days: int = 60,
    monthly_budget_usd: Optional[float] = 10000.0,
) -> dict:
    """Forecast 30/60/90 day token spend using historical daily costs."""
    cutoff = datetime.utcnow() - timedelta(days=history_days)

    daily_stmt = (
        select(
            func.date(AIRequest.timestamp).label("date"),
            func.sum(AIRequest.cost_usd).label("daily_cost"),
            func.sum(AIRequest.total_tokens).label("daily_tokens"),
            func.count(AIRequest.id).label("daily_requests"),
        )
        .where(AIRequest.timestamp >= cutoff)
        .group_by(func.date(AIRequest.timestamp))
        .order_by(func.date(AIRequest.timestamp))
    )
    result = await db.execute(daily_stmt)
    rows = result.all()

    if not rows:
        return _empty_forecast(monthly_budget_usd)

    daily_costs = [float(r.daily_cost or 0) for r in rows]
    daily_tokens = [int(r.daily_tokens or 0) for r in rows]
    dates = [str(r.date) for r in rows]

    # Linear regression forecast
    linear_30 = _linear_forecast(daily_costs, 30)
    linear_60 = _linear_forecast(daily_costs, 60)
    linear_90 = _linear_forecast(daily_costs, 90)

    # Exponential smoothing forecast
    ema_30 = _ema_forecast(daily_costs, 30)
    ema_60 = _ema_forecast(daily_costs, 60)
    ema_90 = _ema_forecast(daily_costs, 90)

    # Blended (average of linear and EMA)
    blend_30 = round((linear_30 + ema_30) / 2, 2)
    blend_60 = round((linear_60 + ema_60) / 2, 2)
    blend_90 = round((linear_90 + ema_90) / 2, 2)

    # Current month spend so far
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    mtd_stmt = (
        select(func.sum(AIRequest.cost_usd).label("mtd_cost"))
        .where(AIRequest.timestamp >= month_start)
    )
    mtd_result = await db.execute(mtd_stmt)
    mtd_cost = float(mtd_result.scalar() or 0)

    # Budget alerts
    alerts = []
    if monthly_budget_usd and monthly_budget_usd > 0:
        pct_used = (mtd_cost / monthly_budget_usd) * 100
        # Also project full-month from blended daily rate
        avg_daily = blend_30 / 30 if blend_30 > 0 else 0
        days_in_month = 30
        projected_month = avg_daily * days_in_month
        projected_pct = (projected_month / monthly_budget_usd) * 100

        for threshold in BUDGET_ALERT_THRESHOLDS:
            if pct_used >= threshold["pct"]:
                alerts.append({
                    "level": threshold["level"],
                    "message": f"Current month spend is {pct_used:.1f}% of ${monthly_budget_usd:,.0f} budget",
                    "mtd_cost": round(mtd_cost, 2),
                    "budget": monthly_budget_usd,
                    "pct_used": round(pct_used, 1),
                })
            elif projected_pct >= threshold["pct"]:
                alerts.append({
                    "level": threshold["level"],
                    "message": f"Projected month spend ({projected_pct:.1f}%) will exceed {threshold['pct']}% of budget",
                    "projected_cost": round(projected_month, 2),
                    "budget": monthly_budget_usd,
                    "projected_pct": round(projected_pct, 1),
                })

    return {
        "history_days": len(daily_costs),
        "avg_daily_cost": round(sum(daily_costs) / len(daily_costs), 4) if daily_costs else 0,
        "avg_daily_tokens": round(sum(daily_tokens) / len(daily_tokens)) if daily_tokens else 0,
        "forecast": {
            "30_day": {"linear": linear_30, "ema": ema_30, "blended": blend_30},
            "60_day": {"linear": linear_60, "ema": ema_60, "blended": blend_60},
            "90_day": {"linear": linear_90, "ema": ema_90, "blended": blend_90},
        },
        "monthly_budget_usd": monthly_budget_usd,
        "mtd_cost_usd": round(mtd_cost, 2),
        "budget_alerts": alerts,
        "daily_history": [
            {"date": dates[i], "cost": round(daily_costs[i], 4), "tokens": daily_tokens[i]}
            for i in range(len(dates))
        ],
    }


def _linear_forecast(values: list[float], days: int) -> float:
    """Simple linear regression to project cumulative cost over N days."""
    n = len(values)
    if n == 0:
        return 0.0
    if n == 1:
        return round(values[0] * days, 2)

    # Least squares: y = a + b*x where x = 0..n-1
    x_mean = (n - 1) / 2
    y_mean = sum(values) / n
    numerator = sum((i - x_mean) * (values[i] - y_mean) for i in range(n))
    denominator = sum((i - x_mean) ** 2 for i in range(n))

    if denominator == 0:
        b = 0.0
    else:
        b = numerator / denominator
    a = y_mean - b * x_mean

    # Sum projected daily costs for the next `days` days
    total = sum(max(a + b * (n + d), 0) for d in range(days))
    return round(total, 2)


def _ema_forecast(values: list[float], days: int, alpha: float = 0.3) -> float:
    """Exponential moving average forecast."""
    if not values:
        return 0.0

    ema = values[0]
    for v in values[1:]:
        ema = alpha * v + (1 - alpha) * ema

    # Project the current EMA rate forward
    return round(ema * days, 2)


def _empty_forecast(budget: Optional[float]) -> dict:
    zero = {"linear": 0.0, "ema": 0.0, "blended": 0.0}
    return {
        "history_days": 0,
        "avg_daily_cost": 0.0,
        "avg_daily_tokens": 0,
        "forecast": {"30_day": zero, "60_day": zero, "90_day": zero},
        "monthly_budget_usd": budget,
        "mtd_cost_usd": 0.0,
        "budget_alerts": [],
        "daily_history": [],
    }
