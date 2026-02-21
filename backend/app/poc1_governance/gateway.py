"""LiteLLM multi-model routing with tier-based selection and fallback chains."""

import hashlib
import time
from typing import Optional

import litellm

from ..config import get_settings

# Per-token pricing (USD) - input / output per token
MODEL_PRICING = {
    "gpt-4.1-mini": {"input": 0.15 / 1_000_000, "output": 0.60 / 1_000_000},
    "gpt-4.1": {"input": 2.50 / 1_000_000, "output": 10.00 / 1_000_000},
    "claude-sonnet-4-6": {"input": 3.00 / 1_000_000, "output": 15.00 / 1_000_000},
    "gemini/gemini-2.5-pro": {"input": 1.25 / 1_000_000, "output": 5.00 / 1_000_000},
}

# Tier -> ordered list of models to try (first = primary, rest = fallbacks)
TIER_ROUTING = {
    "simple": ["gpt-4.1-mini", "gemini/gemini-2.5-pro"],
    "moderate": ["gpt-4.1", "gemini/gemini-2.5-pro", "gpt-4.1-mini"],
    "complex": ["claude-sonnet-4-6", "gpt-4.1", "gemini/gemini-2.5-pro"],
}

# Provider prefix mapping for litellm
PROVIDER_FOR_MODEL = {
    "gpt-4.1-mini": "openai",
    "gpt-4.1": "openai",
    "claude-sonnet-4-6": "anthropic",
    "gemini/gemini-2.5-pro": "google",
}


def _provider_name(model: str) -> str:
    return PROVIDER_FOR_MODEL.get(model, "unknown")


def _get_api_key(model: str) -> Optional[str]:
    settings = get_settings()
    provider = _provider_name(model)
    return {
        "openai": settings.openai_api_key,
        "anthropic": settings.anthropic_api_key,
        "google": settings.google_api_key,
    }.get(provider)


def compute_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    pricing = MODEL_PRICING.get(model, {"input": 0.0, "output": 0.0})
    return input_tokens * pricing["input"] + output_tokens * pricing["output"]


def hash_prompt(prompt: str) -> str:
    return hashlib.sha256(prompt.encode("utf-8")).hexdigest()


async def route_completion(
    messages: list[dict],
    task_tier: str = "simple",
    max_retries: int = 2,
) -> dict:
    """Route an LLM call based on task tier with fallback chain.

    Returns dict with: model, provider, response_text, input_tokens,
    output_tokens, total_tokens, cost_usd, latency_ms, status, error_message.
    """
    models = TIER_ROUTING.get(task_tier, TIER_ROUTING["simple"])
    last_error: Optional[str] = None

    for model in models:
        api_key = _get_api_key(model)
        for attempt in range(max_retries):
            start = time.perf_counter()
            try:
                response = await litellm.acompletion(
                    model=model,
                    messages=messages,
                    api_key=api_key or None,
                    timeout=30,
                )
                elapsed_ms = (time.perf_counter() - start) * 1000
                usage = response.usage
                input_tokens = usage.prompt_tokens or 0
                output_tokens = usage.completion_tokens or 0
                total_tokens = input_tokens + output_tokens
                cost = compute_cost(model, input_tokens, output_tokens)

                return {
                    "model": model,
                    "provider": _provider_name(model),
                    "response_text": response.choices[0].message.content,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": total_tokens,
                    "cost_usd": round(cost, 6),
                    "latency_ms": round(elapsed_ms, 1),
                    "status": "success",
                    "error_message": None,
                }
            except Exception as exc:
                last_error = f"{model} attempt {attempt + 1}: {exc}"
                elapsed_ms = (time.perf_counter() - start) * 1000

    # All models and retries exhausted
    return {
        "model": models[0],
        "provider": _provider_name(models[0]),
        "response_text": None,
        "input_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
        "cost_usd": 0.0,
        "latency_ms": 0.0,
        "status": "error",
        "error_message": last_error or "All models failed",
    }
