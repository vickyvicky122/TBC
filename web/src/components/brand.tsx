"use client";

function hashName(name: string) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i += 1) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PALETTES = [
  ["#050882", "#efebe3", "#e24b24"],
  ["#161616", "#efebe3", "#9aa6ff"],
  ["#e24b24", "#fffcf7", "#050882"],
  ["#1c1460", "#c5c8f2", "#efebe3"],
  ["#0b0b2a", "#efebe3", "#e24b24"],
  ["#050882", "#e24b24", "#fffcf7"],
];

export function initials(name: string) {
  const parts = name.replace(/\(.*\)/, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Original geometric monogram — never a real brand mark. */
export function Monogram({
  name,
  src,
  size = 44,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const h = hashName(name || "TBC");
  const [bg, fg, accent] = PALETTES[h % PALETTES.length];
  const variant = h % 4;
  const letters = initials(name || "TB");
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <circle cx="24" cy="24" r="23" fill={bg} />
      {variant === 0 ? <path d="M8 30 L24 10 L40 30 Z" fill={accent} opacity="0.85" /> : null}
      {variant === 1 ? (
        <>
          <rect x="10" y="10" width="12" height="12" rx="2" fill={fg} />
          <rect x="26" y="26" width="12" height="12" rx="2" fill={accent} />
        </>
      ) : null}
      {variant === 2 ? <circle cx="24" cy="24" r="10" fill="none" stroke={accent} strokeWidth="3" /> : null}
      {variant === 3 ? (
        <path d="M12 24 h24 M24 12 v24" stroke={fg} strokeWidth="2.4" opacity="0.5" />
      ) : null}
      <text
        x="24"
        y="28"
        textAnchor="middle"
        fill={variant === 0 ? fg : fg}
        fontSize="13"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui"
      >
        {letters}
      </text>
    </svg>
  );
}

export function LogoMark({ size = 36, withDots = true }: { size?: number; withDots?: boolean }) {
  const text = Math.max(9, size * 0.28);
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="grid place-items-center rounded-full bg-ink text-paper"
        style={{ width: size, height: size }}
      >
        <span className="font-semibold tracking-tight" style={{ fontSize: text }}>
          TBC
        </span>
      </span>
      {withDots ? (
        <span className="flex items-center gap-1" aria-hidden>
          <i className="pulse-dot bg-ink" />
          <i className="pulse-dot bg-ink" />
          <i className="pulse-dot bg-orange" />
        </span>
      ) : null}
    </span>
  );
}

