"""Simulated Slack API for workspace setup."""

import asyncio
import random
from datetime import datetime

_channels: dict[str, dict] = {}
_messages: list[dict] = []

# Department Slack channels
_DEPARTMENT_CHANNELS = {
    "Engineering": [
        "#engineering", "#eng-backend", "#eng-frontend", "#eng-infra",
        "#deployments", "#incidents", "#code-reviews",
    ],
    "Sales": [
        "#sales", "#sales-wins", "#deal-room", "#competitive-intel",
        "#sales-enablement", "#pipeline-review",
    ],
    "Data Science": [
        "#data-science", "#ml-research", "#data-engineering",
        "#model-releases", "#experiments",
    ],
    "Marketing": [
        "#marketing", "#content-team", "#brand", "#campaigns",
        "#marketing-analytics", "#social-media",
    ],
}

# Universal channels everyone joins
_UNIVERSAL_CHANNELS = [
    "#general", "#announcements", "#random", "#watercooler",
    "#it-help", "#new-hires",
]

_WELCOME_TEMPLATES = {
    "Engineering": (
        "Welcome to the engineering team, {name}! :wave:\n\n"
        "Here are some resources to get started:\n"
        "- Engineering Wiki: https://wiki.internal/engineering\n"
        "- Dev Environment Setup: https://wiki.internal/dev-setup\n"
        "- On-call rotation: https://pagerduty.internal/schedule\n\n"
        "Your buddy will reach out shortly. Happy coding!"
    ),
    "Sales": (
        "Welcome to the sales team, {name}! :wave:\n\n"
        "Key resources:\n"
        "- Sales Playbook: https://wiki.internal/sales-playbook\n"
        "- Territory Map: https://salesforce.internal/territories\n"
        "- Gong Recordings: https://gong.internal/library\n\n"
        "Your ramp buddy will DM you to set up shadow sessions!"
    ),
    "Data Science": (
        "Welcome to the data science team, {name}! :wave:\n\n"
        "Getting started:\n"
        "- Data Catalog: https://wiki.internal/data-catalog\n"
        "- Model Registry: https://mlflow.internal\n"
        "- Experiment Tracking: https://wiki.internal/experiments\n\n"
        "Your onboarding buddy will be in touch!"
    ),
}

_DEFAULT_WELCOME = (
    "Welcome to the team, {name}! :wave:\n\n"
    "We're excited to have you on board. Check out #new-hires for "
    "onboarding resources and don't hesitate to ask questions in #it-help.\n\n"
    "Your manager and buddy will reach out to help you get settled!"
)


async def _simulate_latency():
    base = random.uniform(0.2, 0.6)
    if random.random() < 0.05:
        base += random.uniform(0.5, 1.5)
    await asyncio.sleep(base)


async def create_channel(name: str) -> dict:
    """Create a new Slack channel."""
    await _simulate_latency()

    channel_name = name.lower().replace(" ", "-")
    if not channel_name.startswith("#"):
        channel_name = f"#{channel_name}"

    channel_id = f"C{random.randint(10000000, 99999999)}"
    channel = {
        "channel_id": channel_id,
        "name": channel_name,
        "created_at": datetime.now().isoformat(),
        "members": [],
        "topic": f"Onboarding channel for {name}",
    }
    _channels[channel_id] = channel

    return {
        "success": True,
        "data": {
            "channel_id": channel_id,
            "name": channel_name,
            "created": True,
        },
    }


async def send_welcome_message(channel_id: str, user_name: str, department: str = "") -> dict:
    """Send a welcome message to a channel."""
    await _simulate_latency()

    template = _WELCOME_TEMPLATES.get(department, _DEFAULT_WELCOME)
    message_text = template.format(name=user_name)

    message = {
        "message_id": f"msg-{random.randint(100000, 999999)}",
        "channel_id": channel_id,
        "text": message_text,
        "sent_at": datetime.now().isoformat(),
        "sender": "onboarding-bot",
    }
    _messages.append(message)

    return {
        "success": True,
        "data": {
            "message_id": message["message_id"],
            "channel_id": channel_id,
            "sent": True,
        },
    }


async def add_to_channels(user_email: str, department: str) -> dict:
    """Add a user to their department and universal channels."""
    await _simulate_latency()

    dept_channels = _DEPARTMENT_CHANNELS.get(department, [])
    all_channels = _UNIVERSAL_CHANNELS + dept_channels

    added = []
    for ch in all_channels:
        added.append({
            "channel": ch,
            "user": user_email,
            "status": "added",
        })

    return {
        "success": True,
        "data": {
            "user": user_email,
            "department": department,
            "channels_joined": len(added),
            "universal_channels": len(_UNIVERSAL_CHANNELS),
            "department_channels": len(dept_channels),
            "channels": added,
        },
    }
