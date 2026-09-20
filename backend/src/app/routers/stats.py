from fastapi import APIRouter, Depends

from .. import config, db
from ..auth import Principal, current_principal

router = APIRouter()


@router.get("/stats")
def dashboard_stats(_: Principal = Depends(current_principal)):
    """Live numbers for the Control Room stat cards (same shape as MOCK_STATS)."""
    cases = db.list_cases()
    alerts = db.list_alerts()
    today = config.now_ist().strftime("%d %b %Y")
    open_cases = [c for c in cases if c.get("status") == "open"]
    urgent = [c for c in open_cases if c.get("priority") == "urgent"]
    filed_today = [c for c in cases if c.get("filedDate") == today]
    unread = [a for a in alerts if not a.get("isRead")]
    return [
        {"id": "stat-open", "value": len(open_cases), "label": "Open cases",
         "delta": f"{len(urgent)} urgent", "trend": "up", "color": "red"},
        {"id": "stat-today", "value": len(filed_today), "label": "FIRs filed today",
         "delta": "Registered today", "trend": "up", "color": "amber"},
        {"id": "stat-total", "value": len(cases), "label": "Cases on record",
         "delta": "All statuses", "trend": "neutral", "color": "navy"},
        {"id": "stat-alerts", "value": len(unread), "label": "Unread alerts",
         "delta": f"{len(alerts)} total", "trend": "up" if unread else "neutral", "color": "green"},
    ]
