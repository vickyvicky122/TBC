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
  ["#4e9cff", "#161616", "#ff5d5f"],
  ["#161616", "#efebe3", "#4e9cff"],
  ["#ff5d5f", "#fffcf7", "#4e9cff"],
  ["#12407f", "#d8e9ff", "#efebe3"],
  ["#0a1e3d", "#efebe3", "#ff5d5f"],
  ["#4e9cff", "#161616", "#ff5d5f"],
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
        className="rounded-full object-contain"
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

const LOGO_SRC = "/brand/logo.png";
const LOGO_RATIO = 256 / 161;

export function LogoMark({ size = 36, withName = true }: { size?: number; withName?: boolean }) {
  const height = size;
  const width = Math.round(size * LOGO_RATIO);
  return (
    <span className="inline-flex items-center gap-2.5">
      <img
        src={LOGO_SRC}
        alt=""
        width={width}
        height={height}
        className="block shrink-0"
        style={{ width, height }}
      />
      {withName ? <span className="display text-[1.35rem] leading-none text-ink">TBC.</span> : null}
    </span>
  );
}

