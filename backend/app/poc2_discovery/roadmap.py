"""
90-day phased roadmap builder.

Assigns backlog items to three phases:
  - Quick Wins  (weeks 1-4):  composite >= 7 AND complexity score >= 6 (easy)
  - Medium-Term (weeks 5-8):  composite >= 5
  - Strategic   (weeks 9-12): remaining high-value items

Each phase includes projected total ROI.
"""

from __future__ import annotations

from pydantic import BaseModel

from .backlog import BacklogItem, generate_backlog
from .scoring import ScoreWeights, rank_all


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class RoadmapItem(BaseModel):
    backlog_id: str
    workflow_id: str
    title: str
    department: str
    effort: str
    composite_score: float
    estimated_roi_usd: int
    jim_principles: list[str]


class RoadmapPhase(BaseModel):
    phase: int
    name: str
    weeks: str
    description: str
    items: list[RoadmapItem]
    total_roi_usd: int
    total_build_hours: int


class Roadmap(BaseModel):
    phases: list[RoadmapPhase]
    total_roi_usd: int
    total_items: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_EFFORT_HOURS: dict[str, int] = {"S": 35, "M": 55, "L": 85, "XL": 110}


def _to_roadmap_item(bli: BacklogItem) -> RoadmapItem:
    return RoadmapItem(
        backlog_id=bli.id,
        workflow_id=bli.workflow_id,
        title=bli.title,
        department=bli.department,
        effort=bli.effort,
        composite_score=bli.composite_score,
        estimated_roi_usd=bli.estimated_roi_usd,
        jim_principles=bli.jim_principles,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_roadmap(weights: ScoreWeights | None = None) -> Roadmap:
    """Assign backlog items to 90-day phases."""
    backlog = generate_backlog(weights)
    scored_map = {sw.id: sw for sw in rank_all(weights)}

    quick_wins: list[BacklogItem] = []
    medium_term: list[BacklogItem] = []
    strategic: list[BacklogItem] = []

    for bli in backlog:
        sw = scored_map.get(bli.workflow_id)
        complexity_score = sw.scores.implementation_complexity if sw else 5.0

        if bli.composite_score >= 7.0 and complexity_score >= 6.0:
            quick_wins.append(bli)
        elif bli.composite_score >= 5.0:
            medium_term.append(bli)
        else:
            strategic.append(bli)

    def _build_phase(
        phase: int,
        name: str,
        weeks: str,
        description: str,
        items: list[BacklogItem],
    ) -> RoadmapPhase:
        ri = [_to_roadmap_item(b) for b in items]
        total_roi = sum(b.estimated_roi_usd for b in items)
        total_hours = sum(_EFFORT_HOURS.get(b.effort, 55) for b in items)
        return RoadmapPhase(
            phase=phase,
            name=name,
            weeks=weeks,
            description=description,
            items=ri,
            total_roi_usd=total_roi,
            total_build_hours=total_hours,
        )

    phases = [
        _build_phase(
            1,
            "Quick Wins",
            "1-4",
            "High-score, low-complexity automations that deliver immediate value and build momentum.",
            quick_wins,
        ),
        _build_phase(
            2,
            "Medium-Term",
            "5-8",
            "Solid-score automations requiring moderate integration effort; builds on Quick Win infrastructure.",
            medium_term,
        ),
        _build_phase(
            3,
            "Strategic",
            "9-12",
            "Complex, high-value initiatives that require deeper integration or cross-functional coordination.",
            strategic,
        ),
    ]

    return Roadmap(
        phases=phases,
        total_roi_usd=sum(p.total_roi_usd for p in phases),
        total_items=sum(len(p.items) for p in phases),
    )
