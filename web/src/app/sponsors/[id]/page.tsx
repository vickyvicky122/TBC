"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Monogram } from "@/components/brand";
import { RadarChart, ScoreRing, StarBadge } from "@/components/charts";
import { ProspectusThumb } from "@/components/media";
import { Page, Pill, getEventId } from "@/components/shell";
import { Button, Card, Field, Textarea } from "@/components/ui";
import { SAMPLE_COVER } from "@/lib/types";
import { api, suggestedTerms } from "@/lib/api";
import { emptyTerms, type EventApplication, type Match, type SponsorProfile, type Terms } from "@/lib/types";

export default function SponsorDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [sponsor, setSponsor] = useState<SponsorProfile | null>(null);
  const [event, setEvent] = useState<EventApplication | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [terms, setTerms] = useState<Terms>(emptyTerms());
  const [note, setNote] = useState("Sharing the prospectus and a first set of terms.");
  const [error, setError] = useState("");

  useEffect(() => {
    const eventId = getEventId();
    if (!eventId) {
      setError("Submit an event from home first.");
      api.sponsor(id).then(setSponsor).catch(() => undefined);
      return;
    }
    Promise.all([api.sponsor(id), api.event(eventId), api.matches({ eventId })]).then(([s, e, matches]) => {
      setSponsor(s);
      setEvent(e);
      const found = matches.find((m) => m.sponsorId === id) || null;
      setMatch(found);
      setTerms(suggestedTerms(e, s));
    });
  }, [id]);

  async function send() {
    if (!sponsor || !event) return;
    try {
      const created = await api.createRequest({
        eventId: event.id,
        sponsorId: sponsor.id,
        initiatedBy: "organiser",
        terms,
        authorName: event.contact?.name || event.name || "organiser",
        body: note,
      });
      router.push(`/requests/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send request");
    }
  }

  if (!sponsor) {
    return (
      <Page>
        <p className="text-sm text-muted">{error || "Loading profile…"}</p>
      </Page>
    );
  }
  if (!event) {
    return (
      <Page>
        <div className="flex flex-wrap items-center gap-3">
          <Monogram name={sponsor.name} src={sponsor.logoData} size={56} />
          <h1 className="text-2xl">{sponsor.name}</h1>
        </div>
        <p className="mt-3 text-sm text-muted">{error || "Submit an event from home first."}</p>
      </Page>
    );
  }

  return (
    <Page>
      <div className="flex flex-wrap items-center gap-3">
        <Monogram name={sponsor.name} src={sponsor.logoData} size={56} />
        <h1 className="text-2xl">{sponsor.name}</h1>
        <Pill>{sponsor.kind}</Pill>
        {match ? <Pill tone={match.source === "hybrid" ? "blue" : "default"}>{match.source}</Pill> : null}
        <StarBadge value={sponsor.rating} />
        {match ? <ScoreRing value={match.score} /> : null}
        <ProspectusThumb src={event.prospectusCover || SAMPLE_COVER} />
      </div>
      <p className="mt-3 text-sm text-muted">{sponsor.tagline || sponsor.goals.split(".")[0]}.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex flex-wrap gap-2">
            {sponsor.supportAvailable.map((item) => (
              <Pill key={item} tone="blue">{item}</Pill>
            ))}
            {sponsor.tracksLookingFor.map((item) => (
              <Pill key={item}>{item}</Pill>
            ))}
          </div>
        </Card>
        <Card className="flex justify-center">
          {match?.components ? (
            <div className="w-full max-w-[18rem]">
              <RadarChart scores={match.components} />
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="mt-6 space-y-3">
        <h2 className="text-lg">Request</h2>
        {(Object.keys(terms) as Array<keyof Terms>).map((key) => (
          <Field key={key} label={key}>
            <Textarea rows={2} value={terms[key]} onChange={(e) => setTerms({ ...terms, [key]: e.target.value })} />
          </Field>
        ))}
        <Field label="Short note">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error ? <p className="text-sm text-orange">{error}</p> : null}
        <Button onClick={send}>Send request</Button>
      </Card>
    </Page>
  );
}
