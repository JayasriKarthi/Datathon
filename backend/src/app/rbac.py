"""Server-side port of src/utils/rbac.ts. The UI hides buttons, but only the API
can actually enforce permissions, so this is the source of truth."""

ROLE_HIERARCHY = {
    "commissioner": 5,
    "inspector": 4,
    "sub_inspector": 3,
    "head_constable": 2,
    "constable": 1,
}

PERMISSION_MIN_LEVEL = {
    "VIEW_COMMISSIONER_MODULES": 5, "VIEW_COMMISSIONER_CARDS": 5,
    "MANAGE_POLICE_STATIONS": 5, "MANAGE_OFFICERS": 5,
    "VIEW_DISTRICT_ANALYTICS": 5, "VIEW_CRIME_ANALYTICS": 5,
    "VIEW_PERFORMANCE": 5, "TRANSFER_CASES": 5,
    "ASSIGN_OFFICERS": 5, "MANAGE_USERS": 5,
    "DELETE_CASES": 4,
    "GENERATE_FIR": 3, "CREATE_COMPLAINT": 3, "VIEW_REPORTS": 3,
    "MODIFY_LEGAL_SECTIONS": 2, "UPDATE_INVESTIGATION": 2, "VIEW_AI_SUGGESTIONS": 2,
    "UPLOAD_EVIDENCE": 1, "RECORD_STATEMENTS": 1, "VIEW_ASSIGNED_TASKS_ONLY": 1,
}


def has_permission(role: str | None, permission: str) -> bool:
    if not role:
        return False
    return ROLE_HIERARCHY.get(role, 0) >= PERMISSION_MIN_LEVEL.get(permission, 99)
