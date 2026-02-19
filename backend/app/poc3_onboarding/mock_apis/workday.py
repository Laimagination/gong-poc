"""Simulated Workday HRIS (Human Resource Information System) API."""

import asyncio
import random
from datetime import datetime

_employee_counter = 50000
_employees: dict[str, dict] = {}

# Department-specific onboarding task templates
_ONBOARDING_TASKS = {
    "Engineering": [
        {"task": "Complete security training", "due_days": 3, "category": "compliance"},
        {"task": "Set up development environment", "due_days": 2, "category": "technical"},
        {"task": "Review coding standards", "due_days": 5, "category": "technical"},
        {"task": "Complete IP assignment agreement", "due_days": 1, "category": "legal"},
        {"task": "Meet with team lead", "due_days": 3, "category": "social"},
        {"task": "Review architecture documentation", "due_days": 7, "category": "technical"},
    ],
    "Sales": [
        {"task": "Complete CRM training", "due_days": 3, "category": "technical"},
        {"task": "Review sales playbook", "due_days": 5, "category": "training"},
        {"task": "Shadow senior AE calls", "due_days": 7, "category": "training"},
        {"task": "Complete compliance training", "due_days": 3, "category": "compliance"},
        {"task": "Set up territory plan", "due_days": 10, "category": "technical"},
    ],
    "Data Science": [
        {"task": "Complete security training", "due_days": 3, "category": "compliance"},
        {"task": "Set up ML development environment", "due_days": 2, "category": "technical"},
        {"task": "Review data governance policies", "due_days": 5, "category": "compliance"},
        {"task": "Get access to data warehouse", "due_days": 3, "category": "technical"},
        {"task": "Meet with research team", "due_days": 5, "category": "social"},
    ],
    "Marketing": [
        {"task": "Complete brand guidelines review", "due_days": 3, "category": "training"},
        {"task": "Set up marketing tools access", "due_days": 2, "category": "technical"},
        {"task": "Review content calendar", "due_days": 5, "category": "training"},
        {"task": "Complete compliance training", "due_days": 3, "category": "compliance"},
        {"task": "Meet with cross-functional partners", "due_days": 7, "category": "social"},
    ],
}

_DEFAULT_TASKS = [
    {"task": "Complete general onboarding", "due_days": 3, "category": "compliance"},
    {"task": "Review company handbook", "due_days": 5, "category": "compliance"},
    {"task": "Set up benefits enrollment", "due_days": 7, "category": "hr"},
    {"task": "Meet with manager", "due_days": 2, "category": "social"},
]


async def _simulate_latency():
    base = random.uniform(0.4, 1.0)
    if random.random() < 0.08:
        base += random.uniform(1.0, 2.5)
    await asyncio.sleep(base)


async def create_employee(data: dict) -> dict:
    """Create an employee record in Workday."""
    global _employee_counter
    await _simulate_latency()

    _employee_counter += 1
    employee_id = f"WD-{_employee_counter}"

    employee = {
        "employee_id": employee_id,
        "name": data.get("name", "Unknown"),
        "email": data.get("email", ""),
        "department": data.get("department", "General"),
        "role": data.get("role", "Employee"),
        "start_date": data.get("start_date", ""),
        "manager": data.get("manager", "TBD"),
        "status": "pre-boarding",
        "created_at": datetime.now().isoformat(),
    }
    _employees[employee_id] = employee

    return {"success": True, "data": {"employee_id": employee_id, **employee}}


async def assign_onboarding_tasks(employee_id: str, department: str = "General") -> dict:
    """Assign department-specific onboarding tasks to the employee."""
    await _simulate_latency()

    tasks_template = _ONBOARDING_TASKS.get(department, _DEFAULT_TASKS)
    assigned_tasks = []
    for i, t in enumerate(tasks_template):
        assigned_tasks.append({
            "task_id": f"{employee_id}-T{i+1:02d}",
            "employee_id": employee_id,
            "task": t["task"],
            "due_days": t["due_days"],
            "category": t["category"],
            "status": "pending",
        })

    return {
        "success": True,
        "data": {
            "employee_id": employee_id,
            "tasks_assigned": len(assigned_tasks),
            "tasks": assigned_tasks,
        },
    }


async def get_employee(employee_id: str) -> dict:
    """Get employee details."""
    await _simulate_latency()

    if employee_id in _employees:
        return {"success": True, "data": _employees[employee_id]}
    return {"success": False, "error": f"Employee {employee_id} not found"}
