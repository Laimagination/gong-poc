from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.sql import func
from .database import Base


class AIRequest(Base):
    """Tracks every LLM API call for governance/audit."""
    __tablename__ = "ai_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, server_default=func.now(), index=True)
    department = Column(String(100), index=True)
    user_id = Column(String(100))
    model = Column(String(100), index=True)
    provider = Column(String(50))
    task_tier = Column(String(20))  # simple, moderate, complex
    prompt_hash = Column(String(64))
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    latency_ms = Column(Float, default=0.0)
    status = Column(String(20), default="success")  # success, error, timeout
    error_message = Column(Text, nullable=True)


class AIProject(Base):
    """Tracks an AI automation project through the AIMS lifecycle."""
    __tablename__ = "ai_projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(String(20), index=True)        # Links to POC 2 wf-001..wf-040
    name = Column(String(200))
    department = Column(String(100), index=True)
    status = Column(String(30), index=True, default="proposed")
    risk_level = Column(String(20), default="medium")    # low, medium, high, critical

    # ISO 42005 Impact Assessment scores (0-10)
    impact_stakeholder = Column(Float, default=0.0)
    impact_ethical = Column(Float, default=0.0)
    impact_legal = Column(Float, default=0.0)
    impact_operational = Column(Float, default=0.0)
    risk_score = Column(Float, default=0.0)
    benefit_score = Column(Float, default=0.0)

    # Approval tracking
    approved_by = Column(JSON, default=list)
    approval_date = Column(DateTime, nullable=True)

    # Lifecycle metadata
    owner = Column(String(100))
    review_due = Column(DateTime, nullable=True)
    last_reviewed = Column(DateTime, nullable=True)
    controls = Column(JSON, default=list)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class AIMSEvent(Base):
    """Audit trail for every lifecycle action on an AI project."""
    __tablename__ = "aims_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, index=True)
    timestamp = Column(DateTime, server_default=func.now(), index=True)
    event_type = Column(String(50))      # status_change, assessment, approval, review, incident
    from_status = Column(String(30), nullable=True)
    to_status = Column(String(30), nullable=True)
    actor = Column(String(100))
    detail = Column(Text, nullable=True)
