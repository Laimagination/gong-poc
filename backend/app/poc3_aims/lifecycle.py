"""
AIMS lifecycle state machine.

Valid transitions:
    proposed -> impact_assessed -> approved -> in_development -> deployed ->
    monitoring -> under_review -> monitoring

    Any status -> on_hold
    on_hold -> (previous status, stored as detail)
    Any active status -> retired
"""

from __future__ import annotations

from datetime import datetime

# Ordered forward transitions
_FORWARD: dict[str, str] = {
    "proposed": "impact_assessed",
    "impact_assessed": "approved",
    "approved": "in_development",
    "in_development": "deployed",
    "deployed": "monitoring",
    "monitoring": "under_review",
    "under_review": "monitoring",
}

_ACTIVE_STATUSES = {
    "proposed", "impact_assessed", "approved",
    "in_development", "deployed", "monitoring", "under_review",
}

_ALL_STATUSES = _ACTIVE_STATUSES | {"on_hold", "retired"}


def is_valid_transition(from_status: str, to_status: str) -> bool:
    """Check if a status transition is allowed."""
    if to_status not in _ALL_STATUSES:
        return False

    # Any active status can go to on_hold or retired
    if to_status == "on_hold" and from_status in _ACTIVE_STATUSES:
        return True
    if to_status == "retired" and from_status in _ACTIVE_STATUSES:
        return True

    # on_hold can go back to any active status
    if from_status == "on_hold" and to_status in _ACTIVE_STATUSES:
        return True

    # Normal forward transition
    return _FORWARD.get(from_status) == to_status


def transition(
    project_status: str,
    to_status: str,
    actor: str,
    detail: str | None = None,
) -> dict:
    """Validate and produce transition data.

    Returns a dict with:
      - project_updates: fields to set on the AIProject row
      - event: data for a new AIMSEvent record

    Raises ValueError if the transition is not allowed.
    """
    if not is_valid_transition(project_status, to_status):
        raise ValueError(
            f"Invalid transition from '{project_status}' to '{to_status}'"
        )

    now = datetime.utcnow()

    project_updates: dict = {
        "status": to_status,
        "updated_at": now,
    }

    # Set approval fields when entering approved
    if to_status == "approved":
        project_updates["approval_date"] = now

    # Set review date when entering monitoring
    if to_status == "monitoring":
        project_updates["last_reviewed"] = now

    event = {
        "event_type": "status_change",
        "from_status": project_status,
        "to_status": to_status,
        "actor": actor,
        "detail": detail or f"Status changed from {project_status} to {to_status}",
        "timestamp": now,
    }

    return {
        "project_updates": project_updates,
        "event": event,
    }
