"""Simulated Moveworks AI Helpdesk API for equipment requests."""

import asyncio
import random
from datetime import datetime

_tickets: dict[str, dict] = {}
_ticket_counter = 7000

# Role-based equipment definitions
_EQUIPMENT_BY_ROLE = {
    "Engineering": {
        "default": {
            "laptop": "MacBook Pro 16\" M3 Max (64GB RAM)",
            "monitors": "2x LG 27\" 4K USB-C",
            "peripherals": ["Mechanical Keyboard", "Logitech MX Master 3", "USB-C Hub"],
            "accessories": ["Laptop Stand", "Noise-canceling Headphones"],
        },
        "Senior Backend Engineer": {
            "laptop": "MacBook Pro 16\" M3 Max (96GB RAM)",
            "monitors": "2x LG 32\" 4K USB-C",
            "peripherals": ["Mechanical Keyboard", "Logitech MX Master 3", "USB-C Hub", "Thunderbolt Dock"],
            "accessories": ["Laptop Stand", "Noise-canceling Headphones", "Standing Desk Mat"],
        },
    },
    "Sales": {
        "default": {
            "laptop": "MacBook Air 15\" M3 (24GB RAM)",
            "monitors": "1x Dell 27\" FHD",
            "peripherals": ["Wireless Keyboard", "Wireless Mouse"],
            "accessories": ["Jabra Evolve2 75 Headset", "Laptop Stand", "Webcam HD"],
        },
    },
    "Data Science": {
        "default": {
            "laptop": "MacBook Pro 16\" M3 Max (96GB RAM)",
            "monitors": "2x LG 32\" 4K USB-C",
            "peripherals": ["Mechanical Keyboard", "Logitech MX Master 3", "Thunderbolt Dock"],
            "accessories": ["Laptop Stand", "Noise-canceling Headphones"],
        },
    },
    "Marketing": {
        "default": {
            "laptop": "MacBook Air 15\" M3 (24GB RAM)",
            "monitors": "1x Dell 27\" 4K",
            "peripherals": ["Wireless Keyboard", "Wireless Mouse", "USB-C Hub"],
            "accessories": ["Laptop Stand", "Webcam HD"],
        },
    },
}

_DEFAULT_EQUIPMENT = {
    "laptop": "MacBook Air 13\" M3 (16GB RAM)",
    "monitors": "1x Dell 24\" FHD",
    "peripherals": ["Wireless Keyboard", "Wireless Mouse"],
    "accessories": ["Laptop Stand"],
}


def _get_equipment(department: str, role: str) -> dict:
    """Determine equipment based on department and role."""
    dept_equipment = _EQUIPMENT_BY_ROLE.get(department, {})
    return dept_equipment.get(role, dept_equipment.get("default", _DEFAULT_EQUIPMENT))


async def _simulate_latency():
    base = random.uniform(0.5, 1.5)
    if random.random() < 0.1:
        base += random.uniform(1.0, 2.0)
    await asyncio.sleep(base)


async def create_equipment_request(data: dict) -> dict:
    """Create an equipment/IT request ticket in Moveworks."""
    global _ticket_counter
    await _simulate_latency()

    _ticket_counter += 1
    ticket_id = f"MW-{_ticket_counter}"

    department = data.get("department", "General")
    role = data.get("role", "")
    location = data.get("location", "Office")
    equipment = _get_equipment(department, role)

    is_remote = "remote" in location.lower()
    shipping_note = "Ship to home address on file" if is_remote else f"Available at {location} office IT desk"

    ticket = {
        "ticket_id": ticket_id,
        "requester": data.get("name", "Unknown"),
        "employee_id": data.get("employee_id", ""),
        "department": department,
        "role": role,
        "equipment": equipment,
        "shipping": shipping_note,
        "is_remote": is_remote,
        "status": "open",
        "priority": "high",
        "created_at": datetime.now().isoformat(),
        "estimated_delivery": "3-5 business days" if not is_remote else "5-7 business days",
    }
    _tickets[ticket_id] = ticket

    return {
        "success": True,
        "data": {
            "ticket_id": ticket_id,
            "status": "open",
            "equipment": equipment,
            "estimated_delivery": ticket["estimated_delivery"],
            "shipping": shipping_note,
        },
    }


async def check_ticket_status(ticket_id: str) -> dict:
    """Check the status of an equipment request ticket."""
    await _simulate_latency()

    if ticket_id not in _tickets:
        return {"success": False, "error": f"Ticket {ticket_id} not found"}

    ticket = _tickets[ticket_id]

    # Simulate progress over time
    statuses = ["open", "approved", "procurement", "shipping", "delivered"]
    current_idx = statuses.index(ticket["status"])
    if random.random() < 0.3 and current_idx < len(statuses) - 1:
        ticket["status"] = statuses[current_idx + 1]

    return {
        "success": True,
        "data": {
            "ticket_id": ticket_id,
            "status": ticket["status"],
            "equipment": ticket["equipment"],
            "estimated_delivery": ticket["estimated_delivery"],
        },
    }
