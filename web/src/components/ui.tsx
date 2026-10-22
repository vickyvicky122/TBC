"use client";

import { Pill } from "./shell";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[28px] border border-line bg-card p-6 shadow-[0_1px_0_rgba(22,22,22,0.04)] ${className}`}>{children}</div>;
}

export function Button({
  children,
  href,
  onClick,
  tone = "dark",
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  tone?: "dark" | "ghost" | "orange";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const cls =
    tone === "ghost"
      ? "border border-line bg-card text-ink hover:bg-paper-2"
      : tone === "orange"
        ? "bg-orange text-white hover:brightness-110"
        : "bg-ink text-paper hover:bg-black";
  const shared = `inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm disabled:opacity-50 ${cls}`;
  if (href) {
    return (
      <a className={shared} href={href}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} className={shared} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  missing,
  children,
}: {
  label: string;
  hint?: string;
  missing?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-2 text-sm">
        {label}
        {missing ? <Pill tone="orange">missing</Pill> : null}
      </span>
      {children}
      {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-line bg-paper-2 px-3 py-2.5 text-sm outline-none focus:border-ink ${props.className || ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-2xl border border-line bg-paper-2 px-3 py-2.5 text-sm outline-none focus:border-ink ${props.className || ""}`}
    />
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-xs text-paper">
      ★ {value.toFixed(1)}
    </span>
  );
}

export function Status({ value }: { value: string }) {
  const tone = value === "confirmed" ? "dark" : value === "declined" ? "orange" : "default";
  return <Pill tone={tone}>{value}</Pill>;
}
