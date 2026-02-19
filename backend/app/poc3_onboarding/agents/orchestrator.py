"""Main Onboarding Orchestrator Agent.

Uses rule-based logic to determine department-specific onboarding playbooks,
plan steps, and coordinate sub-agents. No LLM API keys required.
"""

from datetime import datetime

# Department-specific onboarding playbooks
_PLAYBOOKS = {
    "Engineering": {
        "priority": "high",
        "steps": [
            "provision_identity",
            "setup_workspace",
            "order_equipment",
            "track_completion",
        ],
        "skip_equipment_if_remote": False,  # Engineers always get equipment
        "notes": "Full dev environment setup required. Ensure GitHub, AWS, and CI/CD access.",
        "estimated_duration_days": 5,
        "buddy_assignment": True,
    },
    "Sales": {
        "priority": "high",
        "steps": [
            "provision_identity",
            "setup_workspace",
            "order_equipment",
            "track_completion",
        ],
        "skip_equipment_if_remote": False,
        "notes": "CRM access and sales tool provisioning critical for ramp.",
        "estimated_duration_days": 7,
        "buddy_assignment": True,
    },
    "Data Science": {
        "priority": "high",
        "steps": [
            "provision_identity",
            "setup_workspace",
            "order_equipment",
            "track_completion",
        ],
        "skip_equipment_if_remote": False,
        "notes": "Heavy compute access required. Ensure data platform and notebook access.",
        "estimated_duration_days": 5,
        "buddy_assignment": True,
    },
    "Marketing": {
        "priority": "medium",
        "steps": [
            "provision_identity",
            "setup_workspace",
            "order_equipment",
            "track_completion",
        ],
        "skip_equipment_if_remote": True,  # Marketing can use personal device initially
        "notes": "Creative tools and CMS access. Brand guidelines review required.",
        "estimated_duration_days": 4,
        "buddy_assignment": True,
    },
}

_DEFAULT_PLAYBOOK = {
    "priority": "medium",
    "steps": [
        "provision_identity",
        "setup_workspace",
        "order_equipment",
        "track_completion",
    ],
    "skip_equipment_if_remote": True,
    "notes": "Standard onboarding flow.",
    "estimated_duration_days": 5,
    "buddy_assignment": False,
}


def plan_onboarding(hire_info: dict) -> dict:
    """Determine the onboarding plan based on department and role.

    Returns a structured plan with ordered steps and metadata.
    """
    department = hire_info.get("department", "General")
    location = hire_info.get("location", "Office")
    is_remote = "remote" in location.lower()

    playbook = _PLAYBOOKS.get(department, _DEFAULT_PLAYBOOK)

    steps = list(playbook["steps"])

    # Conditional: skip equipment for remote hires if playbook allows
    if is_remote and playbook.get("skip_equipment_if_remote", False):
        steps = [s for s in steps if s != "order_equipment"]

    # Build step details
    step_details = []
    for i, step in enumerate(steps):
        step_details.append({
            "step_id": step,
            "order": i + 1,
            "status": "pending",
            "started_at": None,
            "completed_at": None,
            "result": None,
            "error": None,
        })

    plan = {
        "hire_id": hire_info.get("hire_id", ""),
        "hire_name": hire_info.get("name", "Unknown"),
        "department": department,
        "role": hire_info.get("role", ""),
        "location": location,
        "is_remote": is_remote,
        "priority": playbook["priority"],
        "playbook_notes": playbook["notes"],
        "estimated_duration_days": playbook["estimated_duration_days"],
        "buddy_assignment": playbook["buddy_assignment"],
        "total_steps": len(step_details),
        "steps": step_details,
        "planned_at": datetime.now().isoformat(),
    }

    return plan


def get_next_step(steps: list[dict]) -> dict | None:
    """Get the next pending step from the plan."""
    for step in steps:
        if step["status"] == "pending":
            return step
    return None


def mark_step_complete(steps: list[dict], step_id: str, result: dict | None = None) -> list[dict]:
    """Mark a step as completed and return updated steps."""
    for step in steps:
        if step["step_id"] == step_id:
            step["status"] = "completed"
            step["completed_at"] = datetime.now().isoformat()
            step["result"] = result
            break
    return steps


def mark_step_failed(steps: list[dict], step_id: str, error: str) -> list[dict]:
    """Mark a step as failed."""
    for step in steps:
        if step["step_id"] == step_id:
            step["status"] = "failed"
            step["completed_at"] = datetime.now().isoformat()
            step["error"] = error
            break
    return steps


def mark_step_in_progress(steps: list[dict], step_id: str) -> list[dict]:
    """Mark a step as in progress."""
    for step in steps:
        if step["step_id"] == step_id:
            step["status"] = "in_progress"
            step["started_at"] = datetime.now().isoformat()
            break
    return steps


def calculate_progress(steps: list[dict]) -> float:
    """Calculate overall progress percentage."""
    if not steps:
        return 0.0
    completed = sum(1 for s in steps if s["status"] in ("completed", "failed"))
    return round((completed / len(steps)) * 100, 1)


def is_workflow_complete(steps: list[dict]) -> bool:
    """Check if all steps are done (completed or failed)."""
    return all(s["status"] in ("completed", "failed") for s in steps)
