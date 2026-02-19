"""FastAPI routes for POC 3: AI Onboarding Orchestrator."""

import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import OnboardingWorkflow
from .mock_apis import greenhouse
from .workflow import (
    run_onboarding_workflow,
    run_onboarding_workflow_streaming,
    get_graph_visualization,
)

router = APIRouter()


# --- Request/Response Models ---

class TriggerRequest(BaseModel):
    name: str
    department: str
    role: str
    start_date: str
    email: str | None = None
    manager: str | None = None
    location: str | None = None


class OnboardingStatus(BaseModel):
    id: int
    new_hire_name: str
    department: str
    role: str
    start_date: str
    status: str
    progress_pct: float
    steps: list
    current_step: str | None
    created_at: str
    updated_at: str


# --- Active workflow tracking for WebSocket ---
_active_workflows: dict[int, dict] = {}
_ws_connections: dict[int, list[WebSocket]] = {}


# --- Endpoints ---

@router.post("/trigger")
async def trigger_onboarding(req: TriggerRequest, db: AsyncSession = Depends(get_db)):
    """Start a new onboarding workflow."""
    # Generate email if not provided
    email = req.email or f"{req.name.lower().replace(' ', '.')}@company.com"

    # Create Greenhouse hire record
    gh_result = await greenhouse.create_hire(
        name=req.name,
        email=email,
        department=req.department,
        role=req.role,
        start_date=req.start_date,
        manager=req.manager or "TBD",
        location=req.location or "Office",
    )

    hire_info = gh_result["data"]

    # Create DB record
    workflow = OnboardingWorkflow(
        new_hire_name=req.name,
        department=req.department,
        role=req.role,
        start_date=req.start_date,
        status="running",
        progress_pct=0.0,
        steps=[],
        current_step="receive_hire",
    )
    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)

    workflow_id = workflow.id

    # Run workflow in background
    asyncio.create_task(_run_workflow_background(workflow_id, hire_info))

    return {
        "id": workflow_id,
        "status": "running",
        "message": f"Onboarding started for {req.name} ({req.department} - {req.role})",
        "hire_id": hire_info["hire_id"],
        "ws_url": f"/api/onboarding/ws/{workflow_id}",
    }


async def _run_workflow_background(workflow_id: int, hire_info: dict):
    """Run the onboarding workflow in the background, updating DB and WebSocket clients."""
    from ..database import async_session

    _active_workflows[workflow_id] = {"status": "running", "state": None}

    try:
        async for node_name, state in run_onboarding_workflow_streaming(hire_info):
            # Update tracking
            _active_workflows[workflow_id]["state"] = state

            # Prepare state snapshot for WebSocket broadcast
            snapshot = _state_to_snapshot(workflow_id, node_name, state)

            # Notify WebSocket clients
            await _broadcast_to_ws(workflow_id, snapshot)

            # Update DB periodically
            async with async_session() as db:
                wf = await db.get(OnboardingWorkflow, workflow_id)
                if wf:
                    wf.status = state.get("status", "running")
                    wf.progress_pct = state.get("progress", 0.0)
                    wf.steps = state.get("steps", [])
                    wf.current_step = state.get("current_step")
                    wf.updated_at = datetime.now()
                    await db.commit()

        # Final update
        async with async_session() as db:
            wf = await db.get(OnboardingWorkflow, workflow_id)
            if wf:
                final_state = _active_workflows[workflow_id].get("state", {})
                wf.status = "completed"
                wf.progress_pct = 100.0
                wf.steps = final_state.get("steps", [])
                wf.current_step = None
                wf.updated_at = datetime.now()
                await db.commit()

        _active_workflows[workflow_id]["status"] = "completed"

    except Exception as e:
        _active_workflows[workflow_id]["status"] = "failed"
        async with async_session() as db:
            wf = await db.get(OnboardingWorkflow, workflow_id)
            if wf:
                wf.status = "failed"
                wf.updated_at = datetime.now()
                await db.commit()

        await _broadcast_to_ws(workflow_id, {
            "workflow_id": workflow_id,
            "event": "error",
            "error": str(e),
        })


def _state_to_snapshot(workflow_id: int, node_name: str, state: dict) -> dict:
    """Convert workflow state to a JSON-serializable snapshot."""
    messages = state.get("messages", [])
    latest_message = messages[-1] if messages else None

    return {
        "workflow_id": workflow_id,
        "event": "step_update",
        "node": node_name,
        "status": state.get("status", "running"),
        "progress": state.get("progress", 0.0),
        "current_step": state.get("current_step"),
        "steps": state.get("steps", []),
        "latest_message": latest_message,
        "messages": messages,
        "result": state.get("result"),
    }


