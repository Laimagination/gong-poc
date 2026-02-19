"""Identity Provisioning Agent.

Handles Okta user creation and department-based application assignment.
"""

from ..mock_apis import okta, workday


async def provision_identity(hire_info: dict) -> dict:
    """Provision identity for a new hire.

    1. Create Okta user account
    2. Assign department-specific applications
    3. Create Workday employee record
    4. Assign onboarding tasks in Workday

    Returns a summary of all provisioning actions.
    """
    name = hire_info.get("name", "Unknown")
    email = hire_info.get("email", "")
    department = hire_info.get("department", "General")
    results = {"agent": "provisioner", "actions": [], "errors": []}

    # Step 1: Create Okta user
    try:
        okta_result = await okta.create_user({
            "name": name,
            "email": email,
            "department": department,
        })
        if okta_result["success"]:
            user_id = okta_result["data"]["user_id"]
            results["okta_user_id"] = user_id
            results["actions"].append({
                "system": "Okta",
                "action": "create_user",
                "status": "success",
                "detail": f"User {user_id} created, temp password sent",
            })
        else:
            results["errors"].append({
                "system": "Okta",
                "action": "create_user",
                "error": okta_result.get("error", "Unknown error"),
            })
    except Exception as e:
        results["errors"].append({
            "system": "Okta",
            "action": "create_user",
            "error": str(e),
        })
        user_id = None

    # Step 2: Assign applications
    if user_id:
        try:
            apps_result = await okta.assign_applications(user_id, department)
            if apps_result["success"]:
                app_data = apps_result["data"]
                results["applications_assigned"] = app_data["total_apps"]
                results["actions"].append({
                    "system": "Okta",
                    "action": "assign_applications",
                    "status": "success",
                    "detail": (
                        f"{app_data['total_apps']} apps assigned "
                        f"({app_data['universal_apps']} universal + "
                        f"{app_data['department_apps']} {department})"
                    ),
                    "apps": [a["app_name"] for a in app_data["applications"]],
                })
            else:
                results["errors"].append({
                    "system": "Okta",
                    "action": "assign_applications",
                    "error": apps_result.get("error", "Unknown error"),
                })
        except Exception as e:
            results["errors"].append({
                "system": "Okta",
                "action": "assign_applications",
                "error": str(e),
            })

    # Step 3: Create Workday employee record
    try:
        wd_result = await workday.create_employee({
            "name": name,
            "email": email,
            "department": department,
            "role": hire_info.get("role", ""),
            "start_date": hire_info.get("start_date", ""),
            "manager": hire_info.get("manager", "TBD"),
        })
        if wd_result["success"]:
            employee_id = wd_result["data"]["employee_id"]
            results["workday_employee_id"] = employee_id
            results["actions"].append({
                "system": "Workday",
                "action": "create_employee",
                "status": "success",
                "detail": f"Employee {employee_id} created",
            })
        else:
            results["errors"].append({
                "system": "Workday",
                "action": "create_employee",
                "error": wd_result.get("error", "Unknown error"),
            })
            employee_id = None
    except Exception as e:
        results["errors"].append({
            "system": "Workday",
            "action": "create_employee",
            "error": str(e),
        })
        employee_id = None

    # Step 4: Assign onboarding tasks
    if employee_id:
        try:
            tasks_result = await workday.assign_onboarding_tasks(employee_id, department)
            if tasks_result["success"]:
                task_data = tasks_result["data"]
                results["onboarding_tasks_assigned"] = task_data["tasks_assigned"]
                results["actions"].append({
                    "system": "Workday",
                    "action": "assign_onboarding_tasks",
                    "status": "success",
                    "detail": f"{task_data['tasks_assigned']} onboarding tasks assigned",
                })
            else:
                results["errors"].append({
                    "system": "Workday",
                    "action": "assign_onboarding_tasks",
                    "error": tasks_result.get("error", "Unknown error"),
                })
        except Exception as e:
            results["errors"].append({
                "system": "Workday",
                "action": "assign_onboarding_tasks",
                "error": str(e),
            })

    results["success"] = len(results["errors"]) == 0
    results["summary"] = (
        f"Identity provisioned: Okta user {'created' if user_id else 'FAILED'}, "
        f"{results.get('applications_assigned', 0)} apps assigned, "
        f"Workday employee {'created' if employee_id else 'FAILED'}"
    )

    return results
