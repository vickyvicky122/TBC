"use client";

import { use, useEffect, useState } from "react";
import { Monogram } from "@/components/brand";
import { ProspectusThumb } from "@/components/media";
import { Page } from "@/components/shell";
import { Button, Card, Field, Status, Textarea } from "@/components/ui";
import { SAMPLE_COVER } from "@/lib/types";
import { api } from "@/lib/api";
import type { EventApplication, PartnershipRequest, SponsorProfile, Terms } from "@/lib/types";

export default function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [req, setReq] = useState<PartnershipRequest | null>(null);
  const [event, setEvent] = useState<EventApplication | null>(null);
  const [sponsor, setSponsor] = useState<SponsorProfile | null>(null);
  const [draft, setDraft] = useState("");
  const [acting, setActing] = useState<"organiser" | "sponsor">("sponsor");

  async function reload() {
    const current = await api.request(id);
    setReq(current);
    const [e, s] = await Promise.all([api.event(current.eventId), api.sponsor(current.sponsorId)]);
    setEvent(e);
    setSponsor(s);
  }

  useEffect(() => {
    reload();
  }, [id]);

  async function propose() {
    if (!req || !sponsor || !event) return;
    const name = acting === "sponsor" ? sponsor.contact?.name || sponsor.name : event.contact?.name || "Organiser";
    await api.patchRequest(id, {
      status: "counter",
      terms: req.terms,
      authorRole: acting,
      authorName: name,
      message: draft || "Revised conditions attached.",
    });
    setDraft("");
    await reload();
  }

  async function setStatus(status: "confirmed" | "declined") {
    if (!req || !event || !sponsor) return;
    const name = acting === "sponsor" ? sponsor.contact?.name || sponsor.name : event.contact?.name || "Organiser";
    await api.patchRequest(id, {
      status,
      authorRole: acting,
      authorName: name,
      message: status === "confirmed" ? "Accepted. Terms are now the live agreement." : "Declined.",
    });
    await reload();
  }

  function patchTerm(key: keyof Terms, value: string) {
    if (!req) return;
    setReq({ ...req, terms: { ...req.terms, [key]: value } });
  }

  if (!req || !event || !sponsor) {
    return (
      <Page>
        <p className="text-sm text-muted">Loading request…</p>
      </Page>
    );
  }

  return (
    <Page>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{req.id}</p>
          <div className="mt-2 flex items-center gap-2">
            <Monogram name={event.name} src={event.logoData} />
            <h1 className="text-2xl">{event.name}</h1>
            <span className="text-muted">×</span>
            <Monogram name={sponsor.name} src={sponsor.logoData} />
            <span className="text-xl">{sponsor.name}</span>
          </div>
        </div>
        <ProspectusThumb src={event.prospectusCover || SAMPLE_COVER} />
        <Status value={req.status} />
      </div>
      <p className="mt-3 text-sm text-muted">{event.oneLine || event.purpose}</p>

      <div className="mt-4 flex gap-2">
        <button
          className={`rounded-full px-3 py-1 text-xs ${acting === "organiser" ? "bg-ink text-paper" : "border border-line"}`}
          onClick={() => setActing("organiser")}
        >
          Act as organiser
        </button>
        <button
          className={`rounded-full px-3 py-1 text-xs ${acting === "sponsor" ? "bg-ink text-paper" : "border border-line"}`}
          onClick={() => setActing("sponsor")}
        >
          Act as sponsor
        </button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-lg">Editable proposal</h2>
          {(Object.keys(req.terms) as Array<keyof Terms>).map((key) => (
            <Field key={key} label={key}>
              <Textarea rows={2} value={req.terms[key]} onChange={(e) => patchTerm(key, e.target.value)} />
            </Field>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button onClick={propose}>Propose changes</Button>
            <Button tone="ghost" onClick={() => setStatus("confirmed")}>
              Confirm
            </Button>
            <Button tone="orange" onClick={() => setStatus("declined")}>
              Decline
            </Button>
          </div>
        </Card>
        <Card>
          <h2 className="text-lg">Conversation</h2>
          <div className="mt-4 space-y-3">
            {req.messages.map((msg) => (
              <div key={msg.id} className="rounded-2xl bg-paper-2 p-3">
                <p className="text-xs text-muted">
                  {msg.authorName} · {msg.authorRole} · {msg.createdAt}
                </p>
                <p className="mt-1 text-sm leading-6">{msg.body}</p>
              </div>
            ))}
          </div>
          <Field label="Message">
            <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} />
          </Field>
          <div className="mt-3">
            <Button tone="ghost" onClick={propose}>
              Attach message to a counter
            </Button>
          </div>
        </Card>
      </div>
    </Page>
  );
}
