"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Monogram } from "@/components/brand";
import { Dropzone, ProspectusThumb } from "@/components/media";
import { Page, Pill, setEventId } from "@/components/shell";
import { Button, Card, Field, Input } from "@/components/ui";
import { api, applyParseToEvent, blankEvent, slugify } from "@/lib/api";
import { SAMPLE_COVER, SUPPORT, type EventApplication, type SponsorProfile } from "@/lib/types";

function ProfileForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [event, setEvent] = useState<EventApplication>(blankEvent());
  const [sponsors, setSponsors] = useState<SponsorProfile[]>([]);
  const [picked, setPicked] = useState<string | null>(params.get("sponsor"));
  const [status, setStatus] = useState("");

  useEffect(() => {
    api.sponsors().then((list) => {
      setSponsors(list);
      const from = params.get("sponsor");
      if (from && list.some((s) => s.id === from)) setPicked(from);
    });
  }, [params]);

  function patch(partial: Partial<EventApplication>) {
    setEvent((prev) => ({ ...prev, ...partial }));
  }

  async function onLogo(file: File) {
    const data = await fileToData(file);
    patch({ logoData: data });
  }

  async function onProspectus(file: File) {
    setStatus("Reading prospectus…");
    const cover = file.type.startsWith("image/") ? await fileToData(file) : SAMPLE_COVER;
    patch({ prospectusCover: cover });
    try {
      const parsed = await api.parseProspectus(file);
      setEvent((prev) => applyParseToEvent(prev, parsed, { prospectusCover: cover }));
      setSponsors(await api.sponsors());
      setStatus("Prospectus attached.");
    } catch {
      setStatus("File attached.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = slugify(event.name || "event");
    const saved = await api.saveEvent({
      ...event,
      id,
      slug: id,
      submitted: false,
    });
    setEventId(saved.id);
    setStatus("Saved.");
    router.push("/");
  }

  const supportSet = new Set(event.supportRequested);
  const previewSponsors = picked ? sponsors.filter((s) => s.id === picked).concat(sponsors.filter((s) => s.id !== picked)) : sponsors;

  return (
    <Page>
      <h1 className="text-2xl">Profile</h1>
      {status ? <p className="mt-2 text-sm text-muted">{status}</p> : null}

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Dropzone label="Drop logo" accept="image/*" onFile={onLogo} />
          <Dropzone label="Drop prospectus" accept=".pdf,.txt,.png,.jpg,.jpeg" onFile={onProspectus} />
        </div>

        {(event.logoData || event.prospectusCover || picked) && (
          <Card>
            <p className="text-xs uppercase tracking-wide text-muted">After drop</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Monogram name={event.name || "New org"} src={event.logoData} size={48} />
              {event.prospectusCover ? <ProspectusThumb src={event.prospectusCover} /> : null}
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {previewSponsors.map((s) => (
                <span key={s.id} className="flex items-center gap-2 rounded-full border border-line bg-paper-2 px-2 py-1">
                  <Monogram name={s.name} src={s.logoData} size={22} />
                  <span className="text-xs">{s.name}</span>
                  {picked === s.id ? <Pill tone="blue">saved</Pill> : null}
                </span>
              ))}
            </div>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted">Identity</p>
            <Field label="Event">
              <Input value={event.name} onChange={(e) => patch({ name: e.target.value })} />
            </Field>
            <Field label="Community">
              <Input value={event.community} onChange={(e) => patch({ community: e.target.value })} />
            </Field>
            <Field label="Contact">
              <Input
                value={event.contact?.email || ""}
                onChange={(e) =>
                  patch({ contact: { name: event.contact?.name || "", role: event.contact?.role || "", email: e.target.value, demo: true } })
                }
              />
            </Field>
          </Card>
          <Card className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted">When / where</p>
            <Field label="Date">
              <Input value={event.date} onChange={(e) => patch({ date: e.target.value })} />
            </Field>
            <Field label="Location">
              <Input value={event.location} onChange={(e) => patch({ location: e.target.value })} />
            </Field>
            <Field label="Headcount">
              <Input
                type="number"
                value={event.expectedAttendance ?? ""}
                onChange={(e) => patch({ expectedAttendance: Number(e.target.value) })}
              />
            </Field>
          </Card>
        </div>

        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">Ask</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUPPORT.map((item) => {
              const on = supportSet.has(item);
              return (
                <button
                  type="button"
                  key={item}
                  className={`rounded-full px-3 py-1 text-xs ${on ? "bg-navy text-white" : "border border-line"}`}
                  onClick={() =>
                    patch({
                      supportRequested: on
                        ? event.supportRequested.filter((s) => s !== item)
                        : [...event.supportRequested, item],
                    })
                  }
                >
                  {item}
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Save to database</Button>
        </div>
      </form>
    </Page>
  );
}

async function fileToData(file: File) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileForm />
    </Suspense>
  );
}
