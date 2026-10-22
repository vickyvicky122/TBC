from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import httpx
from matcher import profile_document
from models import Match
from pydantic import BaseModel, Field

DATASET = "tbc_partnerships"
ROOT = Path(__file__).resolve().parents[1]
RECALL_TIMEOUT = 45.0
INGEST_TIMEOUT = 90.0
META_TIMEOUT = 15.0

_STATE: dict[str, Any] = {
    "ingested": False,
    "mode": None,
    "error": None,
    "documents": 0,
}

INGEST_PROMPT = (
    "Extract entities: Event, Sponsor, Community, Person, SupportType, Track, Location. "
    "Connect REQUESTS, OFFERS, TARGETS, PREVIOUSLY_PARTNERED, LOCATED_IN. "
    "Do not treat Grok Bot hackathon participation as availability for other events. "
    "Invented emails, ratings, inventory and commercial terms are demo data."
)

RECALL_PROMPT = (
    "You explain partnership matches from the tbc_partnerships memory. "
    "Return why the pair is relevant, aligned requirements, missing terms, "
    "and supporting profile facts. Use the provided partner ids. "
    "Do not treat Grok Bot hackathon participation as availability for other events."
)


class FitNote(BaseModel):
    id: str
    why: str = ""
    aligned: list[str] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    supporting: list[str] = Field(default_factory=list)


class FitNotes(BaseModel):
    matches: list[FitNote] = Field(default_factory=list)


def _parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if key:
            values[key] = value
    return values


def load_env() -> None:
    merged: dict[str, str] = {}
    for path in (
        Path.home() / ".cognee" / ".env",
        Path(__file__).resolve().parent / ".env",
        ROOT / ".env",
        ROOT / ".env.local",
    ):
        merged.update(_parse_env_file(path))
    for key, value in merged.items():
        os.environ.setdefault(key, value)


load_env()


def _cloud_url() -> str | None:
    raw = os.environ.get("COGNEE_SERVICE_URL") or os.environ.get("COGNEE_BASE_URL")
    if not raw:
        return None
    return raw.rstrip("/")


def _cloud_key() -> str | None:
    key = os.environ.get("COGNEE_API_KEY")
    return key.strip() if key and key.strip() else None


def _tenant_id() -> str | None:
    tenant = os.environ.get("COGNEE_TENANT_ID")
    return tenant.strip() if tenant and tenant.strip() else None


def _user_id() -> str | None:
    user = os.environ.get("COGNEE_USER_ID")
    return user.strip() if user and user.strip() else None


def cloud_configured() -> bool:
    return bool(_cloud_url() and _cloud_key())


def _headers() -> dict[str, str]:
    # Cloud REST auth is X-Api-Key (+ optional X-Tenant-Id). User ID is not a key.
    headers = {"X-Api-Key": _cloud_key() or ""}
    tenant = _tenant_id()
    if tenant:
        headers["X-Tenant-Id"] = tenant
    return headers


def _credential_reason() -> str:
    if cloud_configured():
        return "Cognee Cloud HTTP client ready (COGNEE_SERVICE_URL + COGNEE_API_KEY)."
    if _cloud_url() and not _cloud_key():
        tenant = _tenant_id() or "unknown tenant"
        return (
            f"Cognee Cloud URL is set ({tenant}) but COGNEE_API_KEY is missing. "
            "Paste an API key from Cognee Cloud → API Keys; do not use the user id as the key. "
            "Structured graph matching stays active until then."
        )
    if _cloud_url() or _cloud_key():
        return "Cognee Cloud is incomplete: set both COGNEE_SERVICE_URL and COGNEE_API_KEY."
    return (
        "Cognee Cloud is unconfigured. Redeem GROKBOT35 in Cognee Cloud Billing "
        "(profile → Billing → Have a code?), create an API key, then set "
        "COGNEE_SERVICE_URL and COGNEE_API_KEY (Vercel: vercel env add). "
        "COGNEE_CREDIT_CODE is a Billing coupon, not an API key. "
        "Structured graph matching stays active as fallback."
    )


