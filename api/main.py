from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from cognee_bridge import apply_cognee_notes, cognee_status, ingest, recall_match_notes
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from matcher import rank_events_for_sponsor, rank_sponsors_for_event
from models import EventApplication, Message, ParseResult, SponsorProfile, Terms
from prospectus import extract_pdf_text, parse_prospectus
from pydantic import BaseModel
from store import PROSPECTUS_PATH, store


@asynccontextmanager
async def lifespan(_: FastAPI):
    extra = []
    if PROSPECTUS_PATH.exists():
        extra.append(PROSPECTUS_PATH.read_text())
    store.cognee = await ingest(
        [e.model_dump() for e in store.events.values()],
        [s.model_dump() for s in store.sponsors.values()],
        extra,
    )
    yield


app = FastAPI(title="TBC matching API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"https://([a-z0-9-]+\.)*(vercel\.app|hack)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EventIn(EventApplication):
    pass


class ParseTextIn(BaseModel):
    text: str | None = None


class RequestIn(BaseModel):
    eventId: str
    sponsorId: str
    initiatedBy: str
    terms: Terms
    authorName: str
    body: str


class RequestPatch(BaseModel):
    status: str | None = None
    terms: Terms | None = None
    authorRole: str | None = None
    authorName: str | None = None
    message: str | None = None


@app.get("/health")
async def health():
    return {"ok": True, "cognee": cognee_status()}


@app.get("/meta")
async def meta():
    return {
        "disclaimer": store.disclaimer,
        "cognee": cognee_status(),
    }


@app.get("/events")
async def list_events():
    events = sorted(store.events.values(), key=lambda e: e.rating, reverse=True)
    return events


@app.get("/events/{event_id}")
async def get_event(event_id: str):
    event = store.events.get(event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    return event


@app.post("/events")
async def upsert_event(event: EventIn):
    return store.upsert_event(event)


@app.get("/sponsors")
async def list_sponsors():
    return sorted(store.sponsors.values(), key=lambda s: s.rating, reverse=True)


@app.get("/sponsors/{sponsor_id}")
async def get_sponsor(sponsor_id: str):
    sponsor = store.sponsors.get(sponsor_id)
    if not sponsor:
        raise HTTPException(404, "Sponsor not found")
    return sponsor


class SponsorIn(SponsorProfile):
    pass


@app.post("/sponsors")
async def upsert_sponsor(sponsor: SponsorIn):
    return store.upsert_sponsor(sponsor)


@app.post("/prospectus/parse", response_model=ParseResult)
async def parse_upload(file: UploadFile = File(...)):
    data = await file.read()
    name = (file.filename or "").lower()
    if name.endswith(".pdf"):
        text = extract_pdf_text(data)
    else:
        text = data.decode("utf-8", errors="ignore")
    return parse_prospectus(text)


@app.post("/prospectus/parse-text", response_model=ParseResult)
async def parse_text(payload: ParseTextIn):
    text = payload.text or PROSPECTUS_PATH.read_text()
    return parse_prospectus(text)


@app.get("/prospectus/sample")
async def sample_prospectus():
    return {"filename": PROSPECTUS_PATH.name, "text": PROSPECTUS_PATH.read_text()}


@app.get("/matches")
async def matches(eventId: str | None = None, sponsorId: str | None = None):
    if eventId:
        event = store.events.get(eventId)
        if not event:
            raise HTTPException(404, "Event not found")
        ranked = rank_sponsors_for_event(event, list(store.sponsors.values()))
        ids = [m.sponsorId for m in ranked]
        notes = await recall_match_notes(
            (
                f"Which sponsors fit event {event.name} (id={event.id}) in {event.location}? "
                f"Audience {event.audience}. Support requested {event.supportRequested}. "
                f"Partner ids: {ids}. "
                f"For each id explain why, aligned requirements, missing terms, "
                f"and supporting profile facts. "
                f"Do not treat Grok Bot participation as availability for Impact Hack."
            ),
            ids,
        )
        return apply_cognee_notes(ranked, notes, "sponsorId")
    if sponsorId:
        sponsor = store.sponsors.get(sponsorId)
        if not sponsor:
            raise HTTPException(404, "Sponsor not found")
        ranked = rank_events_for_sponsor(sponsor, list(store.events.values()))
        ids = [m.eventId for m in ranked]
        notes = await recall_match_notes(
            (
                f"Which events fit sponsor {sponsor.name} (id={sponsor.id})? "
                f"Goals: {sponsor.goals}. Support: {sponsor.supportAvailable}. "
                f"Requirements: {sponsor.minRequirements}. Partner ids: {ids}. "
                f"For each id explain why, aligned requirements, missing terms, "
                f"and supporting profile facts."
            ),
            ids,
        )
        return apply_cognee_notes(ranked, notes, "eventId")
    raise HTTPException(400, "eventId or sponsorId required")


@app.get("/requests")
async def list_requests(eventId: str | None = None, sponsorId: str | None = None):
    items = list(store.requests.values())
    if eventId:
        items = [r for r in items if r.eventId == eventId]
    if sponsorId:
        items = [r for r in items if r.sponsorId == sponsorId]
    return sorted(items, key=lambda r: r.updatedAt, reverse=True)


@app.get("/requests/{request_id}")
async def get_request(request_id: str):
    req = store.requests.get(request_id)
    if not req:
        raise HTTPException(404, "Request not found")
    return req


@app.post("/requests")
async def create_request(payload: RequestIn):
    if payload.eventId not in store.events or payload.sponsorId not in store.sponsors:
        raise HTTPException(400, "Unknown event or sponsor")
    return store.create_request(
        payload.eventId,
        payload.sponsorId,
        payload.initiatedBy,
        payload.terms,
        payload.authorName,
        payload.body,
    )


@app.patch("/requests/{request_id}")
async def patch_request(request_id: str, payload: RequestPatch):
    req = store.requests.get(request_id)
    if not req:
        raise HTTPException(404, "Request not found")
    if payload.terms:
        req.terms = payload.terms
    if payload.status:
        if payload.status not in {"requested", "counter", "confirmed", "declined"}:
            raise HTTPException(400, "Invalid status")
        req.status = payload.status  # type: ignore[assignment]
    if payload.message and payload.authorRole and payload.authorName:
        req.messages.append(
            Message(
                id=str(uuid.uuid4())[:8],
                authorRole=payload.authorRole,  # type: ignore[arg-type]
                authorName=payload.authorName,
                body=payload.message,
                createdAt=datetime.now(UTC).isoformat(timespec="seconds"),
            )
        )
    return store.update_request(req)