async def _broadcast_to_ws(workflow_id: int, data: dict):
    """Broadcast data to all WebSocket connections for a workflow."""
    if workflow_id not in _ws_connections:
        return

    dead = []
    for ws in _ws_connections[workflow_id]:
        try:
            await ws.send_json(data)
        except Exception:
            dead.append(ws)

    for ws in dead:
        _ws_connections[workflow_id].remove(ws)


@router.get("/status/{workflow_id}")
async def get_status(workflow_id: int, db: AsyncSession = Depends(get_db)):
    """Get the status of a specific onboarding workflow."""
    wf = await db.get(OnboardingWorkflow, workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found")

    # If actively running, use in-memory state for latest data
    active = _active_workflows.get(workflow_id)
    if active and active.get("state"):
        state = active["state"]
        return {
            "id": wf.id,
            "new_hire_name": wf.new_hire_name,
            "department": wf.department,
            "role": wf.role,
            "start_date": wf.start_date,
            "status": state.get("status", wf.status),
            "progress_pct": state.get("progress", wf.progress_pct),
            "steps": state.get("steps", wf.steps or []),
            "current_step": state.get("current_step", wf.current_step),
            "messages": state.get("messages", []),
            "result": state.get("result"),
            "created_at": wf.created_at.isoformat() if wf.created_at else None,
            "updated_at": wf.updated_at.isoformat() if wf.updated_at else None,
        }

    return {
        "id": wf.id,
        "new_hire_name": wf.new_hire_name,
        "department": wf.department,
        "role": wf.role,
        "start_date": wf.start_date,
        "status": wf.status,
        "progress_pct": wf.progress_pct,
        "steps": wf.steps or [],
        "current_step": wf.current_step,
        "messages": [],
        "result": None,
        "created_at": wf.created_at.isoformat() if wf.created_at else None,
        "updated_at": wf.updated_at.isoformat() if wf.updated_at else None,
    }


@router.get("/list")
async def list_onboardings(db: AsyncSession = Depends(get_db)):
    """List all onboarding workflows."""
    result = await db.execute(
        select(OnboardingWorkflow).order_by(OnboardingWorkflow.created_at.desc())
    )
    workflows = result.scalars().all()

    return {
        "total": len(workflows),
        "workflows": [
            {
                "id": wf.id,
                "new_hire_name": wf.new_hire_name,
                "department": wf.department,
                "role": wf.role,
                "start_date": wf.start_date,
                "status": wf.status,
                "progress_pct": wf.progress_pct,
                "current_step": wf.current_step,
                "created_at": wf.created_at.isoformat() if wf.created_at else None,
                "updated_at": wf.updated_at.isoformat() if wf.updated_at else None,
            }
            for wf in workflows
        ],
    }


@router.get("/graph")
async def get_workflow_graph():
    """Get the workflow graph visualization data."""
    return get_graph_visualization()


@router.get("/hires")
async def list_available_hires():
    """List available sample hires from Greenhouse."""
    result = await greenhouse.list_pending_hires()
    return result


@router.websocket("/ws/{workflow_id}")
async def websocket_endpoint(websocket: WebSocket, workflow_id: int):
    """WebSocket endpoint for live workflow progress streaming."""
    await websocket.accept()

    # Register connection
    if workflow_id not in _ws_connections:
        _ws_connections[workflow_id] = []
    _ws_connections[workflow_id].append(websocket)

    try:
        # Send current state if workflow is active
        active = _active_workflows.get(workflow_id)
        if active and active.get("state"):
            state = active["state"]
            await websocket.send_json({
                "workflow_id": workflow_id,
                "event": "current_state",
                "status": state.get("status", "running"),
                "progress": state.get("progress", 0.0),
                "current_step": state.get("current_step"),
                "steps": state.get("steps", []),
                "messages": state.get("messages", []),
                "result": state.get("result"),
            })
        elif active and active.get("status") == "completed":
            await websocket.send_json({
                "workflow_id": workflow_id,
                "event": "completed",
                "status": "completed",
                "progress": 100.0,
            })

        # Keep connection alive until client disconnects
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                # Handle ping/pong
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                # Send heartbeat
                try:
                    await websocket.send_json({"event": "heartbeat"})
                except Exception:
                    break

    except WebSocketDisconnect:
        pass
    finally:
        if workflow_id in _ws_connections:
            if websocket in _ws_connections[workflow_id]:
                _ws_connections[workflow_id].remove(websocket)