def cognee_status() -> dict[str, Any]:
    reason = _credential_reason()
    if _STATE.get("error"):
        reason = f"{reason} Last error: {_STATE['error']}"
    return {
        "available": cloud_configured(),
        "ingested": bool(_STATE.get("ingested")),
        "mode": _STATE.get("mode") if cloud_configured() else None,
        "dataset": DATASET,
        "cloud": cloud_configured(),
        "service_url": _cloud_url(),
        "tenant_id": _tenant_id(),
        "user_id": _user_id(),
        "api_key_configured": bool(_cloud_key()),
        "credit_code_configured": bool(os.environ.get("COGNEE_CREDIT_CODE")),
        "documents": _STATE.get("documents", 0),
        "reason": reason,
    }


def _error_text(exc: Exception, response: httpx.Response | None = None) -> str:
    if response is not None:
        try:
            payload = response.json()
            detail = payload.get("detail") or payload.get("error") or payload
            return f"HTTP {response.status_code}: {detail}"
        except Exception:
            body = response.text[:400]
            return f"HTTP {response.status_code}: {body}"
    return f"{exc.__class__.__name__}: {exc}"


def _dataset_names(payload: Any) -> list[str]:
    rows: list[Any]
    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        rows = payload.get("data") or payload.get("datasets") or payload.get("items") or []
        if isinstance(rows, dict):
            rows = list(rows.values())
    else:
        return []
    names: list[str] = []
    for row in rows:
        if isinstance(row, str):
            names.append(row)
        elif isinstance(row, dict):
            name = row.get("name") or row.get("dataset_name") or row.get("datasetName")
            if name:
                names.append(str(name))
    return names


async def _dataset_exists(client: httpx.AsyncClient) -> bool:
    response = await client.get("/api/v1/datasets")
    response.raise_for_status()
    return DATASET in _dataset_names(response.json())


def _multipart_docs(docs: list[str]) -> list[tuple[str, tuple[None, str]]]:
    return [("raw_data", (None, doc)) for doc in docs]


async def _remember(client: httpx.AsyncClient, docs: list[str]) -> None:
    response = await client.post(
        "/api/v1/remember",
        data={
            "datasetName": DATASET,
            "custom_prompt": INGEST_PROMPT,
            "self_improvement": "false",
        },
        files=_multipart_docs(docs),
        timeout=INGEST_TIMEOUT,
    )
    if response.status_code >= 400:
        raise httpx.HTTPStatusError(
            "remember failed", request=response.request, response=response
        )


async def _add_then_cognify(client: httpx.AsyncClient, docs: list[str]) -> None:
    added = await client.post(
        "/api/v1/add",
        data={"datasetName": DATASET},
        files=_multipart_docs(docs),
        timeout=INGEST_TIMEOUT,
    )
    if added.status_code >= 400:
        raise httpx.HTTPStatusError("add failed", request=added.request, response=added)
    cognified = await client.post(
        "/api/v1/cognify",
        json={
            "datasets": [DATASET],
            "custom_prompt": INGEST_PROMPT,
            "run_in_background": False,
        },
        timeout=INGEST_TIMEOUT,
    )
    if cognified.status_code >= 400:
        raise httpx.HTTPStatusError(
            "cognify failed", request=cognified.request, response=cognified
        )


async def ingest(
    events: list[dict],
    sponsors: list[dict],
    extra_texts: list[str] | None = None,
) -> dict[str, Any]:
    status = cognee_status()
    if not cloud_configured():
        status["ingested"] = False
        status["mode"] = None
        return status

    docs = [profile_document("event", e) for e in events]
    docs += [profile_document("sponsor", s) for s in sponsors]
    if extra_texts:
        docs.extend(text for text in extra_texts if text and text.strip())

    url = _cloud_url()
    assert url is not None
    try:
        async with httpx.AsyncClient(
            base_url=url,
            headers=_headers(),
            timeout=META_TIMEOUT,
        ) as client:
            if await _dataset_exists(client):
                _STATE["ingested"] = True
                _STATE["mode"] = "cloud"
                _STATE["error"] = None
                _STATE["documents"] = len(docs)
                return cognee_status()
            try:
                await _remember(client, docs)
            except httpx.HTTPStatusError:
                await _add_then_cognify(client, docs)
        _STATE["ingested"] = True
        _STATE["mode"] = "cloud"
        _STATE["error"] = None
        _STATE["documents"] = len(docs)
        return cognee_status()
    except Exception as exc:
        response = getattr(exc, "response", None)
        _STATE["ingested"] = False
        _STATE["mode"] = "cloud"
        _STATE["error"] = _error_text(exc, response if isinstance(response, httpx.Response) else None)
        status = cognee_status()
        status["ingested"] = False
        status["error"] = _STATE["error"]
        return status


