"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Monogram } from "@/components/brand";
import { ProspectusThumb } from "@/components/media";
import { Page } from "@/components/shell";
import { Card, Status } from "@/components/ui";
import { api } from "@/lib/api";
import { SAMPLE_COVER, type EventApplication, type PartnershipRequest, type SponsorProfile } from "@/lib/types";

export default function InboxPage() {
  const [requests, setRequests] = useState<PartnershipRequest[]>([]);
  const [events, setEvents] = useState<EventApplication[]>([]);
  const [sponsors, setSponsors] = useState<SponsorProfile[]>([]);
  useEffect(() => {
    api.requests().then(setRequests).catch(() => undefined);
    api.events().then(setEvents).catch(() => undefined);
    api.sponsors().then(setSponsors).catch(() => undefined);
  }, []);

  const eventById = Object.fromEntries(events.map((e) => [e.id, e]));
  const sponsorById = Object.fromEntries(sponsors.map((s) => [s.id, s]));

  return (
    <Page>
      <h1 className="text-2xl">Requests</h1>
      <div className="mt-8 grid gap-3">
        {requests.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">No asks yet.</p>
          </Card>
        ) : (
          requests.map((req) => {
            const event = eventById[req.eventId];
            const sponsor = sponsorById[req.sponsorId];
            if (!event || !sponsor) return null;
            return (
              <Link key={req.id} href={`/requests/${req.id}`}>
                <Card className="flex items-center gap-4">
                  <Monogram name={event.name} src={event.logoData} />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg">{event.name}</p>
                    <p className="truncate text-sm text-muted">{event.oneLine || event.purpose}</p>
                  </div>
                  <ProspectusThumb src={event.prospectusCover || SAMPLE_COVER} className="h-20 w-14" />
                  <Status value={req.status} />
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </Page>
  );
}
