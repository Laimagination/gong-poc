"""Simulated Greenhouse ATS (Applicant Tracking System) API."""

import asyncio
import random
from datetime import datetime, timedelta

# Realistic mock hire data keyed by hire_id
_HIRE_DATABASE: dict[str, dict] = {
    "GH-1001": {
        "hire_id": "GH-1001",
        "name": "Sarah Chen",
        "email": "sarah.chen@company.com",
        "department": "Engineering",
        "role": "Senior Backend Engineer",
        "start_date": (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d"),
        "manager": "David Kim",
        "location": "San Francisco, CA",
        "employment_type": "full-time",
    },
    "GH-1002": {
        "hire_id": "GH-1002",
        "name": "Marcus Johnson",
        "email": "marcus.johnson@company.com",
        "department": "Sales",
        "role": "Account Executive",
        "start_date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
        "manager": "Lisa Park",
        "location": "New York, NY",
        "employment_type": "full-time",
    },
    "GH-1003": {
        "hire_id": "GH-1003",
        "name": "Priya Patel",
        "email": "priya.patel@company.com",
        "department": "Data Science",
        "role": "ML Engineer",
        "start_date": (datetime.now() + timedelta(days=21)).strftime("%Y-%m-%d"),
        "manager": "Alex Rivera",
        "location": "Remote",
        "employment_type": "full-time",
    },
    "GH-1004": {
        "hire_id": "GH-1004",
        "name": "James O'Brien",
        "email": "james.obrien@company.com",
        "department": "Marketing",
        "role": "Content Marketing Manager",
        "start_date": (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d"),
        "manager": "Rachel Green",
        "location": "Austin, TX",
        "employment_type": "full-time",
    },
    "GH-1005": {
        "hire_id": "GH-1005",
        "name": "Aisha Mohammed",
        "email": "aisha.mohammed@company.com",
        "department": "Engineering",
        "role": "Frontend Engineer",
        "start_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
        "manager": "David Kim",
        "location": "Remote",
        "employment_type": "full-time",
    },
}

# Track dynamically created hires
_dynamic_hires: dict[str, dict] = {}
_next_id = 2000


async def _simulate_latency():
    """Simulate API latency with occasional slowness."""
    base = random.uniform(0.3, 0.8)
    if random.random() < 0.1:  # 10% chance of degraded performance
        base += random.uniform(1.0, 2.0)
    await asyncio.sleep(base)


async def get_new_hire(hire_id: str) -> dict:
    """Fetch new hire details from Greenhouse."""
    await _simulate_latency()

    if hire_id in _HIRE_DATABASE:
        return {"success": True, "data": _HIRE_DATABASE[hire_id]}
    if hire_id in _dynamic_hires:
        return {"success": True, "data": _dynamic_hires[hire_id]}

    return {"success": False, "error": f"Hire {hire_id} not found"}


async def list_pending_hires() -> dict:
    """List all pending hires awaiting onboarding."""
    await _simulate_latency()

    all_hires = {**_HIRE_DATABASE, **_dynamic_hires}
    pending = [h for h in all_hires.values()]
    return {
        "success": True,
        "data": pending,
        "total": len(pending),
    }


async def create_hire(
    name: str,
    email: str,
    department: str,
    role: str,
    start_date: str,
    manager: str = "TBD",
    location: str = "TBD",
) -> dict:
    """Create a new hire record (used by trigger endpoint)."""
    global _next_id
    await _simulate_latency()

    hire_id = f"GH-{_next_id}"
    _next_id += 1

    hire_data = {
        "hire_id": hire_id,
        "name": name,
        "email": email,
        "department": department,
        "role": role,
        "start_date": start_date,
        "manager": manager,
        "location": location,
        "employment_type": "full-time",
    }
    _dynamic_hires[hire_id] = hire_data
    return {"success": True, "data": hire_data}
