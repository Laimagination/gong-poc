"""FastAPI endpoints for POC 3: AI Management System (AIMS)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import AIProject, AIMSEvent
from .lifecycle import transition, is_valid_transition
from .impact_assessment import _load_controls

router = APIRouter()


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class ProjectSummary(BaseModel):
    id: int
    workflow_id: str
    name: str
    department: str
    status: str
    risk_level: str
    risk_score: float
    benefit_score: float
    owner: str
    controls: list[str]
    review_due: Optional[str] = None

    class Config:
        from_attributes = True


class EventOut(BaseModel):
    id: int
    project_id: int
    timestamp: str
    event_type: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    actor: str
    detail: Optional[str] = None

    class Config:
        from_attributes = True


class ProjectDetail(BaseModel):
    id: int
    workflow_id: str
    name: str
    department: str
    status: str
    risk_level: str
    impact_stakeholder: float
    impact_ethical: float
    impact_legal: float
    impact_operational: float
    risk_score: float
    benefit_score: float
    approved_by: list[str]
    approval_date: Optional[str] = None
    owner: str
    review_due: Optional[str] = None
    last_reviewed: Optional[str] = None
    controls: list[str]
    notes: Optional[str] = None
    created_at: str
    updated_at: str
    events: list[EventOut] = []

    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    total_projects: int
    by_status: dict[str, int]
    by_risk_level: dict[str, int]
    by_department: dict[str, int]
    overdue_reviews: int
    avg_risk_score: float
    avg_benefit_score: float


class RiskMatrixItem(BaseModel):
    id: int
    name: str
    department: str
    status: str
    risk_score: float
    benefit_score: float
    risk_level: str


class ControlOut(BaseModel):
    id: str
    name: str
    category: str
    description: str
    project_count: int


class TimelineEvent(BaseModel):
    id: int
    project_id: int
    project_name: str
    timestamp: str
    event_type: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    actor: str
    detail: Optional[str] = None


class TransitionRequest(BaseModel):
    to_status: str
    actor: str


# ---------------------------------------------------------------------------
# Helper to serialize datetimes
# ---------------------------------------------------------------------------

def _dt(val) -> Optional[str]:
    if val is None:
        return None
    return val.isoformat()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(db: AsyncSession = Depends(get_db)):
    """Summary stats for the AIMS dashboard."""
    result = await db.execute(select(AIProject))
    projects = result.scalars().all()

    by_status: dict[str, int] = {}
    by_risk: dict[str, int] = {}
    by_dept: dict[str, int] = {}
    overdue = 0
    total_risk = 0.0
    total_benefit = 0.0

    from datetime import datetime
    now = datetime.utcnow()

    for p in projects:
        by_status[p.status] = by_status.get(p.status, 0) + 1
        by_risk[p.risk_level] = by_risk.get(p.risk_level, 0) + 1
        by_dept[p.department] = by_dept.get(p.department, 0) + 1
        total_risk += p.risk_score
        total_benefit += p.benefit_score
        if p.review_due and p.review_due < now:
            overdue += 1

    n = len(projects) or 1
    return DashboardResponse(
        total_projects=len(projects),
        by_status=by_status,
        by_risk_level=by_risk,
        by_department=by_dept,
        overdue_reviews=overdue,
        avg_risk_score=round(total_risk / n, 2),
        avg_benefit_score=round(total_benefit / n, 2),
    )


@router.get("/projects", response_model=list[ProjectSummary])
async def list_projects(
    status: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List all 40 projects with optional filters."""
    query = select(AIProject)
    if status:
        query = query.where(AIProject.status == status)
    if risk_level:
        query = query.where(AIProject.risk_level == risk_level)
    if department:
        query = query.where(AIProject.department == department)
    query = query.order_by(AIProject.id)

    result = await db.execute(query)
    projects = result.scalars().all()

    return [
        ProjectSummary(
            id=p.id,
            workflow_id=p.workflow_id,
            name=p.name,
            department=p.department,
            status=p.status,
            risk_level=p.risk_level,
            risk_score=p.risk_score,
            benefit_score=p.benefit_score,
            owner=p.owner,
            controls=p.controls or [],
            review_due=_dt(p.review_due),
        )
        for p in projects
    ]


