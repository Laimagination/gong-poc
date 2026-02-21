"""
Four-dimension weighted scoring model for workflow automation prioritization.

Dimensions:
  - revenue_impact (0-10): How directly this impacts revenue
  - headcount_pressure (0-10): Based on open roles and headcount strain
  - implementation_complexity (0-10, inverted: 10 = easy): Based on build hours
  - self_service_potential (0-10): How much this enables self-service
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

DATA_DIR = Path(__file__).resolve().parent / "data"
WEIGHTS_FILE = DATA_DIR / "score_weights.json"

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ScoreWeights(BaseModel):
    revenue_impact: float = Field(0.30, ge=0, le=1)
    headcount_pressure: float = Field(0.20, ge=0, le=1)
    implementation_complexity: float = Field(0.25, ge=0, le=1)
    self_service_potential: float = Field(0.25, ge=0, le=1)


class WorkflowScores(BaseModel):
    revenue_impact: float
    headcount_pressure: float
    implementation_complexity: float
    self_service_potential: float
    composite: float


class ScoredWorkflow(BaseModel):
    id: str
    name: str
    department: str
    description: str
    scores: WorkflowScores
    annual_cost_savings_usd: int
    estimated_build_hours: int
    jim_principles: list[str]
    rank: int = 0


# ---------------------------------------------------------------------------
# Data loaders (cached at module level on first call)
# ---------------------------------------------------------------------------

_departments: list[dict] | None = None
_workflows: list[dict] | None = None


def _load_departments() -> list[dict]:
    global _departments
    if _departments is None:
        with open(DATA_DIR / "departments.json", encoding="utf-8") as f:
            _departments = json.load(f)
    return _departments


def _load_workflows() -> list[dict]:
    global _workflows
    if _workflows is None:
        with open(DATA_DIR / "workflows.json", encoding="utf-8") as f:
            _workflows = json.load(f)
    return _workflows


def get_departments() -> list[dict]:
    return _load_departments()


def get_workflows() -> list[dict]:
    return _load_workflows()


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

# Revenue-adjacent departments get higher base revenue_impact.
_REVENUE_WEIGHT: dict[str, float] = {
    "sales": 1.0,
    "customer_success": 0.85,
    "marketing": 0.70,
    "finance": 0.55,
    "product": 0.50,
    "support": 0.45,
    "engineering": 0.40,
    "legal": 0.35,
    "people_hr": 0.25,
    "it": 0.20,
}


def _dept_lookup() -> dict[str, dict]:
    return {d["id"]: d for d in _load_departments()}


def _score_revenue_impact(wf: dict) -> float:
    """Score 0-10 based on department revenue proximity and annual savings."""
    dept_factor = _REVENUE_WEIGHT.get(wf["department"], 0.3)
    # Normalize savings: 200k+ -> 10, scale logarithmically
    savings = wf.get("annual_cost_savings_usd", 0)
    savings_factor = min(math.log10(max(savings, 1)) / math.log10(250_000), 1.0)
    return round(min((dept_factor * 5 + savings_factor * 5), 10), 2)


def _score_headcount_pressure(wf: dict) -> float:
    """Score 0-10 based on open roles ratio in the department."""
    depts = _dept_lookup()
    dept = depts.get(wf["department"])
    if not dept:
        return 5.0
    ratio = dept["open_roles"] / max(dept["headcount"], 1)
    # Ratio of 0.15+ -> 10, 0 -> 0
    return round(min(ratio / 0.15 * 10, 10), 2)


def _score_implementation_complexity(wf: dict) -> float:
    """Score 0-10 where 10 = easiest to implement (inverted complexity)."""
    hours = wf.get("estimated_build_hours", 80)
    # 20 hours -> 10, 120 hours -> 1
    score = 10 - ((hours - 20) / (120 - 20)) * 9
    return round(max(min(score, 10), 1), 2)


def _score_self_service_potential(wf: dict) -> float:
    """Score 0-10 based on Jim's self-service principle alignment."""
    principles = wf.get("jim_principles", [])
    base = 3.0
    if "self_service" in principles:
        base += 4.0
    if "deal_standardization" in principles:
        base += 1.5
    if "unified_data" in principles:
        base += 1.0
    if "do_not_automate" in principles:
        base = 1.0
    return round(min(base, 10), 2)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

# Module-level mutable weights (can be updated via API).
# Load persisted weights from JSON if available, otherwise use defaults.
def _load_persisted_weights() -> ScoreWeights:
    if WEIGHTS_FILE.exists():
        with open(WEIGHTS_FILE, encoding="utf-8") as f:
            return ScoreWeights(**json.load(f))
    return ScoreWeights()

_current_weights = _load_persisted_weights()


def score_workflow(wf: dict, weights: ScoreWeights | None = None) -> ScoredWorkflow:
    """Score a single workflow across all four dimensions."""
    w = weights or _current_weights

    ri = _score_revenue_impact(wf)
    hp = _score_headcount_pressure(wf)
    ic = _score_implementation_complexity(wf)
    sp = _score_self_service_potential(wf)

    composite = round(
        w.revenue_impact * ri
        + w.headcount_pressure * hp
        + w.implementation_complexity * ic
        + w.self_service_potential * sp,
        2,
    )

    return ScoredWorkflow(
        id=wf["id"],
        name=wf["name"],
        department=wf["department"],
        description=wf["description"],
        scores=WorkflowScores(
            revenue_impact=ri,
            headcount_pressure=hp,
            implementation_complexity=ic,
            self_service_potential=sp,
            composite=composite,
        ),
        annual_cost_savings_usd=wf["annual_cost_savings_usd"],
        estimated_build_hours=wf["estimated_build_hours"],
        jim_principles=wf.get("jim_principles", []),
    )


def rank_all(weights: ScoreWeights | None = None) -> list[ScoredWorkflow]:
    """Score and rank every workflow, returning them sorted by composite score descending."""
    w = weights or _current_weights
    scored = [score_workflow(wf, w) for wf in _load_workflows()]
    scored.sort(key=lambda s: s.scores.composite, reverse=True)
    for idx, item in enumerate(scored, start=1):
        item.rank = idx
    return scored


def update_weights(new_weights: ScoreWeights) -> ScoreWeights:
    """Update the module-level scoring weights, persist to JSON, and return them."""
    global _current_weights
    _current_weights = new_weights
    with open(WEIGHTS_FILE, "w", encoding="utf-8") as f:
        json.dump(new_weights.model_dump(), f, indent=2)
    return _current_weights


def get_current_weights() -> ScoreWeights:
    return _current_weights
