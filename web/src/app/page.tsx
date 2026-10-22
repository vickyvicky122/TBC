"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LogoMark } from "@/components/brand";
import { CircleDrop, MatchingOverlay } from "@/components/media";
import { setEventId } from "@/components/shell";
import { Button, Field, Input } from "@/components/ui";
import { api, applyParseToEvent, blankEvent, slugify, unresolvedFields } from "@/lib/api";
import { SUPPORT, type EventApplication } from "@/lib/types";

const ROWS: { key: string; label: string }[] = [
  { key: "name", label: "Event" },
  { key: "community", label: "Community" },
  { key: "contact", label: "Contact" },
  { key: "purpose", label: "Purpose" },
  { key: "date", label: "Date" },
  { key: "location", label: "Location" },
  { key: "expectedAttendance", label: "Headcount" },
  { key: "audience", label: "Audience" },
  { key: "supportRequested", label: "Support" },
  { key: "benefitsOffered", label: "Benefits" },
  { key: "applicationDeadline", label: "Deadline" },
  { key: "tracks", label: "Tracks" },
  { key: "leadTimeWeeks", label: "Lead time" },
];

export default function Home() {
  const router = useRouter();
  const [event, setEvent] = useState<EventApplication>(blankEvent());
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [matching, setMatching] = useState(false);
  const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(false);

  const missing = useMemo(() => unresolvedFields(event), [event]);
  const gaps = useMemo(() => {
    const keys = [...missing];
    if (event.leadTimeWeeks == null) keys.push("leadTimeWeeks");
    return keys;
  }, [missing, event.leadTimeWeeks]);
  const gapSet = useMemo(() => new Set(gaps), [gaps]);

  function patch(partial: Partial<EventApplication>) {
    setEvent((prev) => ({ ...prev, ...partial }));
  }

  async function onProspectus(file: File) {
    setBusy(true);
    setStatus("Reading…");
    let cover: string | null = null;
    if (file.type.startsWith("image/")) {
      cover = await fileToData(file);
    }
    try {
      const parsed = await api.parseProspectus(file);
      setEvent((prev) => applyParseToEvent(prev, parsed, { prospectusCover: cover }));
      setLoaded(true);
      setStatus("");
    } catch {
      setEvent((prev) => ({ ...prev, prospectusCover: cover }));
      setLoaded(true);
      setStatus("Could not parse — fill gaps.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMatching(true);
    localStorage.setItem("tbc-role", "organiser");
    const id = slugify(event.name || "event");
    try {
      const saved = await api.saveEvent({ ...event, id, slug: id, submitted: true, missingFields: unresolvedFields(event) });
      setEventId(saved.id);
      router.push("/sponsors");
    } catch {
      setMatching(false);
      setStatus("Could not save.");
    }
  }

  function switchRole(next: "organiser" | "sponsor") {
    localStorage.setItem("tbc-role", next);
    if (next === "sponsor") router.push("/events");
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <MatchingOverlay show={matching} />
      <header className="sticky top-0 z-20 flex items-center justify-between px-5 py-4">
        <Link href="/" className="inline-flex items-center">
          <LogoMark />
        </Link>
        <div className="flex rounded-full border border-line bg-card p-0.5 text-xs">
          <button className="rounded-full bg-ink px-3 py-1.5 text-paper" onClick={() => switchRole("organiser")}>
            Organiser
          </button>
          <button className="rounded-full px-3 py-1.5 text-muted" onClick={() => switchRole("sponsor")}>
            Sponsor
          </button>
        </div>
      </header>

      <main className={`mx-auto flex max-w-3xl flex-col items-center px-5 ${loaded ? "py-6" : "min-h-[calc(100vh-5.5rem)] justify-center py-10"}`}>
        <CircleDrop accept=".pdf,.txt,.png,.jpg,.jpeg" onFile={onProspectus} busy={busy} compact={loaded} />
        {status ? <p className="mt-4 text-sm text-muted">{status}</p> : null}

        {loaded ? (
          <form onSubmit={submit} className="mt-8 w-full">
            <div className="overflow-hidden rounded-[28px] border border-line bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Event</p>
                  <p className="mt-1 text-lg">{event.name || "Untitled prospectus"}</p>
                </div>
                {gaps.length ? (
                  <Button type="button" tone={adding ? "ghost" : "orange"} onClick={() => setAdding((open) => !open)}>
                    {adding ? "Close editor" : "Add missing info"}
                  </Button>
                ) : null}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                      <th className="px-5 py-3 font-medium">Field</th>
                      <th className="px-5 py-3 font-medium">From the prospectus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row) => {
                      const value = cellText(event, row.key);
                      const isGap = gapSet.has(row.key);
                      return (
                        <tr key={row.key} className="border-b border-line last:border-0">
                          <th className="w-36 px-5 py-3 align-top font-medium">{row.label}</th>
                          <td className="px-5 py-3 align-top">
                            {isGap && adding ? (
                              <GapField field={row.key} event={event} patch={patch} bare />
                            ) : value ? (
                              <span className="whitespace-pre-wrap">{value}</span>
                            ) : (
                              <span className="text-orange">Missing</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end border-t border-line px-5 py-4">
                <Button type="submit">Submit event</Button>
              </div>
            </div>
          </form>
        ) : null}
      </main>
    </div>
  );
}

function cellText(event: EventApplication, field: string) {
  if (field === "contact") return event.contact?.email || "";
  if (field === "expectedAttendance") return event.expectedAttendance == null ? "" : String(event.expectedAttendance);
  if (field === "leadTimeWeeks") return event.leadTimeWeeks == null ? "" : `${event.leadTimeWeeks} weeks`;
  if (field === "supportRequested" || field === "benefitsOffered" || field === "tracks") {
    return (event[field] as string[]).join("\n");
  }
  return String((event as Record<string, unknown>)[field] || "");
}

function GapField({
  field,
  event,
  patch,
  bare,
}: {
  field: string;
  event: EventApplication;
  patch: (partial: Partial<EventApplication>) => void;
  bare?: boolean;
}) {
  if (field === "supportRequested") {
    const on = new Set(event.supportRequested);
    return (
      <div className="flex flex-wrap gap-2">
        {SUPPORT.map((item) => (
          <button
            type="button"
            key={item}
            className={`rounded-full px-3 py-1 text-xs ${on.has(item) ? "bg-navy text-white" : "border border-line"}`}
            onClick={() =>
              patch({
                supportRequested: on.has(item)
                  ? event.supportRequested.filter((s) => s !== item)
                  : [...event.supportRequested, item],
              })
            }
          >
            {item}
          </button>
        ))}
      </div>
    );
  }

  const value =
    field === "contact"
      ? event.contact?.email || ""
      : field === "expectedAttendance"
        ? event.expectedAttendance ?? ""
        : field === "leadTimeWeeks"
          ? event.leadTimeWeeks ?? ""
          : field === "tracks" || field === "benefitsOffered"
            ? (event[field] as string[]).join(", ")
            : String((event as Record<string, unknown>)[field] || "");

  const input = (
    <Input
      aria-label={labelFor(field)}
      type={field === "expectedAttendance" || field === "leadTimeWeeks" ? "number" : field === "contact" ? "email" : "text"}
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        if (field === "contact") {
          patch({ contact: { name: event.contact?.name || "", role: event.contact?.role || "", email: next, demo: true } });
        } else if (field === "expectedAttendance") {
          patch({ expectedAttendance: next === "" ? null : Number(next) });
        } else if (field === "leadTimeWeeks") {
          patch({ leadTimeWeeks: next === "" ? null : Number(next) });
        } else if (field === "tracks" || field === "benefitsOffered") {
          patch({ [field]: next.split(",").map((t) => t.trim()).filter(Boolean) });
        } else {
          patch({ [field]: next } as Partial<EventApplication>);
        }
      }}
    />
  );

  if (bare) return input;

  return (
    <Field label={labelFor(field)} missing>
      {input}
    </Field>
  );
}

function labelFor(field: string) {
  const labels: Record<string, string> = {
    name: "Event",
    community: "Community",
    contact: "Contact",
    purpose: "Purpose",
    date: "Date",
    location: "Location",
    expectedAttendance: "Headcount",
    audience: "Audience",
    supportRequested: "Support",
    benefitsOffered: "Benefits",
    applicationDeadline: "Deadline",
    tracks: "Tracks",
    leadTimeWeeks: "Lead time",
  };
  return labels[field] || field;
}

async function fileToData(file: File) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
