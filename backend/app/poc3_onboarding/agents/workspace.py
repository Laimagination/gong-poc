"""Workspace Setup Agent.

Handles Slack channel creation, welcome messages, and channel membership.
"""

from ..mock_apis import slack_mock


async def setup_workspace(hire_info: dict) -> dict:
    """Set up workspace for a new hire.

    1. Create personal onboarding Slack channel
    2. Send welcome message
    3. Add user to department and universal channels

    Returns a summary of all workspace actions.
    """
    name = hire_info.get("name", "Unknown")
    email = hire_info.get("email", "")
    department = hire_info.get("department", "General")

    # Sanitize name for channel naming
    channel_name = name.lower().replace(" ", "-").replace("'", "")
    onboarding_channel = f"onboarding-{channel_name}"

    results = {"agent": "workspace", "actions": [], "errors": []}

    # Step 1: Create personal onboarding channel
    try:
        channel_result = await slack_mock.create_channel(onboarding_channel)
        if channel_result["success"]:
            channel_id = channel_result["data"]["channel_id"]
            results["onboarding_channel_id"] = channel_id
            results["onboarding_channel_name"] = channel_result["data"]["name"]
            results["actions"].append({
                "system": "Slack",
                "action": "create_channel",
                "status": "success",
                "detail": f"Created {channel_result['data']['name']}",
            })
        else:
            results["errors"].append({
                "system": "Slack",
                "action": "create_channel",
                "error": channel_result.get("error", "Unknown error"),
            })
            channel_id = None
    except Exception as e:
        results["errors"].append({
            "system": "Slack",
            "action": "create_channel",
            "error": str(e),
        })
        channel_id = None

    # Step 2: Send welcome message
    if channel_id:
        try:
            welcome_result = await slack_mock.send_welcome_message(
                channel_id, name, department
            )
            if welcome_result["success"]:
                results["actions"].append({
                    "system": "Slack",
                    "action": "send_welcome_message",
                    "status": "success",
                    "detail": f"Welcome message sent to {onboarding_channel}",
                })
            else:
                results["errors"].append({
                    "system": "Slack",
                    "action": "send_welcome_message",
                    "error": welcome_result.get("error", "Unknown error"),
                })
        except Exception as e:
            results["errors"].append({
                "system": "Slack",
                "action": "send_welcome_message",
                "error": str(e),
            })

    # Step 3: Add to department and universal channels
    try:
        channels_result = await slack_mock.add_to_channels(email, department)
        if channels_result["success"]:
            ch_data = channels_result["data"]
            results["channels_joined"] = ch_data["channels_joined"]
            results["actions"].append({
                "system": "Slack",
                "action": "add_to_channels",
                "status": "success",
                "detail": (
                    f"Added to {ch_data['channels_joined']} channels "
                    f"({ch_data['universal_channels']} universal + "
                    f"{ch_data['department_channels']} {department})"
                ),
                "channels": [c["channel"] for c in ch_data["channels"]],
            })
        else:
            results["errors"].append({
                "system": "Slack",
                "action": "add_to_channels",
                "error": channels_result.get("error", "Unknown error"),
            })
    except Exception as e:
        results["errors"].append({
            "system": "Slack",
            "action": "add_to_channels",
            "error": str(e),
        })

    results["success"] = len(results["errors"]) == 0
    results["summary"] = (
        f"Workspace configured: channel {onboarding_channel} "
        f"{'created' if channel_id else 'FAILED'}, "
        f"{results.get('channels_joined', 0)} channels joined"
    )

    return results