@router.get("/projects/{project_id}", response_model=ProjectDetail)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    """Single project with full details and event history."""
    result = await db.execute(
        select(AIProject).where(AIProject.id == project_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    events_result = await db.execute(
        select(AIMSEvent)
        .where(AIMSEvent.project_id == project_id)
        .order_by(AIMSEvent.timestamp)
    )
    events = events_result.scalars().all()

    return ProjectDetail(
        id=p.id,
        workflow_id=p.workflow_id,
        name=p.name,
        department=p.department,
        status=p.status,
        risk_level=p.risk_level,
        impact_stakeholder=p.impact_stakeholder,
        impact_ethical=p.impact_ethical,
        impact_legal=p.impact_legal,
        impact_operational=p.impact_operational,
        risk_score=p.risk_score,
        benefit_score=p.benefit_score,
        approved_by=p.approved_by or [],
        approval_date=_dt(p.approval_date),
        owner=p.owner,
        review_due=_dt(p.review_due),
        last_reviewed=_dt(p.last_reviewed),
        controls=p.controls or [],
        notes=p.notes,
        created_at=_dt(p.created_at),
        updated_at=_dt(p.updated_at),
        events=[
            EventOut(
                id=e.id,
                project_id=e.project_id,
                timestamp=_dt(e.timestamp),
                event_type=e.event_type,
                from_status=e.from_status,
                to_status=e.to_status,
                actor=e.actor,
                detail=e.detail,
            )
            for e in events
        ],
    )


@router.get("/risk-matrix", response_model=list[RiskMatrixItem])
async def risk_matrix(db: AsyncSession = Depends(get_db)):
    """Risk vs Benefit scatter data for all projects."""
    result = await db.execute(select(AIProject).order_by(AIProject.id))
    projects = result.scalars().all()
    return [
        RiskMatrixItem(
            id=p.id,
            name=p.name,
            department=p.department,
            status=p.status,
            risk_score=p.risk_score,
            benefit_score=p.benefit_score,
            risk_level=p.risk_level,
        )
        for p in projects
    ]


@router.get("/controls", response_model=list[ControlOut])
async def list_controls(db: AsyncSession = Depends(get_db)):
    """ISO 42001 controls with project counts."""
    controls_data = _load_controls()

    # Count projects per control
    result = await db.execute(select(AIProject))
    projects = result.scalars().all()

    control_counts: dict[str, int] = {}
    for p in projects:
        for cid in (p.controls or []):
            control_counts[cid] = control_counts.get(cid, 0) + 1

    return [
        ControlOut(
            id=c["id"],
            name=c["name"],
            category=c["category"],
            description=c["description"],
            project_count=control_counts.get(c["id"], 0),
        )
        for c in controls_data
    ]


@router.get("/timeline", response_model=list[TimelineEvent])
async def timeline(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Recent events across all projects."""
    # Get events with project names via a join-like approach
    events_result = await db.execute(
        select(AIMSEvent).order_by(desc(AIMSEvent.timestamp)).limit(limit)
    )
    events = events_result.scalars().all()

    # Fetch project names for these events
    project_ids = list({e.project_id for e in events})
    if project_ids:
        projects_result = await db.execute(
            select(AIProject).where(AIProject.id.in_(project_ids))
        )
        proj_map = {p.id: p.name for p in projects_result.scalars().all()}
    else:
        proj_map = {}

    return [
        TimelineEvent(
            id=e.id,
            project_id=e.project_id,
            project_name=proj_map.get(e.project_id, "Unknown"),
            timestamp=_dt(e.timestamp),
            event_type=e.event_type,
            from_status=e.from_status,
            to_status=e.to_status,
            actor=e.actor,
            detail=e.detail,
        )
        for e in events
    ]


@router.post("/projects/{project_id}/transition", response_model=ProjectDetail)
async def transition_project(
    project_id: int,
    body: TransitionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Transition a project to a new lifecycle status."""
    result = await db.execute(
        select(AIProject).where(AIProject.id == project_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        t = transition(p.status, body.to_status, body.actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Apply project updates
    for key, val in t["project_updates"].items():
        setattr(p, key, val)

    # Create event
    event = AIMSEvent(
        project_id=project_id,
        **t["event"],
    )
    db.add(event)
    await db.commit()
    await db.refresh(p)

    # Re-fetch events for response
    events_result = await db.execute(
        select(AIMSEvent)
        .where(AIMSEvent.project_id == project_id)
        .order_by(AIMSEvent.timestamp)
    )
    events = events_result.scalars().all()

    return ProjectDetail(
        id=p.id,
        workflow_id=p.workflow_id,
        name=p.name,
        department=p.department,
        status=p.status,
        risk_level=p.risk_level,
        impact_stakeholder=p.impact_stakeholder,
        impact_ethical=p.impact_ethical,
        impact_legal=p.impact_legal,
        impact_operational=p.impact_operational,
        risk_score=p.risk_score,
        benefit_score=p.benefit_score,
        approved_by=p.approved_by or [],
        approval_date=_dt(p.approval_date),
        owner=p.owner,
        review_due=_dt(p.review_due),
        last_reviewed=_dt(p.last_reviewed),
        controls=p.controls or [],
        notes=p.notes,
        created_at=_dt(p.created_at),
        updated_at=_dt(p.updated_at),
        events=[
            EventOut(
                id=e.id,
                project_id=e.project_id,
                timestamp=_dt(e.timestamp),
                event_type=e.event_type,
                from_status=e.from_status,
                to_status=e.to_status,
                actor=e.actor,
                detail=e.detail,
            )
            for e in events
        ],
    )
