from __future__ import annotations

from models import (
    ComponentScores,
    EventApplication,
    Match,
    MatchExplanation,
    SponsorProfile,
)

SUPPORT = ("funding", "credits", "venue", "mentors", "prizes")


def _norm(value: str) -> set[str]:
    tokens = set()
    for raw in value.lower().replace("/", " ").replace("-", " ").split():
        token = "".join(ch for ch in raw if ch.isalnum())
        if len(token) > 2 and token not in {
            "and",
            "the",
            "for",
            "with",
            "from",
            "that",
            "this",
            "are",
            "our",
        }:
            tokens.add(token)
    return tokens


def _list_tokens(items: list[str]) -> set[str]:
    tokens: set[str] = set()
    for item in items:
        tokens |= _norm(item)
    return tokens


def explain_pair(event: EventApplication, sponsor: SponsorProfile) -> Match:
    event_text = " ".join(
        [
            event.name,
            event.purpose,
            event.audience,
            event.location,
            " ".join(event.tracks),
        ]
    )
    sponsor_text = " ".join(
        [
            sponsor.name,
            sponsor.goals,
            sponsor.targetAudience,
            sponsor.minRequirements,
            " ".join(sponsor.tracksLookingFor),
        ]
    )

    aligned: list[str] = []
    missing: list[str] = []
    supporting: list[str] = []
    connections: list[str] = []
    score = 0.0

    support_overlap = set(event.supportRequested) & set(sponsor.supportAvailable)
    support_gap = set(event.supportRequested) - set(sponsor.supportAvailable)
    if support_overlap:
        aligned.append(
            f"Support overlap: {', '.join(sorted(support_overlap))}."
        )
        score += 18 * len(support_overlap)
    if support_gap:
        missing.append(
            f"Still needs agreement on: {', '.join(sorted(support_gap))} (not listed as available)."
        )
        score -= 4 * len(support_gap)

    track_overlap = _list_tokens(event.tracks) & _list_tokens(sponsor.tracksLookingFor)
    if track_overlap:
        aligned.append(f"Shared track language: {', '.join(sorted(track_overlap))}.")
        score += 10 * min(len(track_overlap), 4)

    audience_overlap = _norm(event.audience) & _norm(sponsor.targetAudience + " " + sponsor.goals)
    interesting = audience_overlap & {
        "student",
        "students",
        "hackathon",
        "organiser",
        "organizers",
        "organisers",
        "community",
        "builder",
        "builders",
        "developer",
        "engineers",
        "university",
        "ai",
        "agent",
        "agents",
    }
    if interesting:
        aligned.append(f"Audience fit: {', '.join(sorted(interesting))}.")
        score += 8 * min(len(interesting), 5)

    if event.location and event.location.lower() not in sponsor.minRequirements.lower():
        if "london" in sponsor.minRequirements.lower() and "bristol" in event.location.lower():
            missing.append(
                "Location gap: sponsor requirements mention London; the event is in Bristol."
            )
            score -= 25
        elif "london" in (sponsor.limits or "").lower() and "bristol" in event.location.lower():
            missing.append(
                "Venue constraint: listed space is London-only; Bristol venue still needs agreement."
            )
            score -= 20

    if event.leadTimeWeeks and sponsor.leadTimeWeeks:
        if sponsor.leadTimeWeeks <= event.leadTimeWeeks:
            aligned.append(
                f"Lead time works: sponsor needs {sponsor.leadTimeWeeks}w, event offers {event.leadTimeWeeks}w."
            )
            score += 6
        else:
            missing.append(
                f"Lead time: sponsor typically needs {sponsor.leadTimeWeeks} weeks; event window is {event.leadTimeWeeks}."
            )

    for past in sponsor.pastEvents:
        connections.append(
            f"{sponsor.name} previously appeared as {past.role} at {past.name}"
            + (" (confirmed)" if past.confirmed else " (demo)")
        )
        if "hackathon" in past.name.lower():
            score += 6

    for past in event.pastEvents:
        supporting.append(f"Event history: {past.name} ({past.role}).")

    supporting.append(f"Sponsor rating {sponsor.rating:.1f} — higher-rated profiles are pushed first.")
    supporting.append(f"Event rating {event.rating:.1f} — higher-rated applications surface first to sponsors.")
    supporting.append(f"Goals on file: {sponsor.goals[:180]}")
    supporting.append(f"Requested support: {', '.join(event.supportRequested) or 'none listed'}.")

    if sponsor.limits:
        missing.append(f"Limits to confirm: {sponsor.limits}")

    rank_boost = (sponsor.rating - 3.5) * 8 + (event.rating - 3.5) * 4
    score = max(0, min(100, score + rank_boost + 20))

    loc_penalty = any("Location gap" in m or "Venue constraint" in m for m in missing)
    components = ComponentScores(
        audience=max(0, min(100, 18 * min(len(interesting), 5) + 20)),
        tracks=max(0, min(100, 22 * min(len(track_overlap), 4) + 12)),
        support=max(0, min(100, 20 * len(support_overlap) + (8 if not support_gap else 0))),
        location=35 if loc_penalty else 88,
        leadTime=82 if event.leadTimeWeeks and sponsor.leadTimeWeeks and sponsor.leadTimeWeeks <= event.leadTimeWeeks else 48,
        history=max(20, min(100, 18 * len(sponsor.pastEvents) + 10 * len(event.pastEvents))),
    )

    why = sponsor.tagline or f"{sponsor.name} · {sponsor.kind}"

    return Match(
        eventId=event.id,
        sponsorId=sponsor.id,
        score=round(score, 1),
        rankBoost=round(rank_boost, 1),
        explanation=MatchExplanation(
            whyRelevant=why,
            aligned=aligned or ["Limited structured overlap — review profiles before requesting."],
            missing=missing or ["Terms still need a first proposal from either side."],
            supporting=supporting,
            connections=connections,
        ),
        components=components,
        source="graph",
    )


