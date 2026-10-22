from __future__ import annotations

import json
import os
import uuid
from datetime import UTC, datetime
from pathlib import Path

from models import EventApplication, Message, PartnershipRequest, SponsorProfile, Terms


def _data_dir() -> Path:
    env = os.environ.get("TBC_DATA_DIR")
    if env:
        return Path(env)
    here = Path(__file__).resolve().parent
    for candidate in (here.parent / "data", here / "data"):
        if (candidate / "seed.json").exists():
            return candidate
    return here.parent / "data"


def _writable_state_path(data_dir: Path) -> Path:
    preferred = data_dir / "state.json"
    probe = data_dir / ".write-test"
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
        probe.write_text("ok")
        probe.unlink(missing_ok=True)
        return preferred
    except OSError:
        return Path(os.environ.get("TMPDIR") or "/tmp") / "tbc-state.json"


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = _data_dir()
SEED_PATH = DATA_DIR / "seed.json"
STATE_PATH = _writable_state_path(DATA_DIR)
PROSPECTUS_PATH = DATA_DIR / "impact-hack-prospectus.txt"


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


class Store:
    def __init__(self) -> None:
        self.events: dict[str, EventApplication] = {}
        self.sponsors: dict[str, SponsorProfile] = {}
        self.requests: dict[str, PartnershipRequest] = {}
        self.disclaimer = ""
        self.load_seed()

    def load_seed(self) -> None:
        payload = json.loads(SEED_PATH.read_text())
        self.disclaimer = payload.get("disclaimer", "")
        for item in payload["events"]:
            event = EventApplication.model_validate(item)
            self.events[event.id] = event
        for item in payload["sponsors"]:
            sponsor = SponsorProfile.model_validate(item)
            self.sponsors[sponsor.id] = sponsor
        for item in payload.get("requests", []):
            req = PartnershipRequest.model_validate(item)
            self.requests[req.id] = req
        if STATE_PATH.exists():
            state = json.loads(STATE_PATH.read_text())
            for item in state.get("events", []):
                event = EventApplication.model_validate(item)
                self.events[event.id] = event
            for item in state.get("sponsors", []):
                sponsor = SponsorProfile.model_validate(item)
                self.sponsors[sponsor.id] = sponsor
            for item in state.get("requests", []):
                req = PartnershipRequest.model_validate(item)
                self.requests[req.id] = req

    def persist(self) -> None:
        STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        STATE_PATH.write_text(
            json.dumps(
                {
                    "events": [e.model_dump() for e in self.events.values()],
                    "sponsors": [s.model_dump() for s in self.sponsors.values()],
                    "requests": [r.model_dump() for r in self.requests.values()],
                },
                indent=2,
            )
        )

    def upsert_event(self, event: EventApplication) -> EventApplication:
        self.events[event.id] = event
        self.persist()
        return event

    def upsert_sponsor(self, sponsor: SponsorProfile) -> SponsorProfile:
        self.sponsors[sponsor.id] = sponsor
        self.persist()
        return sponsor

    def create_request(
        self,
        event_id: str,
        sponsor_id: str,
        initiated_by: str,
        terms: Terms,
        author_name: str,
        body: str,
    ) -> PartnershipRequest:
        req_id = str(uuid.uuid4())[:8]
        req = PartnershipRequest(
            id=req_id,
            eventId=event_id,
            sponsorId=sponsor_id,
            initiatedBy=initiated_by,  # type: ignore[arg-type]
            status="requested",
            terms=terms,
            messages=[
                Message(
                    id=str(uuid.uuid4())[:8],
                    authorRole=initiated_by,  # type: ignore[arg-type]
                    authorName=author_name,
                    body=body,
                    createdAt=_now(),
                )
            ],
            createdAt=_now(),
            updatedAt=_now(),
        )
        self.requests[req.id] = req
        self.persist()
        return req

    def update_request(self, req: PartnershipRequest) -> PartnershipRequest:
        req.updatedAt = _now()
        self.requests[req.id] = req
        self.persist()
        return req


store = Store()
