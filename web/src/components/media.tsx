"use client";

import { useEffect, useState } from "react";
import { SAMPLE_COVER } from "@/lib/types";

export function Lightbox({
  src,
  alt,
  open,
  onClose,
}: {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <button
      type="button"
      className="fixed inset-0 z-50 grid place-items-center p-6"
      style={{ background: "rgba(5,8,130,0.88)" }}
      onClick={onClose}
      aria-label="Close prospectus preview"
    >
      <img src={src} alt={alt} className="max-h-[90vh] max-w-[min(720px,92vw)] rounded-lg shadow-2xl" />
    </button>
  );
}

export function ProspectusThumb({
  src,
  label = "Prospectus",
  className = "h-24 w-16",
}: {
  src?: string | null;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const cover = src || SAMPLE_COVER;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="shrink-0 text-left" title="Open prospectus">
        <img src={cover} alt={label} className={`${className} rounded-md object-cover ring-1 ring-line`} />
      </button>
      <Lightbox src={cover} alt={label} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function CircleDrop({
  accept,
  onFile,
  busy,
  compact,
}: {
  accept: string;
  onFile: (file: File) => void;
  busy?: boolean;
  compact?: boolean;
}) {
  const [over, setOver] = useState(false);
  return (
    <label
      aria-label={busy ? "Reading prospectus" : "Drop prospectus"}
      className={`relative grid cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-dashed transition ${
        compact ? "h-36 w-36" : "h-[min(72vmin,32rem)] w-[min(72vmin,32rem)]"
      } ${over ? "border-orange scale-[1.02] shadow-[0_0_0_12px_rgba(255,93,95,0.28)]" : "border-ink/35"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      <img
        src="/brand/circle.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_68%]"
      />
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(239,235,227,0.88)_0%,rgba(239,235,227,0.28)_46%,rgba(239,235,227,0.05)_70%)]" />
      {busy ? (
        <span className="relative z-10 text-sm text-ink">Reading</span>
      ) : (
        <span
          className={`display relative z-10 max-w-[11ch] text-center leading-[0.95] text-ink ${
            compact ? "text-sm" : "text-4xl sm:text-5xl"
          }`}
        >
          Upload prospectus
        </span>
      )}
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

export function Dropzone({
  label,
  accept,
  onFile,
}: {
  label: string;
  accept: string;
  onFile: (file: File) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed px-4 py-8 text-center text-sm ${
        over ? "border-navy bg-periwinkle/30" : "border-line bg-paper-2"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      <span className="text-muted">{label}</span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

export function MatchingOverlay({ show }: { show: boolean }) {
  const lines = ["Matching…", "Scoring overlap.", "Shortlist ready."];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!show) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % lines.length), 1600);
    return () => window.clearInterval(id);
  }, [show, lines.length]);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-paper">
      <div className="flex flex-col items-center gap-8">
        <div className="spin-orbit relative h-28 w-28">
          <span className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 rounded-full bg-orange" />
        </div>
        <p className="match-line max-w-sm text-center text-lg" key={index}>
          {lines[index]}
        </p>
      </div>
    </div>
  );
}
