from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class Contact(BaseModel):
    name: str
    role: str = ""
    email: str = ""
    demo: bool = False
    demoEmail: bool = False


class PastEvent(BaseModel):
    name: str
    role: str = ""
    demo: bool = False
    confirmed: bool = False


class EventApplication(BaseModel):
    id: str
    slug: str
    name: str
    community: str = ""
    contact: Contact | None = None
    purpose: str = ""
    oneLine: str = ""
    date: str = ""
    dateDemo: bool = False
    location: str = ""
    expectedAttendance: int | None = None
    attendanceDemo: bool = False
    audience: str = ""
    supportRequested: list[str] = Field(default_factory=list)
    benefitsOffered: list[str] = Field(default_factory=list)
    applicationDeadline: str = ""
    deadlineDemo: bool = False
    tracks: list[str] = Field(default_factory=list)
    leadTimeWeeks: int | None = None
    rating: float = 3.5
    pastEvents: list[PastEvent] = Field(default_factory=list)
    prospectusId: str | None = None
    prospectusText: str | None = None
    prospectusCover: str | None = None
    logoData: str | None = None
    submitted: bool = False
    demo: bool = True
    missingFields: list[str] = Field(default_factory=list)


class SponsorProfile(BaseModel):
    id: str
    name: str
    kind: str = "technology"
    source: str = ""
    sourceConfirmed: bool = False
    tagline: str = ""
    logoData: str | None = None
    contact: Contact | None = None
    goals: str = ""
    targetAudience: str = ""
    minRequirements: str = ""
    supportAvailable: list[str] = Field(default_factory=list)
    limits: str = ""
    benefitsExpected: list[str] = Field(default_factory=list)
    tracksLookingFor: list[str] = Field(default_factory=list)
    leadTimeWeeks: int | None = None
    rating: float = 3.5
    pastEvents: list[PastEvent] = Field(default_factory=list)
    demo: bool = True


class Terms(BaseModel):
    funding: str = ""
    credits: str = ""
    venue: str = ""
    mentors: str = ""
    prizes: str = ""
    promotion: str = ""
    recruitment: str = ""
    notes: str = ""


class Message(BaseModel):
    id: str
    authorRole: Literal["organiser", "sponsor", "system"]
    authorName: str
    body: str
    createdAt: str


class PartnershipRequest(BaseModel):
    id: str
    eventId: str
    sponsorId: str
    initiatedBy: Literal["organiser", "sponsor"]
    status: Literal["requested", "counter", "confirmed", "declined"]
    terms: Terms
    messages: list[Message] = Field(default_factory=list)
    createdAt: str
    updatedAt: str


class MatchExplanation(BaseModel):
    whyRelevant: str
    aligned: list[str]
    missing: list[str]
    supporting: list[str]
    connections: list[str] = Field(default_factory=list)


class ComponentScores(BaseModel):
    audience: float = 0
    tracks: float = 0
    support: float = 0
    location: float = 0
    leadTime: float = 0
    history: float = 0


class Match(BaseModel):
    eventId: str
    sponsorId: str
    score: float
    rankBoost: float
    explanation: MatchExplanation
    components: ComponentScores = Field(default_factory=ComponentScores)
    source: Literal["cognee", "graph", "hybrid"]


class ParseResult(BaseModel):
    extracted: dict[str, Any]
    missingFields: list[str]
    rawText: str
