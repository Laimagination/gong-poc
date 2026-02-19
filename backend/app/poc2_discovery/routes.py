"""
FastAPI routes for POC 2: Mining for Gold Discovery Engine.

Endpoints:
  GET  /departments     - List all Gong departments with metadata
  GET  /workflows       - List all scored and ranked workflows
  GET  /backlog         - Generate the prioritized product backlog
  GET  /roadmap         - Build the 90-day phased roadmap
  PUT  /score-weights   - Update the four-dimension scoring weights
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .scoring import (
    ScoreWeights,
    ScoredWorkflow,
    get_current_weights,
    get_departments,
    rank_all,
    update_weights,
)
from .backlog import BacklogItem, generate_backlog
from .roadmap import Roadmap, build_roadmap

router = APIRouter()


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class DepartmentOut(BaseModel):
    id: str
    name: str
    headcount: int
    open_roles: int
    key_tools: list[str]
    manual_workflows: list[str]


class DepartmentsResponse(BaseModel):
    departments: list[DepartmentOut]
    total_headcount: int
    total_open_roles: int


class WorkflowsResponse(BaseModel):
    workflows: list[ScoredWorkflow]
    weights: ScoreWeights
    total_annual_savings_usd: int


class BacklogResponse(BaseModel):
    items: list[BacklogItem]
    total_items: int
    total_estimated_roi_usd: int
    weights: ScoreWeights


class WeightsUpdateRequest(BaseModel):
    revenue_impact: float = Field(0.30, ge=0, le=1)
    headcount_pressure: float = Field(0.20, ge=0, le=1)
    implementation_complexity: float = Field(0.25, ge=0, le=1)
    self_service_potential: float = Field(0.25, ge=0, le=1)


class WeightsResponse(BaseModel):
    weights: ScoreWeights
    message: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/departments", response_model=DepartmentsResponse)
async def list_departments():
    """Return all Gong departments with headcount and workflow metadata."""
    depts = get_departments()
    return DepartmentsResponse(
        departments=[DepartmentOut(**d) for d in depts],
        total_headcount=sum(d["headcount"] for d in depts),
        total_open_roles=sum(d["open_roles"] for d in depts),
    )


@router.get("/workflows", response_model=WorkflowsResponse)
async def list_workflows():
    """Return all workflows scored and ranked by the current weights."""
    ranked = rank_all()
    return WorkflowsResponse(
        workflows=ranked,
        weights=get_current_weights(),
        total_annual_savings_usd=sum(w.annual_cost_savings_usd for w in ranked),
    )


@router.get("/backlog", response_model=BacklogResponse)
async def get_backlog():
    """Generate the prioritized product backlog from scored workflows."""
    items = generate_backlog()
    return BacklogResponse(
        items=items,
        total_items=len(items),
        total_estimated_roi_usd=sum(i.estimated_roi_usd for i in items),
        weights=get_current_weights(),
    )


@router.get("/roadmap", response_model=Roadmap)
async def get_roadmap():
    """Build the 90-day phased roadmap."""
    return build_roadmap()


@router.put("/score-weights", response_model=WeightsResponse)
async def set_score_weights(body: WeightsUpdateRequest):
    """Update the four-dimension scoring weights.

    Weights should sum to approximately 1.0 for meaningful composite scores,
    but this is not strictly enforced to allow experimentation.
    """
    total = (
        body.revenue_impact
        + body.headcount_pressure
        + body.implementation_complexity
        + body.self_service_potential
    )
    if abs(total - 1.0) > 0.01:
        raise HTTPException(
            status_code=422,
            detail=f"Weights must sum to 1.0 (got {total:.4f}). "
            "Adjust values so they add up correctly.",
        )

    new_weights = ScoreWeights(
        revenue_impact=body.revenue_impact,
        headcount_pressure=body.headcount_pressure,
        implementation_complexity=body.implementation_complexity,
        self_service_potential=body.self_service_potential,
    )
    updated = update_weights(new_weights)
    return WeightsResponse(
        weights=updated,
        message="Scoring weights updated. Re-fetch /workflows, /backlog, or /roadmap to see new rankings.",
    )
