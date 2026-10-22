"use client";

import type { ComponentScores } from "@/lib/types";

const AXES: Array<{ key: keyof ComponentScores; label: string }> = [
  { key: "audience", label: "Audience" },
  { key: "tracks", label: "Tracks" },
  { key: "support", label: "Support" },
  { key: "location", label: "Place" },
  { key: "leadTime", label: "Lead" },
  { key: "history", label: "History" },
];

function polar(index: number, value: number, r: number, cx: number, cy: number) {
  const angle = (Math.PI * 2 * index) / AXES.length - Math.PI / 2;
  const vr = (Math.max(0, Math.min(100, value)) / 100) * r;
  return [cx + Math.cos(angle) * vr, cy + Math.sin(angle) * vr];
}

export function RadarChart({ scores }: { scores: ComponentScores }) {
  const cx = 90;
  const cy = 90;
  const r = 62;
  const pts = AXES.map((axis, i) => polar(i, scores[axis.key], r, cx, cy).join(",")).join(" ");
  return (
    <svg viewBox="0 0 180 180" className="mx-auto block h-auto w-full max-w-[18rem] min-w-0">
      {[0.35, 0.65, 1].map((scale) => (
        <polygon
          key={scale}
          fill="none"
          stroke="#ddd6c8"
          points={AXES.map((_, i) => polar(i, 100 * scale, r, cx, cy).join(",")).join(" ")}
        />
      ))}
      <polygon points={pts} fill="rgba(78,156,255,0.18)" stroke="#4e9cff" strokeWidth="1.6" />
      {AXES.map((axis, i) => {
        const [x, y] = polar(i, 118, r, cx, cy);
        return (
          <text key={axis.key} x={x} y={y} textAnchor="middle" fontSize="8" fill="#6a655c">
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}

export function ScoreRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = 30;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <span className="inline-flex flex-col items-center gap-1" title="Matching score">
      <svg width="80" height="80" viewBox="0 0 80 80" aria-label={`${pct}% match`}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="#ddd6c8" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="#4e9cff"
          strokeWidth="6"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="40" dominantBaseline="central" textAnchor="middle" fontSize="18" fontWeight="600" fill="#161616">
          {pct}
        </text>
      </svg>
      <span className="text-xs uppercase tracking-wide text-muted">Match</span>
    </span>
  );
}

export function StarBadge({ value }: { value: number }) {
  const filled = Math.round(value);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-xs text-paper"
      title="Organiser rating"
    >
      <span aria-hidden>★</span>
      <span className="tabular-nums">{value.toFixed(1)}</span>
      <span className="text-[10px] uppercase tracking-wide text-paper/70">{filled}/5</span>
    </span>
  );
}
