import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response

from .. import config, db
from ..auth import Principal, current_principal, require
from ..rbac import has_permission
from ..schemas import CaseCreate, CasePatch, EvidenceCreate, TimelineEventBody

router = APIRouter()

CaseId = Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")


def _officer_name(principal: Principal) -> str:
    officer = db.get_officer(principal.badge)
    return officer["name"] if officer else principal.badge


def _today() -> str:
    return config.now_ist().strftime("%d %b %Y")


def _get_or_404(case_id: str) -> dict:
    case = db.get_case(case_id)
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")
    return case


@router.get("/cases")
def list_cases(_: Principal = Depends(current_principal)):
    return db.list_cases()


@router.get("/cases/search")  # declared before /cases/{case_id} so "search" isn't read as an id
def search_cases(q: str = Query(min_length=1, max_length=100), _: Principal = Depends(current_principal)):
    return db.search_cases_substring(q)


@router.get("/cases/{case_id}")
def get_case(case_id: str = CaseId, _: Principal = Depends(current_principal)):
    case = _get_or_404(case_id)
    for ev in case.get("evidence", []):  # short-lived download links for uploaded files
        if ev.get("s3Key"):
            ev["url"] = db.presigned_download(ev["s3Key"])
    return case


@router.post("/cases", status_code=201)
def create_case(body: CaseCreate, principal: Principal = Depends(require("GENERATE_FIR"))):
    number = db.next_case_number()
    case_id = f"KA-CR-{number}"
    fir = f"FIR {case_id}"
    officer = _officer_name(principal)
    now = config.now_ist()
    case = {
        "id": case_id,
        "firNumber": fir,
        "title": body.title.strip(),
        "priority": body.priority,
        "filedDate": now.strftime("%d %b %Y"),
        "createdAt": now.isoformat(),
        "complainant": body.complainant.strip(),
        "investigatingOfficer": officer,
        "description": body.description.strip(),
        "entities": [e.strip() for e in body.entities if e.strip()],
        "footerNote": f"Filed by {officer} on {now.strftime('%d %b %Y')}",
        "category": body.category,
        "status": "open",
        "linkedCases": [],
        "sector": body.sector.strip() or "Sector 4",
        "location": body.location.strip(),
        "evidence": [],
        "timeline": [{
            "id": f"tl-{uuid.uuid4().hex[:8]}",
            "date": now.strftime("%d %b %Y"),
            "time": now.strftime("%H:%M"),
            "event": "FIR Registered",
            "officer": officer,
            "note": f"{fir} registered. Complainant: {body.complainant.strip()}.",
            "type": "note",
        }],
    }
    if body.complainantPhone:
        case["complainantPhone"] = body.complainantPhone
    if body.latitude is not None and body.longitude is not None:
        case["latitude"], case["longitude"] = body.latitude, body.longitude
    db.put_case(case)
    return case


@router.patch("/cases/{case_id}")
def patch_case(body: CasePatch, case_id: str = CaseId,
               principal: Principal = Depends(require("UPDATE_INVESTIGATION"))):
    fields = body.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(422, "No fields to update")
    if "investigatingOfficer" in fields and not has_permission(principal.role, "ASSIGN_OFFICERS"):
        raise HTTPException(403, "Your role is not permitted to assign officers (ASSIGN_OFFICERS)")
    _get_or_404(case_id)
    updated = db.update_case(case_id, fields)
    if updated is None:
        raise HTTPException(404, f"Case {case_id} not found")
    return updated


@router.post("/cases/{case_id}/timeline", status_code=201)
def add_timeline_event(body: TimelineEventBody, case_id: str = CaseId,
                       principal: Principal = Depends(require("UPDATE_INVESTIGATION"))):
    now = config.now_ist()
    event = {
        "id": f"tl-{uuid.uuid4().hex[:8]}",
        "date": now.strftime("%d %b %Y"),
        "time": now.strftime("%H:%M"),
        "event": body.event.strip(),
        "officer": _officer_name(principal),
        "type": "note",
    }
    if body.note:
        event["note"] = body.note.strip()
    updated = db.update_case(case_id, {}, timeline_event=event)
    if updated is None:
        raise HTTPException(404, f"Case {case_id} not found")
    return event


@router.delete("/cases/{case_id}", status_code=204)
def delete_case(case_id: str = CaseId, _: Principal = Depends(require("DELETE_CASES"))):
    if not db.delete_case(case_id):
        raise HTTPException(404, f"Case {case_id} not found")
    return Response(status_code=204)


@router.post("/cases/{case_id}/evidence", status_code=201)
def add_evidence(body: EvidenceCreate, case_id: str = CaseId,
                 principal: Principal = Depends(require("UPLOAD_EVIDENCE"))):
    """Step 1 of an upload: registers the evidence record and returns a presigned S3
    POST. The client then sends the file straight to S3 (it never passes through
    Lambda, so large videos are fine)."""
    if body.contentType not in config.ALLOWED_EVIDENCE_TYPES:
        raise HTTPException(415, f"Content type {body.contentType} is not allowed")
    _get_or_404(case_id)

    ev_id = f"ev-{uuid.uuid4().hex[:8]}"
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", body.filename)
    safe_name = re.sub(r"\.{2,}", ".", safe_name).lstrip("._")[-100:] or "file"
    key = f"cases/{case_id}/{ev_id}/{safe_name}"
    evidence = {
        "id": ev_id,
        "type": body.type,
        "title": body.title.strip(),
        "description": body.description.strip(),
        "date": _today(),
        "s3Key": key,
        "contentType": body.contentType,
        "uploadedBy": _officer_name(principal),
    }
    event = {
        "id": f"tl-{uuid.uuid4().hex[:8]}",
        "date": _today(),
        "time": config.now_ist().strftime("%H:%M"),
        "event": f"Evidence added: {evidence['title']}",
        "officer": evidence["uploadedBy"],
        "type": "evidence",
    }
    if not db.append_evidence(case_id, evidence, event):
        raise HTTPException(404, f"Case {case_id} not found")
    return {"evidence": evidence, "upload": db.presigned_upload(key, body.contentType)}
