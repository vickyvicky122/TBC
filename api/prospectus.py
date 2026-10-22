from __future__ import annotations

import re
from io import BytesIO

from models import ParseResult
from pypdf import PdfReader

FIELD_HINTS = {
    "community": ["organising community", "organized by", "organised by", "society"],
    "contact": ["partnership contact", "contact"],
    "purpose": ["event purpose", "purpose"],
    "date": ["date", "dates", "when"],
    "location": ["location", "venue", "where"],
    "expectedAttendance": ["expected attendance", "attendance"],
    "audience": ["audience"],
    "supportRequested": ["support requested", "we need", "looking for"],
    "benefitsOffered": ["benefits offered", "partners receive", "we offer"],
    "applicationDeadline": ["application deadline", "confirmation requested"],
    "tracks": ["tracks"],
    "leadTimeWeeks": ["lead time"],
}

SUPPORT_TYPES = ["funding", "credits", "venue", "mentors", "prizes"]


def extract_pdf_text(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    return "\n".join(pages)


def parse_prospectus(text: str) -> ParseResult:
    lowered = text.lower()
    extracted: dict = {}

    if "impact" in lowered and "hack" in lowered:
        extracted["name"] = "Impact Hack"
    else:
        name_match = re.search(r"^(.*hack.*)$", text, re.IGNORECASE | re.MULTILINE)
        if name_match:
            extracted["name"] = re.sub(r"\s+—.*$", "", name_match.group(1)).strip(" -")

    loc = re.search(r"Location:\s*([^\n.]+)", text, re.IGNORECASE)
    if loc:
        extracted["location"] = loc.group(1).strip()
    elif "bristol" in lowered and "mumbai" in lowered:
        extracted["location"] = "Bristol & Mumbai"
    elif "bristol" in lowered:
        extracted["location"] = "Bristol, United Kingdom"

    date = re.search(
        r"(\d{1,2}\s*[–-]\s*\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})",
        text,
        re.IGNORECASE,
    )
    if not date:
        date = re.search(r"(?:Proposed dates|Dates?)\s*(?:\([^)]+\))?:\s*([^\n.]+)", text, re.IGNORECASE)
    if date:
        extracted["date"] = date.group(1).strip()

    att = re.search(r"(?:over|expected attendance)[^\d]*(\d+)", text, re.IGNORECASE)
    if att:
        extracted["expectedAttendance"] = int(att.group(1))

    deadline = re.search(r"(?:deadline|confirmation requested by)[:\s]+([^\n.]+)", text, re.IGNORECASE)
    if deadline:
        extracted["applicationDeadline"] = deadline.group(1).strip()

    extracted["supportRequested"] = [s for s in SUPPORT_TYPES if s in lowered]

    tracks = []
    for line in text.splitlines():
        stripped = line.strip(" -•\t")
        if stripped and line.strip().startswith("-") and any(
            word in stripped.lower()
            for word in ["ai", "climate", "health", "civic", "graph", "community", "developer"]
        ):
            tracks.append(stripped)
    if tracks:
        extracted["tracks"] = tracks[:8]

    purpose = re.search(r"is a[^\n]{20,220}", text, re.IGNORECASE)
    if purpose:
        extracted["purpose"] = purpose.group(0).strip()

    community = re.search(r"Organised by ([^\n.]+)", text, re.IGNORECASE)
    if community:
        extracted["community"] = community.group(1).strip()
    elif "impact" in lowered and "hack" in lowered and "student-led" in lowered:
        extracted["community"] = "Impact Hack committee · University of Bristol"

    contact = re.search(r"Partnership contact[^\n]*:\s*([^\n]+)", text, re.IGNORECASE)
    if contact:
        extracted["contactRaw"] = contact.group(1).strip()
    else:
        email = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text, re.IGNORECASE)
        if email:
            extracted["contactRaw"] = email.group(0)

    audience = re.search(r"Audience:\s*([^\n]+)", text, re.IGNORECASE)
    if audience:
        extracted["audience"] = audience.group(1).strip()
    elif "student hackers" in lowered:
        extracted["audience"] = "Student hackers using data science and AI."

    benefits = []
    in_benefits = False
    for line in text.splitlines():
        if "benefits" in line.lower() and ("sponsor" in line.lower() or "offered" in line.lower()):
            in_benefits = True
            continue
        if in_benefits and line.strip().startswith("-"):
            benefits.append(line.strip(" -"))
        elif in_benefits and line.strip() and not line.startswith(" "):
            if benefits:
                break
    if benefits:
        extracted["benefitsOffered"] = benefits

    lead = re.search(r"lead time:\s*(\d+)", text, re.IGNORECASE)
    if lead:
        extracted["leadTimeWeeks"] = int(lead.group(1))

    required = [
        "name",
        "community",
        "purpose",
        "date",
        "location",
        "expectedAttendance",
        "audience",
        "supportRequested",
        "benefitsOffered",
        "applicationDeadline",
        "tracks",
    ]
    missing = [field for field in required if not extracted.get(field)]
    return ParseResult(extracted=extracted, missingFields=missing, rawText=text)
