"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Monogram } from "@/components/brand";
import { ScoreRing } from "@/components/charts";
import { Page, getSponsorId, setSponsorId } from "@/components/shell";
import { Card } from "@/components/ui";
import { api } from "@/lib/api";
import type { EventApplication, Match, SponsorProfile } from "@/lib/types";

export default function EventsPage() {
  const [events, setEvents] = useState<EventApplication[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [sponsors, setSponsors] = useState<SponsorProfile[]>([]);
  const [sponsorId, setSid] = useState("cognee");

  useEffect(() => {
    const sid = getSponsorId();
    setSid(sid);
    api.events().then(setEvents).catch(() => undefined);
    api.sponsors().then(setSponsors).catch(() => undefined);
    api.matches({ sponsorId: sid }).then(setMatches).catch(() => undefined);
  }, []);

  function changeSponsor(id: string) {
    setSid(id);
    setSponsorId(id);
    api.matches({ sponsorId: id }).then(setMatches);
  }

  const byEvent = Object.fromEntries(matches.map((m) => [m.eventId, m]));
  const ranked = [...events].sort((a, b) => (byEvent[b.id]?.score || 0) - (byEvent[a.id]?.score || 0));

  return (
    <Page>
      <h1 className="text-2xl">Events to sponsor</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {sponsors.map((s) => (
          <button
            key={s.id}
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs ${s.id === sponsorId ? "bg-navy text-white" : "border border-line"}`}
            onClick={() => changeSponsor(s.id)}
          >
            <Monogram name={s.name} src={s.logoData} size={18} />
            {s.name}
          </button>
        ))}
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {ranked.map((event) => {
          const match = byEvent[event.id];
          return (
            <Link key={event.id} href={`/events/${event.id}`}>
              <Card className="flex items-center gap-4 transition hover:border-navy/40">
                <Monogram name={event.name} src={event.logoData} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg">{event.name}</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {event.date} · {event.location}
                  </p>
                </div>
                {match ? <ScoreRing value={match.score} /> : <span className="text-xs text-muted">—</span>}
              </Card>
            </Link>
          );
        })}
      </div>
    </Page>
  );
}
