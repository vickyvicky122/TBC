"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "./brand";

export type Role = "organiser" | "sponsor";

const EVENT_KEY = "tbc-event-id";
const SPONSOR_KEY = "tbc-sponsor-id";
const ROLE_KEY = "tbc-role";

export function getEventId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(EVENT_KEY) || "";
}

export function setEventId(id: string) {
  localStorage.setItem(EVENT_KEY, id);
}

export function getSponsorId() {
  if (typeof window === "undefined") return "cognee";
  return localStorage.getItem(SPONSOR_KEY) || "cognee";
}

export function setSponsorId(id: string) {
  localStorage.setItem(SPONSOR_KEY, id);
}

export { LogoMark };

export function Header({ roleDefault = "organiser" }: { roleDefault?: Role }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<Role>(roleDefault);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(ROLE_KEY) as Role | null;
    if (stored) setRole(stored);
    setMounted(true);
  }, []);

  function switchRole(next: Role) {
    setRole(next);
    localStorage.setItem(ROLE_KEY, next);
    router.push(next === "organiser" ? "/" : "/events");
  }

  const organiserNav = [
    { href: "/sponsors", label: "Partners" },
    { href: "/inbox", label: "Requests" },
  ];
  const sponsorNav = [
    { href: "/events", label: "Events" },
    { href: "/inbox", label: "Requests" },
  ];
  const nav = role === "organiser" ? organiserNav : sponsorNav;

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center">
          <LogoMark />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname.startsWith(item.href) ? "text-ink" : "hover:text-ink"}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex rounded-full border border-line bg-card p-0.5 text-xs">
          <button
            suppressHydrationWarning
            className={`rounded-full px-3 py-1.5 ${mounted && role === "organiser" ? "bg-ink text-paper" : "text-muted"}`}
            onClick={() => switchRole("organiser")}
          >
            Organiser
          </button>
          <button
            suppressHydrationWarning
            className={`rounded-full px-3 py-1.5 ${mounted && role === "sponsor" ? "bg-ink text-paper" : "text-muted"}`}
            onClick={() => switchRole("sponsor")}
          >
            Sponsor
          </button>
        </div>
      </div>
    </header>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
    </div>
  );
}

export function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "orange" | "dark" | "blue" }) {
  const cls =
    tone === "orange"
      ? "bg-orange text-white"
      : tone === "dark"
        ? "bg-ink text-paper"
        : tone === "blue"
          ? "bg-navy text-white"
          : "border border-line bg-card text-ink";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] ${cls}`}>{children}</span>;
}
