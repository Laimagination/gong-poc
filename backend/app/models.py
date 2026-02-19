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


class OnboardingWorkflow(Base):
    """Tracks onboarding workflow instances."""
    __tablename__ = "onboarding_workflows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    new_hire_name = Column(String(200))
    department = Column(String(100))
    role = Column(String(200))
    start_date = Column(String(20))
    status = Column(String(20), default="pending")  # pending, running, completed, failed
    progress_pct = Column(Float, default=0.0)
    steps = Column(JSON, default=list)
    current_step = Column(String(100), nullable=True)
