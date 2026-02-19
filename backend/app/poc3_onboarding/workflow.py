"""LangGraph StateGraph for Onboarding Workflow.

Defines the state machine that orchestrates the onboarding process.
Uses rule-based agents (no LLM API keys required).
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, TypedDict

from langgraph.graph import StateGraph, END

from .agents.orchestrator import (
    plan_onboarding,
    mark_step_complete,
    mark_step_failed,
    mark_step_in_progress,
    calculate_progress,
    is_workflow_complete,
)
from .agents.provisioner import provision_identity
from .agents.workspace import setup_workspace
from .agents.equipment import order_equipment
from .agents.tracker import track_completion


class OnboardingState(TypedDict):
    """State that flows through the onboarding workflow graph."""
    hire_info: dict[str, Any]
    steps: list[dict[str, Any]]
    current_step: str | None
    progress: float
    messages: list[dict[str, Any]]
    status: str  # pending, running, completed, failed
    result: dict[str, Any] | None


def _add_message(state: OnboardingState, content: str, msg_type: str = "info") -> None:
    """Append a timestamped message to the state."""
    state["messages"].append({
        "timestamp": datetime.now().isoformat(),
        "type": msg_type,
        "content": content,
    })


# --- Graph Node Functions ---

async def receive_hire(state: OnboardingState) -> OnboardingState:
    """Entry node: receive hire info and plan the onboarding."""
    hire_info = state["hire_info"]
    name = hire_info.get("name", "Unknown")
    department = hire_info.get("department", "General")

    _add_message(state, f"Received new hire: {name} ({department})")

    plan = plan_onboarding(hire_info)
    state["steps"] = plan["steps"]
    state["status"] = "running"
    state["progress"] = 0.0

    _add_message(
        state,
        f"Onboarding plan created: {plan['total_steps']} steps, "
        f"priority={plan['priority']}, ETA={plan['estimated_duration_days']} days",
    )

    return state


async def provision_identity_node(state: OnboardingState) -> OnboardingState:
    """Node: provision identity via Okta and Workday."""
    step_id = "provision_identity"
    state["current_step"] = step_id
    state["steps"] = mark_step_in_progress(state["steps"], step_id)
    _add_message(state, "Provisioning identity (Okta + Workday)...")

    try:
        result = await provision_identity(state["hire_info"])
        if result["success"]:
            state["steps"] = mark_step_complete(state["steps"], step_id, result)
            _add_message(state, f"Identity provisioned: {result['summary']}", "success")
        else:
            state["steps"] = mark_step_complete(state["steps"], step_id, result)
            _add_message(
                state,
                f"Identity provisioned with warnings: {result['summary']}",
                "warning",
            )
    except Exception as e:
        state["steps"] = mark_step_failed(state["steps"], step_id, str(e))
        _add_message(state, f"Identity provisioning failed: {e}", "error")

    state["progress"] = calculate_progress(state["steps"])
    return state


async def setup_workspace_node(state: OnboardingState) -> OnboardingState:
    """Node: set up Slack workspace."""
    step_id = "setup_workspace"
    state["current_step"] = step_id
    state["steps"] = mark_step_in_progress(state["steps"], step_id)
    _add_message(state, "Setting up Slack workspace...")

    try:
        result = await setup_workspace(state["hire_info"])
        if result["success"]:
            state["steps"] = mark_step_complete(state["steps"], step_id, result)
            _add_message(state, f"Workspace ready: {result['summary']}", "success")
        else:
            state["steps"] = mark_step_complete(state["steps"], step_id, result)
            _add_message(
                state,
                f"Workspace setup with warnings: {result['summary']}",
                "warning",
            )
    except Exception as e:
        state["steps"] = mark_step_failed(state["steps"], step_id, str(e))
        _add_message(state, f"Workspace setup failed: {e}", "error")

    state["progress"] = calculate_progress(state["steps"])
    return state


async def order_equipment_node(state: OnboardingState) -> OnboardingState:
    """Node: order equipment via Moveworks."""
    step_id = "order_equipment"
    state["current_step"] = step_id
    state["steps"] = mark_step_in_progress(state["steps"], step_id)
    _add_message(state, "Ordering equipment...")

    try:
        result = await order_equipment(state["hire_info"])
        if result["success"]:
            state["steps"] = mark_step_complete(state["steps"], step_id, result)
            _add_message(state, f"Equipment ordered: {result['summary']}", "success")
        else:
            state["steps"] = mark_step_complete(state["steps"], step_id, result)
            _add_message(
                state,
                f"Equipment order with issues: {result['summary']}",
                "warning",
            )
    except Exception as e:
        state["steps"] = mark_step_failed(state["steps"], step_id, str(e))
        _add_message(state, f"Equipment order failed: {e}", "error")

    state["progress"] = calculate_progress(state["steps"])
    return state


async def track_completion_node(state: OnboardingState) -> OnboardingState:
    """Node: track and report completion status."""
    step_id = "track_completion"
    state["current_step"] = step_id
    state["steps"] = mark_step_in_progress(state["steps"], step_id)
    _add_message(state, "Running completion tracking...")

    try:
        report = await track_completion(state["steps"], state["hire_info"])
        state["steps"] = mark_step_complete(state["steps"], step_id, report)
        state["result"] = report
        state["status"] = "completed"
        state["progress"] = 100.0
        _add_message(state, f"Tracking complete: {report['status_message']}", "success")
    except Exception as e:
        state["steps"] = mark_step_failed(state["steps"], step_id, str(e))
        state["status"] = "completed"
        state["progress"] = calculate_progress(state["steps"])
        _add_message(state, f"Tracking failed: {e}", "error")

    state["current_step"] = None
    return state


# --- Conditional Edge: should we order equipment? ---

def should_order_equipment(state: OnboardingState) -> str:
    """Determine if equipment ordering step exists in the plan."""
    step_ids = [s["step_id"] for s in state["steps"]]
    if "order_equipment" in step_ids:
        return "order_equipment"
    return "track_completion"


# --- Build the Graph ---

def build_workflow() -> StateGraph:
    """Build and compile the onboarding workflow StateGraph."""
    graph = StateGraph(OnboardingState)

    # Add nodes
    graph.add_node("receive_hire", receive_hire)
    graph.add_node("provision_identity", provision_identity_node)
    graph.add_node("setup_workspace", setup_workspace_node)
    graph.add_node("order_equipment", order_equipment_node)
    graph.add_node("track_completion", track_completion_node)

    # Set entry point
    graph.set_entry_point("receive_hire")

    # Add edges: sequential flow
    graph.add_edge("receive_hire", "provision_identity")
    graph.add_edge("provision_identity", "setup_workspace")

    # Conditional: skip equipment if not in plan (e.g., remote marketing hires)
    graph.add_conditional_edges(
        "setup_workspace",
        should_order_equipment,
        {
            "order_equipment": "order_equipment",
            "track_completion": "track_completion",
        },
    )
    graph.add_edge("order_equipment", "track_completion")
    graph.add_edge("track_completion", END)

    return graph


def get_graph_visualization() -> dict:
    """Return graph structure data for frontend visualization."""
    return {
        "nodes": [
            {
                "id": "receive_hire",
                "label": "Receive Hire",
                "description": "Receive new hire info and create onboarding plan",
                "icon": "inbox",
                "position": {"x": 250, "y": 0},
            },
            {
                "id": "provision_identity",
                "label": "Provision Identity",
                "description": "Create Okta account, assign apps, set up Workday",
                "icon": "shield",
                "position": {"x": 250, "y": 120},
            },
            {
                "id": "setup_workspace",
                "label": "Setup Workspace",
                "description": "Create Slack channels, send welcome, add to groups",
                "icon": "message-square",
                "position": {"x": 250, "y": 240},
            },
            {
                "id": "order_equipment",
                "label": "Order Equipment",
                "description": "Determine hardware needs, create Moveworks ticket",
                "icon": "laptop",
                "position": {"x": 150, "y": 360},
            },
            {
                "id": "track_completion",
                "label": "Track Completion",
                "description": "Monitor progress, identify blockers, generate report",
                "icon": "check-circle",
                "position": {"x": 250, "y": 480},
            },
        ],
        "edges": [
            {"from": "receive_hire", "to": "provision_identity", "label": ""},
            {"from": "provision_identity", "to": "setup_workspace", "label": ""},
            {"from": "setup_workspace", "to": "order_equipment", "label": "has equipment step", "conditional": True},
            {"from": "setup_workspace", "to": "track_completion", "label": "skip equipment", "conditional": True},
            {"from": "order_equipment", "to": "track_completion", "label": ""},
        ],
    }


# Pre-compiled workflow instance
_compiled_workflow = None


def get_compiled_workflow():
    """Get or create the compiled workflow."""
    global _compiled_workflow
    if _compiled_workflow is None:
        graph = build_workflow()
        _compiled_workflow = graph.compile()
    return _compiled_workflow


async def run_onboarding_workflow(hire_info: dict) -> OnboardingState:
    """Execute the full onboarding workflow for a new hire.

    Returns the final state with all steps completed.
    """
    initial_state: OnboardingState = {
        "hire_info": hire_info,
        "steps": [],
        "current_step": None,
        "progress": 0.0,
        "messages": [],
        "status": "pending",
        "result": None,
    }

    workflow = get_compiled_workflow()

    # Run the workflow and get the final state
    final_state = None
    async for state in workflow.astream(initial_state):
        # Each yielded value is a dict of {node_name: state_update}
        for node_name, node_state in state.items():
            final_state = node_state

    return final_state


async def run_onboarding_workflow_streaming(hire_info: dict):
    """Execute the workflow and yield state updates for WebSocket streaming.

    Yields (node_name, state_snapshot) tuples as each node completes.
    """
    initial_state: OnboardingState = {
        "hire_info": hire_info,
        "steps": [],
        "current_step": None,
        "progress": 0.0,
        "messages": [],
        "status": "pending",
        "result": None,
    }

    workflow = get_compiled_workflow()

    async for state in workflow.astream(initial_state):
        for node_name, node_state in state.items():
            yield node_name, node_state
