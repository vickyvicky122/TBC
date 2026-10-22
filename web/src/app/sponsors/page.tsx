"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Monogram } from "@/components/brand";
import { RadarChart, ScoreRing, StarBadge } from "@/components/charts";
import { ProspectusThumb } from "@/components/media";
import { Page, getEventId } from "@/components/shell";
import { Card } from "@/components/ui";
import { api } from "@/lib/api";
import { SAMPLE_COVER, type EventApplication, type Match, type SponsorProfile } from "@/lib/types";

const FALLBACK: { audience: number; tracks: number; support: number; location: number; leadTime: number; history: number } = {
  audience: 70,
  tracks: 64,
  support: 72,
  location: 80,
  leadTime: 60,
  history: 55,
};

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState<SponsorProfile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [event, setEvent] = useState<EventApplication | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const eventId = getEventId();
    if (!eventId) {
      setError("Drop a prospectus on home, then submit.");
      return;
    }
    Promise.all([api.sponsors(), api.matches({ eventId }), api.event(eventId).catch(() => null)])
      .then(([s, m, e]) => {
        setSponsors(s);
        setMatches(m);
        setEvent(e);
      })
      .catch(() => setError("Matching API offline."));
  }, []);

  const byId = Object.fromEntries(sponsors.map((s) => [s.id, s]));
  const cover = event?.prospectusCover || SAMPLE_COVER;

  return (
    <Page>
      <h1 className="text-2xl">Suggested sponsors</h1>
      {error ? <p className="mt-3 text-sm text-muted">{error}</p> : null}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {matches.map((match) => {
          const sponsor = byId[match.sponsorId];
          if (!sponsor) return null;
          return (
            <Link key={sponsor.id} href={`/sponsors/${sponsor.id}`}>
              <Card className="h-full transition hover:border-navy/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Monogram name={sponsor.name} src={sponsor.logoData} />
                    <div>
                      <h2 className="text-lg">{sponsor.name}</h2>
                      <p className="text-sm text-muted">{sponsor.tagline || match.explanation.whyRelevant}</p>
                    </div>
                  </div>
                  <ProspectusThumb src={cover} className="h-20 w-14" />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <RadarChart scores={match.components || FALLBACK} />
                  <div className="flex flex-col items-end gap-3">
                    <StarBadge value={sponsor.rating} />
                    <ScoreRing value={match.score} />
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </Page>
  );
}
