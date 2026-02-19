"""Equipment Provisioning Agent.

Determines hardware requirements by department/role and creates Moveworks tickets.
"""

from ..mock_apis import moveworks


async def order_equipment(hire_info: dict) -> dict:
    """Order equipment for a new hire.

    Determines hardware based on department and role, then creates
    a Moveworks helpdesk ticket for IT fulfillment.

    Returns a summary of the equipment request.
    """
    name = hire_info.get("name", "Unknown")
    department = hire_info.get("department", "General")
    role = hire_info.get("role", "")
    location = hire_info.get("location", "Office")

    results = {"agent": "equipment", "actions": [], "errors": []}

    try:
        ticket_result = await moveworks.create_equipment_request({
            "name": name,
            "employee_id": hire_info.get("employee_id", ""),
            "department": department,
            "role": role,
            "location": location,
        })

        if ticket_result["success"]:
            ticket_data = ticket_result["data"]
            results["ticket_id"] = ticket_data["ticket_id"]
            results["equipment"] = ticket_data["equipment"]
            results["estimated_delivery"] = ticket_data["estimated_delivery"]
            results["shipping"] = ticket_data["shipping"]
            results["actions"].append({
                "system": "Moveworks",
                "action": "create_equipment_request",
                "status": "success",
                "detail": (
                    f"Ticket {ticket_data['ticket_id']} created: "
                    f"{ticket_data['equipment']['laptop']}, "
                    f"{ticket_data['equipment']['monitors']}. "
                    f"ETA: {ticket_data['estimated_delivery']}"
                ),
            })
        else:
            results["errors"].append({
                "system": "Moveworks",
                "action": "create_equipment_request",
                "error": ticket_result.get("error", "Unknown error"),
            })
    except Exception as e:
        results["errors"].append({
            "system": "Moveworks",
            "action": "create_equipment_request",
            "error": str(e),
        })

    results["success"] = len(results["errors"]) == 0
    results["summary"] = (
        f"Equipment ordered: {results.get('equipment', {}).get('laptop', 'N/A')}, "
        f"Ticket: {results.get('ticket_id', 'FAILED')}"
    )

    return results
