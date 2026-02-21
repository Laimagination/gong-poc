"""Realistic seed data generator for AI Governance POC.

Generates 2-3 months of simulated LLM usage across departments so the
dashboard has data on first load.
"""

import hashlib
import random
from datetime import datetime, timedelta

from sqlalchemy import select, func

from ..database import async_session
from ..models import AIRequest
from .gateway import MODEL_PRICING

# Department usage distribution (relative weights)
DEPARTMENTS = {
    "Engineering": {"weight": 35, "users": ["eng-alice", "eng-bob", "eng-carol", "eng-dave", "eng-eve"]},
    "Sales": {"weight": 20, "users": ["sales-frank", "sales-grace", "sales-henry"]},
    "Marketing": {"weight": 15, "users": ["mkt-iris", "mkt-jack", "mkt-karen"]},
    "Support": {"weight": 15, "users": ["sup-leo", "sup-mia", "sup-noah"]},
    "Product": {"weight": 10, "users": ["prod-olivia", "prod-peter"]},
    "Legal": {"weight": 5, "users": ["legal-quinn", "legal-rachel"]},
}

# Model configs: provider, tier distribution, token ranges
MODELS = {
    "gpt-4.1-mini": {
        "provider": "openai",
        "tier": "simple",
        "input_range": (50, 500),
        "output_range": (30, 400),
        "latency_range": (200, 1200),
    },
    "gpt-4.1": {
        "provider": "openai",
        "tier": "moderate",
        "input_range": (100, 2000),
        "output_range": (100, 1500),
        "latency_range": (500, 3000),
    },
    "claude-sonnet-4-6": {
        "provider": "anthropic",
        "tier": "complex",
        "input_range": (200, 4000),
        "output_range": (200, 3000),
        "latency_range": (800, 5000),
    },
    "gemini/gemini-2.5-pro": {
        "provider": "google",
        "tier": "moderate",
        "input_range": (100, 1500),
        "output_range": (80, 1200),
        "latency_range": (400, 2500),
    },
}

# Tier distribution for model selection (what % of calls go to each tier)
TIER_MODEL_WEIGHTS = {
    "simple": {"gpt-4.1-mini": 85, "gemini/gemini-2.5-pro": 15},
    "moderate": {"gpt-4.1": 70, "gemini/gemini-2.5-pro": 30},
    "complex": {"claude-sonnet-4-6": 80, "gpt-4.1": 20},
}

# Tier distribution per department
DEPT_TIER_DIST = {
    "Engineering": {"simple": 30, "moderate": 40, "complex": 30},
    "Sales": {"simple": 50, "moderate": 40, "complex": 10},
    "Marketing": {"simple": 45, "moderate": 45, "complex": 10},
    "Support": {"simple": 60, "moderate": 30, "complex": 10},
    "Product": {"simple": 25, "moderate": 45, "complex": 30},
    "Legal": {"simple": 20, "moderate": 30, "complex": 50},
}

SAMPLE_PROMPTS = [
    "Summarize the quarterly report",
    "Generate test cases for the auth module",
    "Draft an email to the client about the feature update",
    "Analyze customer feedback sentiment",
    "Explain the architecture of the payment service",
    "Create a SQL query for user analytics",
    "Review this code for security vulnerabilities",
    "Write documentation for the API endpoint",
    "Translate this marketing copy to Spanish",
    "Help debug this Python traceback",
]


def _weighted_choice(weights: dict) -> str:
    items = list(weights.keys())
    w = list(weights.values())
    return random.choices(items, weights=w, k=1)[0]


def _compute_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    pricing = MODEL_PRICING.get(model, {"input": 0.0, "output": 0.0})
    return round(input_tokens * pricing["input"] + output_tokens * pricing["output"], 6)


async def seed_if_empty():
    """Generate seed data if the ai_requests table is empty."""
    async with async_session() as db:
        count_result = await db.execute(select(func.count(AIRequest.id)))
        count = count_result.scalar() or 0
        if count > 0:
            return  # Already seeded

        records = _generate_records()
        db.add_all(records)
        await db.commit()


def _generate_records() -> list[AIRequest]:
    """Generate 2-3 months of realistic AI usage data."""
    random.seed(42)  # Reproducible
    records = []
    now = datetime.utcnow()
    start = now - timedelta(days=75)

    # Base daily request counts per department (will vary day to day)
    dept_base_daily = {
        "Engineering": 45,
        "Sales": 25,
        "Marketing": 20,
        "Support": 20,
        "Product": 12,
        "Legal": 6,
    }

    current_day = start
    while current_day < now:
        is_weekend = current_day.weekday() >= 5
        day_multiplier = 0.2 if is_weekend else 1.0

        # Slight upward trend over time (adoption growth)
        days_elapsed = (current_day - start).days
        growth = 1.0 + (days_elapsed / 75) * 0.3  # 30% growth over period

        for dept, base_count in dept_base_daily.items():
            daily_count = int(base_count * day_multiplier * growth * random.uniform(0.7, 1.3))
            tier_dist = DEPT_TIER_DIST[dept]
            users = DEPARTMENTS[dept]["users"]

            for _ in range(daily_count):
                tier = _weighted_choice(tier_dist)
                model_weights = TIER_MODEL_WEIGHTS[tier]
                model = _weighted_choice(model_weights)
                mcfg = MODELS[model]

                input_tokens = random.randint(*mcfg["input_range"])
                output_tokens = random.randint(*mcfg["output_range"])
                total_tokens = input_tokens + output_tokens
                cost = _compute_cost(model, input_tokens, output_tokens)

                # Latency with occasional spikes
                base_latency = random.uniform(*mcfg["latency_range"])
                if random.random() < 0.03:  # 3% chance of latency spike
                    base_latency *= random.uniform(2, 5)
                latency_ms = round(base_latency, 1)

                # Status: ~2% error rate, ~0.5% timeout
                roll = random.random()
                if roll < 0.005:
                    status = "timeout"
                    error_message = "Request timed out after 30000ms"
                elif roll < 0.025:
                    status = "error"
                    error_message = random.choice([
                        "Rate limit exceeded",
                        "Model overloaded",
                        "Invalid response format",
                        "Context length exceeded",
                    ])
                else:
                    status = "success"
                    error_message = None

                prompt = random.choice(SAMPLE_PROMPTS)
                prompt_hash = hashlib.sha256(
                    f"{prompt}-{random.randint(0, 999999)}".encode()
                ).hexdigest()

                # Random time within business hours (with some off-hours)
                if is_weekend:
                    hour = random.randint(10, 18)
                else:
                    hour = random.choices(
                        range(24),
                        weights=[1, 0, 0, 0, 0, 1, 2, 5, 10, 12, 12, 10,
                                 8, 10, 12, 11, 9, 7, 4, 3, 2, 1, 1, 1],
                        k=1,
                    )[0]
                minute = random.randint(0, 59)
                second = random.randint(0, 59)
                ts = current_day.replace(hour=hour, minute=minute, second=second, microsecond=0)

                records.append(AIRequest(
                    timestamp=ts,
                    department=dept,
                    user_id=random.choice(users),
                    model=model,
                    provider=mcfg["provider"],
                    task_tier=tier,
                    prompt_hash=prompt_hash,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,
                    cost_usd=cost,
                    latency_ms=latency_ms,
                    status=status,
                    error_message=error_message,
                ))

        current_day += timedelta(days=1)

    return records
