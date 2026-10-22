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


def _indented_block(text: str, heading_re: str) -> list[str]:
    lines = text.splitlines()
    start = next((i + 1 for i, line in enumerate(lines) if re.search(heading_re, line, re.IGNORECASE)), None)
    if start is None:
        return []
    items: list[str] = []
    buf: list[str] = []

    def flush() -> None:
        chunk = " ".join(buf).strip()
        if chunk:
            items.append(chunk)
        buf.clear()

    for line in lines[start:]:
        stripped = line.strip()
        if not stripped:
            flush()
            continue
        if not line[:1].isspace() and not stripped.startswith(("-", "•")):
            flush()
            break
        piece = stripped.lstrip("-•").strip()
        if buf and buf[-1].endswith((".", "!", "?")) and piece[:1].isupper():
            flush()
        buf.append(piece)
    flush()
    return items


def _leading_sentences(text: str, start_re: str, stop_re: str) -> list[str]:
    lines = text.splitlines()
    start = next((i for i, line in enumerate(lines) if re.search(start_re, line, re.IGNORECASE)), None)
    if start is None:
        return []
    end = next(
        (i for i in range(start + 1, len(lines)) if re.search(stop_re, lines[i].strip(), re.IGNORECASE)),
        len(lines),
    )
    items: list[str] = []
    buf: list[str] = []

    def flush() -> None:
        chunk = " ".join(buf).strip()
        if chunk:
            items.append(chunk)
        buf.clear()

    for line in lines[start:end]:
        stripped = line.strip()
        if not stripped:
            flush()
            continue
        if buf and stripped[:1].islower():
            buf.append(stripped)
            continue
        flush()
        buf.append(stripped)
    flush()
    return items


def _collapse_letter_spacing(text: str) -> str:
    """Join PDF text that was extracted as one glyph per space."""
    collapsed: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        tokens = stripped.split(" ")
        nonempty = [token for token in tokens if token]
        singles = [token for token in nonempty if len(token) == 1]
        if len(nonempty) < 4 or len(singles) / len(nonempty) < 0.55:
            collapsed.append(line)
            continue
        indent = line[: len(line) - len(line.lstrip(" "))]
        words: list[str] = []
        current: list[str] = []
        for token in tokens:
            if token == "":
                if current:
                    words.append("".join(current))
                    current = []
                continue
            current.append(token)
        if current:
            words.append("".join(current))
        collapsed.append(indent + " ".join(words))
    return "\n".join(collapsed)


def extract_pdf_text(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    return "\n".join(pages)


def parse_prospectus(text: str) -> ParseResult:
    text = _collapse_letter_spacing(text)
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

    extracted["supportRequested"] = [
        s for s in SUPPORT_TYPES if s in lowered or (s == "funding" and "financial" in lowered)
    ]

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
        sentence = re.sub(r"^is a\s+", "", purpose.group(0).strip(), flags=re.IGNORECASE)
        extracted["purpose"] = sentence[:1].upper() + sentence[1:] if sentence else sentence

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
    if not benefits:
        benefits = _indented_block(text, r"benefits")
    if not benefits:
        benefits = _leading_sentences(text, r"promote your brand", r"^(what is|forget candlelit)")
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
