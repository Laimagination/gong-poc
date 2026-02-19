"""Simulated Okta Identity Provider API."""

import asyncio
import random
from datetime import datetime

_user_counter = 10000
_users: dict[str, dict] = {}

# Department-to-application mapping
_DEPARTMENT_APPS = {
    "Engineering": [
        {"app_id": "github-enterprise", "name": "GitHub Enterprise", "type": "development"},
        {"app_id": "jira-cloud", "name": "Jira Cloud", "type": "project-management"},
        {"app_id": "datadog", "name": "Datadog", "type": "monitoring"},
        {"app_id": "aws-console", "name": "AWS Console", "type": "cloud"},
        {"app_id": "pagerduty", "name": "PagerDuty", "type": "on-call"},
        {"app_id": "confluence", "name": "Confluence", "type": "documentation"},
    ],
    "Sales": [
        {"app_id": "salesforce", "name": "Salesforce", "type": "crm"},
        {"app_id": "gong-io", "name": "Gong", "type": "revenue-intelligence"},
        {"app_id": "outreach", "name": "Outreach", "type": "sales-engagement"},
        {"app_id": "linkedin-sales", "name": "LinkedIn Sales Navigator", "type": "prospecting"},
        {"app_id": "clari", "name": "Clari", "type": "forecasting"},
    ],
    "Data Science": [
        {"app_id": "github-enterprise", "name": "GitHub Enterprise", "type": "development"},
        {"app_id": "databricks", "name": "Databricks", "type": "data-platform"},
        {"app_id": "snowflake", "name": "Snowflake", "type": "data-warehouse"},
        {"app_id": "jupyter-hub", "name": "JupyterHub", "type": "notebooks"},
        {"app_id": "mlflow", "name": "MLflow", "type": "ml-ops"},
        {"app_id": "aws-console", "name": "AWS Console", "type": "cloud"},
    ],
    "Marketing": [
        {"app_id": "hubspot", "name": "HubSpot", "type": "marketing-automation"},
        {"app_id": "figma", "name": "Figma", "type": "design"},
        {"app_id": "google-analytics", "name": "Google Analytics", "type": "analytics"},
        {"app_id": "wordpress", "name": "WordPress", "type": "cms"},
        {"app_id": "hootsuite", "name": "Hootsuite", "type": "social-media"},
    ],
}

# Universal apps everyone gets
_UNIVERSAL_APPS = [
    {"app_id": "google-workspace", "name": "Google Workspace", "type": "productivity"},
    {"app_id": "slack", "name": "Slack", "type": "communication"},
    {"app_id": "zoom", "name": "Zoom", "type": "video"},
    {"app_id": "1password", "name": "1Password", "type": "security"},
]


async def _simulate_latency():
    base = random.uniform(0.5, 1.2)
    if random.random() < 0.12:
        base += random.uniform(1.5, 3.0)
    await asyncio.sleep(base)


async def create_user(data: dict) -> dict:
    """Create a user account in Okta."""
    global _user_counter
    await _simulate_latency()

    _user_counter += 1
    user_id = f"okta-{_user_counter}"

    user = {
        "user_id": user_id,
        "email": data.get("email", ""),
        "first_name": data.get("name", "Unknown").split()[0],
        "last_name": " ".join(data.get("name", "Unknown").split()[1:]) or "User",
        "department": data.get("department", "General"),
        "status": "provisioned",
        "created_at": datetime.now().isoformat(),
        "mfa_enrolled": False,
    }
    _users[user_id] = user

    return {
        "success": True,
        "data": {
            "user_id": user_id,
            "login": data.get("email", ""),
            "status": "provisioned",
            "temp_password_sent": True,
        },
    }


async def assign_applications(user_id: str, department: str) -> dict:
    """Assign department-specific applications to a user."""
    await _simulate_latency()

    dept_apps = _DEPARTMENT_APPS.get(department, [])
    all_apps = _UNIVERSAL_APPS + dept_apps

    assigned = []
    for app in all_apps:
        assigned.append({
            "user_id": user_id,
            "app_id": app["app_id"],
            "app_name": app["name"],
            "type": app["type"],
            "status": "assigned",
            "provisioned_at": datetime.now().isoformat(),
        })

    return {
        "success": True,
        "data": {
            "user_id": user_id,
            "department": department,
            "total_apps": len(assigned),
            "universal_apps": len(_UNIVERSAL_APPS),
            "department_apps": len(dept_apps),
            "applications": assigned,
        },
    }


async def get_user(user_id: str) -> dict:
    """Get user details from Okta."""
    await _simulate_latency()

    if user_id in _users:
        return {"success": True, "data": _users[user_id]}
    return {"success": False, "error": f"User {user_id} not found"}
