"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Monogram } from "@/components/brand";
import { ScoreRing, StarBadge } from "@/components/charts";
import { ProspectusThumb } from "@/components/media";
import { Page, Pill, getSponsorId } from "@/components/shell";
import { Button, Card, Field, Textarea } from "@/components/ui";
import { SAMPLE_COVER } from "@/lib/types";
import { api, suggestedTerms } from "@/lib/api";
import { emptyTerms, type EventApplication, type Match, type SponsorProfile, type Terms } from "@/lib/types";

export default function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<EventApplication | null>(null);
  const [sponsor, setSponsor] = useState<SponsorProfile | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [terms, setTerms] = useState<Terms>(emptyTerms());
  const [note, setNote] = useState("We can offer the support below. Geography and inventory still need a human check.");
  const [error, setError] = useState("");

  useEffect(() => {
    const sponsorId = getSponsorId();
    Promise.all([api.event(id), api.sponsor(sponsorId), api.matches({ eventId: id })]).then(([e, s, matches]) => {
      setEvent(e);
      setSponsor(s);
      setMatch(matches.find((m) => m.sponsorId === sponsorId) || null);
      setTerms(suggestedTerms(e, s));
    });
  }, [id]);

  async function send() {
    if (!event || !sponsor) return;
    try {
      const created = await api.createRequest({
        eventId: event.id,
        sponsorId: sponsor.id,
        initiatedBy: "sponsor",
        terms,
        authorName: sponsor.contact?.name || sponsor.name,
        body: note,
      });
      router.push(`/requests/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send proposal");
    }
  }

  if (!event || !sponsor) {
    return (
      <Page>
        <p className="text-sm text-muted">Loading event…</p>
      </Page>
    );
  }

  return (
    <Page>
      <div className="flex flex-wrap items-center gap-3">
        <Monogram name={event.name} src={event.logoData} size={56} />
        <h1 className="text-2xl">{event.name}</h1>
        <StarBadge value={event.rating} />
        {match ? <ScoreRing value={match.score} /> : null}
        <ProspectusThumb src={event.prospectusCover || SAMPLE_COVER} />
      </div>
      <p className="mt-3 text-sm text-muted">
        {event.date} · {event.location}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {event.supportRequested.map((item) => (
          <Pill key={item} tone="blue">{item}</Pill>
        ))}
        {event.tracks.map((item) => (
          <Pill key={item}>{item}</Pill>
        ))}
      </div>

      <Card className="mt-6 space-y-3">
        <h2 className="text-lg">Propose</h2>
        {(Object.keys(terms) as Array<keyof Terms>).map((key) => (
          <Field key={key} label={key}>
            <Textarea rows={2} value={terms[key]} onChange={(e) => setTerms({ ...terms, [key]: e.target.value })} />
          </Field>
        ))}
        <Field label="Note">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error ? <p className="text-sm text-orange">{error}</p> : null}
        <Button onClick={send}>Send proposal</Button>
      </Card>
    </Page>
  );
}
