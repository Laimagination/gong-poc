"""
Product backlog generator.

Converts scored & ranked workflows into product backlog items with:
  - User story in standard format
  - Acceptance criteria (3-5 per item)
  - Estimated ROI
  - Effort estimate (S / M / L / XL)
  - Jim's principles tags
"""

from __future__ import annotations

from pydantic import BaseModel

from .scoring import ScoredWorkflow, ScoreWeights, rank_all


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class BacklogItem(BaseModel):
    id: str
    workflow_id: str
    title: str
    user_story: str
    acceptance_criteria: list[str]
    effort: str  # S, M, L, XL
    estimated_roi_usd: int
    composite_score: float
    jim_principles: list[str]
    department: str
    rank: int


# ---------------------------------------------------------------------------
# Mapping helpers
# ---------------------------------------------------------------------------

_DEPARTMENT_ROLE: dict[str, str] = {
    "sales": "Sales Rep",
    "customer_success": "Customer Success Manager",
    "marketing": "Marketing Manager",
    "support": "Support Agent",
    "engineering": "Engineering Manager",
    "product": "Product Manager",
    "finance": "Finance Analyst",
    "legal": "Legal Counsel",
    "people_hr": "People Operations Lead",
    "it": "IT Administrator",
}


def _effort_from_hours(hours: int) -> str:
    if hours <= 40:
        return "S"
    if hours <= 70:
        return "M"
    if hours <= 100:
        return "L"
    return "XL"


def _generate_acceptance_criteria(wf: ScoredWorkflow) -> list[str]:
    """Generate 3-5 acceptance criteria based on the workflow characteristics."""
    criteria: list[str] = []

    criteria.append(
        f"System integrates with {_primary_tool(wf)} and produces output within 30 seconds of trigger."
    )
    criteria.append(
        "Output matches or exceeds quality of current manual process as validated by department stakeholder."
    )
    criteria.append(
        "Automation includes error handling with Slack notification on failure."
    )

    if "self_service" in wf.jim_principles:
        criteria.append(
            "End users can trigger and configure the automation without engineering involvement."
        )
    if "deal_standardization" in wf.jim_principles:
        criteria.append(
            "Process follows standardized templates approved by Revenue Operations."
        )
    if "unified_data" in wf.jim_principles:
        criteria.append(
            "All data sources are consolidated into a single view with no manual copy-paste."
        )

    # Ensure at least 3, at most 5
    return criteria[:5]


def _primary_tool(wf: ScoredWorkflow) -> str:
    """Return a readable mention of the key tools for acceptance criteria."""
    # Use the workflow description to stay generic; real data has current_tools
    return "all required source systems"


def _build_user_story(wf: ScoredWorkflow) -> str:
    role = _DEPARTMENT_ROLE.get(wf.department, "Team Member")
    # Derive capability and benefit from the workflow
    capability = wf.name.lower()
    benefit = (
        f"reduce manual effort by ~{wf.estimated_build_hours} build-hours worth of automation "
        f"and save ${wf.annual_cost_savings_usd:,}/year"
    )
    return f"As a {role}, I want automated {capability} so that I can {benefit}."


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_backlog(weights: ScoreWeights | None = None) -> list[BacklogItem]:
    """Generate a full product backlog from scored workflows."""
    ranked = rank_all(weights)
    items: list[BacklogItem] = []

    for wf in ranked:
        item = BacklogItem(
            id=f"BLI-{wf.id.replace('wf-', '')}",
            workflow_id=wf.id,
            title=f"Automate: {wf.name}",
            user_story=_build_user_story(wf),
            acceptance_criteria=_generate_acceptance_criteria(wf),
            effort=_effort_from_hours(wf.estimated_build_hours),
            estimated_roi_usd=wf.annual_cost_savings_usd,
            composite_score=wf.scores.composite,
            jim_principles=wf.jim_principles,
            department=wf.department,
            rank=wf.rank,
        )
        items.append(item)

    return items
