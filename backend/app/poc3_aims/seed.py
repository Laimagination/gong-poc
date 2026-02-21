"""
Seed data generator for POC 3: AIMS lifecycle.

Creates 40 AIProject records (one per POC 2 workflow) with deterministic
risk/benefit scores and 3-8 AIMSEvent records each tracing lifecycle history.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta

from sqlalchemy import select, func

from ..database import async_session
from ..models import AIProject, AIMSEvent
from ..poc2_discovery.scoring import score_workflow, get_workflows
from .impact_assessment import compute_risk, compute_benefit_score


# Status distribution for the 40 workflows (indices into sorted-by-id list)
_STATUS_DISTRIBUTION: list[tuple[str, int]] = [
    ("proposed", 5),
    ("impact_assessed", 5),
    ("approved", 6),
    ("in_development", 8),
    ("deployed", 5),
    ("monitoring", 5),
    ("under_review", 3),
    ("on_hold", 2),
    ("retired", 1),
]

# Lifecycle path each status has passed through to reach current state
_STATUS_PATH: dict[str, list[str]] = {
    "proposed": ["proposed"],
    "impact_assessed": ["proposed", "impact_assessed"],
    "approved": ["proposed", "impact_assessed", "approved"],
    "in_development": ["proposed", "impact_assessed", "approved", "in_development"],
    "deployed": ["proposed", "impact_assessed", "approved", "in_development", "deployed"],
    "monitoring": ["proposed", "impact_assessed", "approved", "in_development", "deployed", "monitoring"],
    "under_review": ["proposed", "impact_assessed", "approved", "in_development", "deployed", "monitoring", "under_review"],
    "on_hold": ["proposed", "impact_assessed", "approved", "on_hold"],
    "retired": ["proposed", "impact_assessed", "approved", "in_development", "deployed", "monitoring", "retired"],
}

# Owners per department
_OWNERS: dict[str, list[str]] = {
    "sales": ["Sarah Chen", "Mike Torres"],
    "customer_success": ["Lisa Park", "David Kim"],
    "marketing": ["Jen Walsh", "Chris Adams"],
    "support": ["Alex Rivera", "Sam Lee"],
    "engineering": ["Priya Sharma", "James Wu"],
    "product": ["Rachel Green", "Tom Baker"],
    "finance": ["Amy Liu", "Robert Singh"],
    "legal": ["Daniel Cho", "Maria Garcia"],
    "people_hr": ["Karen Wright", "Steve Miller"],
    "it": ["Nate Foster", "Emily Chang"],
}

# Approvers for projects past the approved stage
_APPROVERS = [
    "VP Engineering - Priya Sharma",
    "CISO - Marcus Johnson",
    "Chief AI Officer - Dr. Elena Vasquez",
    "VP Operations - Tom Richards",
    "General Counsel - Daniel Cho",
]

# Actors for events
_ACTORS = [
    "system", "ai-governance-bot", "Elena Vasquez", "Marcus Johnson",
    "Tom Richards", "Sarah Chen", "Priya Sharma", "Daniel Cho",
]


def _build_status_list() -> list[str]:
    """Return a flat list of 40 statuses matching the distribution."""
    result: list[str] = []
    for status, count in _STATUS_DISTRIBUTION:
        result.extend([status] * count)
    return result


def _generate_projects_and_events() -> tuple[list[AIProject], list[AIMSEvent]]:
    """Deterministically generate all 40 projects and their events."""
    random.seed(42)

    workflows = get_workflows()
    statuses = _build_status_list()
    random.shuffle(statuses)

    now = datetime.utcnow()
    projects: list[AIProject] = []
    events: list[AIMSEvent] = []

    for idx, wf in enumerate(workflows):
        target_status = statuses[idx]

        # Score from POC 2
        scored = score_workflow(wf)
        benefit = compute_benefit_score(scored.scores.composite)

        # Risk assessment
        risk = compute_risk(wf)

        # Owner
        dept_owners = _OWNERS.get(wf["department"], ["Unknown Owner"])
        owner = random.choice(dept_owners)

        # Dates
        created_base = now - timedelta(days=random.randint(30, 120))

        # Approval tracking
        path = _STATUS_PATH[target_status]
        approved_by: list[str] = []
        approval_date = None
        if "approved" in path and path.index("approved") < len(path):
            num_approvers = random.randint(2, 3)
            approved_by = random.sample(_APPROVERS, num_approvers)
            approval_date = created_base + timedelta(days=random.randint(5, 15))

        # Review dates
        review_due = None
        last_reviewed = None
        if target_status in ("monitoring", "under_review", "deployed"):
            last_reviewed = now - timedelta(days=random.randint(10, 60))
            # Some overdue reviews to trigger alerts
            if random.random() < 0.3:
                review_due = now - timedelta(days=random.randint(1, 14))
            else:
                review_due = now + timedelta(days=random.randint(7, 60))

        project = AIProject(
            workflow_id=wf["id"],
            name=wf["name"],
            department=wf["department"],
            status=target_status,
            risk_level=risk["risk_level"],
            impact_stakeholder=risk["impact_stakeholder"],
            impact_ethical=risk["impact_ethical"],
            impact_legal=risk["impact_legal"],
            impact_operational=risk["impact_operational"],
            risk_score=risk["risk_score"],
            benefit_score=benefit,
            approved_by=approved_by,
            approval_date=approval_date,
            owner=owner,
            review_due=review_due,
            last_reviewed=last_reviewed,
            controls=risk["controls"],
            notes=None,
            created_at=created_base,
            updated_at=now - timedelta(days=random.randint(0, 5)),
        )
        projects.append(project)

        # Generate events tracing the lifecycle path
        project_id = idx + 1  # Will be auto-assigned sequentially
        event_time = created_base
        prev_status = None

        for step_idx, step_status in enumerate(path):
            event_time = event_time + timedelta(
                days=random.randint(1, 7),
                hours=random.randint(0, 12),
            )

            if step_idx == 0:
                # Creation event
                events.append(AIMSEvent(
                    project_id=project_id,
                    timestamp=event_time,
                    event_type="status_change",
                    from_status=None,
                    to_status="proposed",
                    actor=owner,
                    detail=f"Project '{wf['name']}' created and proposed for assessment",
                ))
            else:
                actor = random.choice(_ACTORS)
                events.append(AIMSEvent(
                    project_id=project_id,
                    timestamp=event_time,
                    event_type="status_change",
                    from_status=prev_status,
                    to_status=step_status,
                    actor=actor,
                    detail=f"Status changed from {prev_status} to {step_status}",
                ))

            # Add assessment event after impact_assessed
            if step_status == "impact_assessed":
                event_time += timedelta(hours=random.randint(1, 8))
                events.append(AIMSEvent(
                    project_id=project_id,
                    timestamp=event_time,
                    event_type="assessment",
                    from_status=None,
                    to_status=None,
                    actor="ai-governance-bot",
                    detail=f"Impact assessment completed. Risk score: {risk['risk_score']}, Level: {risk['risk_level']}",
                ))

            # Add approval event after approved
            if step_status == "approved" and approved_by:
                event_time += timedelta(hours=random.randint(1, 24))
                events.append(AIMSEvent(
                    project_id=project_id,
                    timestamp=event_time,
                    event_type="approval",
                    from_status=None,
                    to_status=None,
                    actor=approved_by[0],
                    detail=f"Approved by {', '.join(approved_by)}",
                ))

            # Add review event for monitoring
            if step_status == "monitoring" and last_reviewed:
                event_time += timedelta(days=random.randint(5, 20))
                events.append(AIMSEvent(
                    project_id=project_id,
                    timestamp=event_time,
                    event_type="review",
                    from_status=None,
                    to_status=None,
                    actor=random.choice(_ACTORS),
                    detail="Periodic review completed. System operating within parameters.",
                ))

            prev_status = step_status

    return projects, events


async def seed_if_empty():
    """Seed AI projects and events if the ai_projects table is empty."""
    async with async_session() as db:
        count_result = await db.execute(select(func.count(AIProject.id)))
        count = count_result.scalar() or 0
        if count > 0:
            return

        projects, events = _generate_projects_and_events()
        db.add_all(projects)
        await db.flush()  # Ensure project IDs are assigned
        db.add_all(events)
        await db.commit()
