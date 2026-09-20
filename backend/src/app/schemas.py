from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

Priority = Literal["urgent", "review", "routine"]
CaseStatus = Literal["open", "closed", "pending"]
EvidenceType = Literal["document", "photo", "cctv", "sketch", "screenshot", "audio"]
ShortStr = Annotated[str, StringConstraints(max_length=100)]


class LoginBody(BaseModel):
    badgeNumber: str = Field(min_length=1, max_length=40)
    pin: str = Field(min_length=4, max_length=12)


class CaseCreate(BaseModel):
    """Fields the FIR form collects. id, FIR number, officer and timeline are set
    server-side so a client can't spoof who filed a case."""
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=5000)
    complainant: str = Field(min_length=1, max_length=120)
    complainantPhone: str | None = Field(default=None, max_length=20)
    category: str = Field(default="other", max_length=30)
    priority: Priority = "routine"
    location: str = Field(min_length=1, max_length=200)
    sector: str = Field(default="", max_length=60)
    entities: list[ShortStr] = Field(default_factory=list, max_length=30)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class CasePatch(BaseModel):
    status: CaseStatus | None = None
    priority: Priority | None = None
    footerNote: str | None = Field(default=None, max_length=500)
    linkedCases: list[ShortStr] | None = Field(default=None, max_length=50)
    investigatingOfficer: str | None = Field(default=None, max_length=120)  # needs ASSIGN_OFFICERS


class TimelineEventBody(BaseModel):
    event: str = Field(min_length=1, max_length=200)
    note: str | None = Field(default=None, max_length=1000)


class EvidenceCreate(BaseModel):
    type: EvidenceType
    title: str = Field(min_length=1, max_length=150)
    description: str = Field(default="", max_length=1000)
    filename: str = Field(min_length=1, max_length=150)
    contentType: str = Field(max_length=80)


class HistoryMsg(BaseModel):
    role: Literal["user", "copilot", "assistant"]
    content: str = Field(max_length=4000)


class CopilotBody(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    history: list[HistoryMsg] = Field(default_factory=list, max_length=30)