def rank_sponsors_for_event(
    event: EventApplication, sponsors: list[SponsorProfile]
) -> list[Match]:
    matches = [explain_pair(event, sponsor) for sponsor in sponsors]
    return sorted(matches, key=lambda m: (m.score, next(s.rating for s in sponsors if s.id == m.sponsorId)), reverse=True)


def rank_events_for_sponsor(
    sponsor: SponsorProfile, events: list[EventApplication]
) -> list[Match]:
    matches = [explain_pair(event, sponsor) for event in events]
    return sorted(matches, key=lambda m: (m.score, next(e.rating for e in events if e.id == m.eventId)), reverse=True)


def profile_document(kind: str, payload: dict) -> str:
    if kind == "event":
        return (
            f"EVENT {payload.get('name')}\n"
            f"Community: {payload.get('community')}\n"
            f"Location: {payload.get('location')} Date: {payload.get('date')}\n"
            f"Purpose: {payload.get('purpose')}\n"
            f"Audience: {payload.get('audience')} Attendance: {payload.get('expectedAttendance')}\n"
            f"Support requested: {payload.get('supportRequested')}\n"
            f"Benefits offered: {payload.get('benefitsOffered')}\n"
            f"Tracks: {payload.get('tracks')}\n"
            f"Lead time weeks: {payload.get('leadTimeWeeks')}\n"
            f"Rating: {payload.get('rating')}\n"
        )
    return (
        f"SPONSOR {payload.get('name')}\n"
        f"Kind: {payload.get('kind')} Source: {payload.get('source')}\n"
        f"Goals: {payload.get('goals')}\n"
        f"Target audience: {payload.get('targetAudience')}\n"
        f"Minimum requirements: {payload.get('minRequirements')}\n"
        f"Support available: {payload.get('supportAvailable')} Limits: {payload.get('limits')}\n"
        f"Benefits expected: {payload.get('benefitsExpected')}\n"
        f"Tracks: {payload.get('tracksLookingFor')}\n"
        f"Rating: {payload.get('rating')}\n"
        f"Past events: {payload.get('pastEvents')}\n"
    )