def _result_text(item: Any) -> str:
    if isinstance(item, str):
        return item
    if isinstance(item, dict):
        return str(
            item.get("text")
            or item.get("answer")
            or item.get("result")
            or item.get("content")
            or ""
        )
    text = getattr(item, "text", None) or getattr(item, "answer", None)
    return str(text) if text else ""


def _result_structured(item: Any) -> dict[str, Any] | None:
    if isinstance(item, dict):
        payload = item.get("structured")
        if payload is None and "matches" in item:
            payload = item
        if payload is None and isinstance(item.get("data"), dict):
            payload = item["data"]
    else:
        payload = getattr(item, "structured", None)
    if payload is None:
        return None
    if isinstance(payload, dict):
        return payload
    if hasattr(payload, "model_dump"):
        return payload.model_dump()
    return None


def _iter_results(payload: Any) -> list[Any]:
    if payload is None:
        return []
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("results", "data", "items", "matches"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
        return [payload]
    return [payload]


async def recall_match_notes(query: str, partner_ids: list[str]) -> dict[str, FitNote]:
    if not cloud_configured():
        return {}
    url = _cloud_url()
    assert url is not None
    body = {
        "query": query,
        "datasets": [DATASET],
        "search_type": "GRAPH_COMPLETION",
        "system_prompt": RECALL_PROMPT,
        "response_schema": FitNotes.model_json_schema(),
        "include_references": False,
    }
    try:
        async with httpx.AsyncClient(
            base_url=url,
            headers={**_headers(), "Content-Type": "application/json"},
            timeout=RECALL_TIMEOUT,
        ) as client:
            response = await client.post("/api/v1/recall", json=body)
            if response.status_code >= 400:
                response = await client.post(
                    "/api/v1/search",
                    json={**body, "search_type": "GRAPH_COMPLETION"},
                )
            if response.status_code >= 400:
                raise httpx.HTTPStatusError(
                    "recall failed", request=response.request, response=response
                )
            payload = response.json()
    except Exception as exc:
        response = getattr(exc, "response", None)
        _STATE["error"] = _error_text(exc, response if isinstance(response, httpx.Response) else None)
        return {}

    notes: dict[str, FitNote] = {}
    snippets: list[str] = []
    wanted = set(partner_ids)
    for item in _iter_results(payload):
        if isinstance(item, dict) and item.get("source") == "system":
            _STATE["error"] = _result_text(item) or str(item.get("status") or "system")
            continue
        structured = _result_structured(item)
        if structured:
            try:
                parsed = FitNotes.model_validate(structured)
            except Exception:
                parsed = None
            if parsed:
                for note in parsed.matches:
                    if note.id in wanted:
                        notes[note.id] = note
        text = _result_text(item).strip()
        if text:
            snippets.append(text)

    if not notes and snippets:
        fallback = snippets[0][:800]
        for partner_id in partner_ids:
            notes[partner_id] = FitNote(
                id=partner_id,
                supporting=[f"Cognee recall: {fallback}"],
            )
    if notes:
        _STATE["mode"] = "cloud"
        _STATE["error"] = None
    return notes


def apply_cognee_notes(ranked: list[Match], notes: dict[str, FitNote], key: str) -> list[Match]:
    if not notes:
        return ranked
    for match in ranked:
        partner_id = getattr(match, key)
        note = notes.get(partner_id)
        if not note:
            continue
        match.source = "hybrid"
        if note.why:
            match.explanation.whyRelevant = note.why
        if note.aligned:
            match.explanation.aligned = [*note.aligned, *match.explanation.aligned]
        if note.missing:
            match.explanation.missing = [*note.missing, *match.explanation.missing]
        if note.supporting:
            match.explanation.supporting = [*note.supporting, *match.explanation.supporting]
    return ranked
