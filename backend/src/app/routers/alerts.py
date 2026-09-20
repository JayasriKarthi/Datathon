from fastapi import APIRouter, Depends, HTTPException, Path

from .. import db
from ..auth import Principal, current_principal

router = APIRouter()


@router.get("/alerts")
def list_alerts(_: Principal = Depends(current_principal)):
    return db.list_alerts()


@router.patch("/alerts/{alert_id}/read", status_code=204)
def mark_read(alert_id: str = Path(pattern=r"^[A-Za-z0-9_-]{1,40}$"), _: Principal = Depends(current_principal)):
    if not db.mark_alert_read(alert_id):
        raise HTTPException(404, f"Alert {alert_id} not found")


@router.post("/alerts/mark-all-read", status_code=204)
def mark_all_read(_: Principal = Depends(current_principal)):
    for alert in db.list_alerts():
        if not alert.get("isRead"):
            db.mark_alert_read(alert["id"])
