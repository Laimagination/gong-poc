"""Completion Tracking Agent.

Monitors sub-agent progress, calculates completion percentage,
identifies blockers, and flags overdue items.
"""

from datetime import datetime


async def track_completion(steps: list[dict], hire_info: dict) -> dict:
    """Analyze workflow completion status and produce a tracking report.

    Evaluates all steps, identifies blockers, and provides a status summary.
    """
    name = hire_info.get("name", "Unknown")
    department = hire_info.get("department", "General")

    completed = [s for s in steps if s["status"] == "completed"]
    failed = [s for s in steps if s["status"] == "failed"]
    pending = [s for s in steps if s["status"] == "pending"]
    in_progress = [s for s in steps if s["status"] == "in_progress"]

    total = len(steps)
    progress_pct = round((len(completed) / total) * 100, 1) if total > 0 else 0.0

    # Identify blockers
    blockers = []
    for s in failed:
        blockers.append({
            "step": s["step_id"],
            "reason": s.get("error", "Unknown failure"),
            "severity": "high",
        })

    # Determine overall status
    if len(completed) == total:
        overall_status = "completed"
        status_message = f"All {total} onboarding steps completed successfully for {name}."
    elif len(failed) > 0:
        overall_status = "completed_with_errors"
        status_message = (
            f"Onboarding for {name} finished with {len(failed)} error(s). "
            f"{len(completed)}/{total} steps succeeded."
        )
    elif len(in_progress) > 0:
        overall_status = "in_progress"
        current = in_progress[0]["step_id"]
        status_message = f"Onboarding in progress for {name}. Currently: {current}."
    else:
        overall_status = "pending"
        status_message = f"Onboarding for {name} has not started yet."

    # Build step summary for the report
    step_summaries = []
    for s in steps:
        summary = {
            "step": s["step_id"],
            "status": s["status"],
            "started_at": s.get("started_at"),
            "completed_at": s.get("completed_at"),
        }
        if s.get("result") and isinstance(s["result"], dict):
            summary["detail"] = s["result"].get("summary", "")
            summary["actions_count"] = len(s["result"].get("actions", []))
        if s.get("error"):
            summary["error"] = s["error"]
        step_summaries.append(summary)

    report = {
        "agent": "tracker",
        "hire_name": name,
        "department": department,
        "overall_status": overall_status,
        "status_message": status_message,
        "progress_pct": progress_pct,
        "total_steps": total,
        "completed_steps": len(completed),
        "failed_steps": len(failed),
        "pending_steps": len(pending),
        "in_progress_steps": len(in_progress),
        "blockers": blockers,
        "steps": step_summaries,
        "tracked_at": datetime.now().isoformat(),
        "success": True,
        "summary": status_message,
    }

    return report
