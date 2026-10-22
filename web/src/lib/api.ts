import { emptyTerms, type EventApplication, type Match, type PartnershipRequest, type SponsorProfile, type Terms } from "./types";

const BASE = "/backend";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 200) || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  meta: () => req<{ disclaimer: string; cognee: { available: boolean; ingested: boolean; reason: string } }>("/meta"),
  events: () => req<EventApplication[]>("/events"),
  event: (id: string) => req<EventApplication>(`/events/${id}`),
  saveEvent: (event: EventApplication) =>
    req<EventApplication>("/events", { method: "POST", body: JSON.stringify(event) }),
  sponsors: () => req<SponsorProfile[]>("/sponsors"),
  sponsor: (id: string) => req<SponsorProfile>(`/sponsors/${id}`),
  saveSponsor: (sponsor: SponsorProfile) =>
    req<SponsorProfile>("/sponsors", { method: "POST", body: JSON.stringify(sponsor) }),
  matches: (q: { eventId?: string; sponsorId?: string }) => {
    const params = new URLSearchParams(q as Record<string, string>);
    return req<Match[]>(`/matches?${params.toString()}`);
  },
  sampleProspectus: () => req<{ filename: string; text: string }>("/prospectus/sample"),
  parseProspectus: async (file?: File, text?: string) => {
    if (file) {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${BASE}/prospectus/parse`, { method: "POST", body });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ extracted: Record<string, unknown>; missingFields: string[]; rawText: string }>;
    }
    return req<{ extracted: Record<string, unknown>; missingFields: string[]; rawText: string }>(
      "/prospectus/parse-text",
      { method: "POST", body: JSON.stringify({ text: text || "" }) },
    );
  },
  requests: (q?: { eventId?: string; sponsorId?: string }) => {
    const params = new URLSearchParams(q || {});
    return req<PartnershipRequest[]>(`/requests?${params.toString()}`);
  },
  request: (id: string) => req<PartnershipRequest>(`/requests/${id}`),
  createRequest: (payload: {
    eventId: string;
    sponsorId: string;
    initiatedBy: "organiser" | "sponsor";
    terms: Terms;
    authorName: string;
    body: string;
  }) => req<PartnershipRequest>("/requests", { method: "POST", body: JSON.stringify(payload) }),
  patchRequest: (
    id: string,
    payload: Partial<{ status: string; terms: Terms; authorRole: string; authorName: string; message: string }>,
  ) => req<PartnershipRequest>(`/requests/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
};

export type ParsePayload = {
  extracted: Record<string, unknown>;
  missingFields: string[];
  rawText: string;
};

export function blankEvent(): EventApplication {
  return {
    id: `event-${Date.now()}`,
    slug: "",
    name: "",
    community: "",
    contact: { name: "", role: "", email: "", demo: true },
    purpose: "",
    oneLine: "",
    date: "",
    location: "",
    expectedAttendance: null,
    audience: "",
    supportRequested: [],
    benefitsOffered: [],
    applicationDeadline: "",
    tracks: [],
    leadTimeWeeks: null,
    rating: 4.2,
    pastEvents: [],
    prospectusCover: null,
    logoData: null,
    submitted: false,
    demo: true,
  };
}

export function applyParseToEvent(event: EventApplication, parsed: ParsePayload, extras?: Partial<EventApplication>): EventApplication {
  const x = parsed.extracted;
  const contactRaw = String(x.contactRaw || "");
  const email = contactRaw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || event.contact?.email || "";
  return {
    ...event,
    name: String(x.name || event.name),
    community: String(x.community || event.community),
    purpose: String(x.purpose || event.purpose),
    oneLine: String(x.purpose || event.oneLine || ""),
    date: String(x.date || event.date),
    location: String(x.location || event.location),
    expectedAttendance: typeof x.expectedAttendance === "number" ? x.expectedAttendance : event.expectedAttendance,
    audience: String(x.audience || event.audience),
    supportRequested: Array.isArray(x.supportRequested) ? (x.supportRequested as string[]) : event.supportRequested,
    benefitsOffered: Array.isArray(x.benefitsOffered) ? (x.benefitsOffered as string[]) : event.benefitsOffered,
    applicationDeadline: String(x.applicationDeadline || event.applicationDeadline),
    tracks: Array.isArray(x.tracks) ? (x.tracks as string[]) : event.tracks,
    leadTimeWeeks: typeof x.leadTimeWeeks === "number" ? x.leadTimeWeeks : event.leadTimeWeeks,
    prospectusText: parsed.rawText,
    contact: { name: event.contact?.name || "", role: event.contact?.role || "", email, demo: true },
    ...extras,
  };
}

export function unresolvedFields(event: EventApplication): string[] {
  const missing: string[] = [];
  if (!event.name.trim()) missing.push("name");
  if (!event.community.trim()) missing.push("community");
  if (!event.contact?.email?.trim()) missing.push("contact");
  if (!event.purpose.trim()) missing.push("purpose");
  if (!event.date.trim()) missing.push("date");
  if (!event.location.trim()) missing.push("location");
  if (event.expectedAttendance == null) missing.push("expectedAttendance");
  if (!event.audience.trim()) missing.push("audience");
  if (!event.supportRequested.length) missing.push("supportRequested");
  if (!event.benefitsOffered.length) missing.push("benefitsOffered");
  if (!event.applicationDeadline.trim()) missing.push("applicationDeadline");
  if (!event.tracks.length) missing.push("tracks");
  return missing;
}

export function suggestedTerms(event: EventApplication, sponsor: SponsorProfile): Terms {
  const terms = emptyTerms();
  if (event.supportRequested.includes("credits") && sponsor.supportAvailable.includes("credits")) {
    terms.credits = "Platform credits for registered teams (demo).";
  }
  if (event.supportRequested.includes("mentors") && sponsor.supportAvailable.includes("mentors")) {
    terms.mentors = "One mentor block during the build (demo).";
  }
  if (event.supportRequested.includes("prizes") && sponsor.supportAvailable.includes("prizes")) {
    terms.prizes = "Track prize or swag (demo).";
  }
  if (event.supportRequested.includes("funding") && sponsor.supportAvailable.includes("funding")) {
    terms.funding = "Catering / accessibility contribution (demo).";
  }
  if (event.supportRequested.includes("venue") && sponsor.supportAvailable.includes("venue")) {
    terms.venue = "Venue support if geography allows.";
  }
  terms.promotion = sponsor.benefitsExpected[0] || "Logo + opening mention.";
  terms.notes = "Demo proposal. Not a real commitment.";
  return terms;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || `org-${Date.now()}`;
}
