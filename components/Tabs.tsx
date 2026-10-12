"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Tabs({ teamId, isCoach }: { teamId: string; isCoach: boolean }) {
  const path = usePathname();
  const base = `/t/${teamId}`;
  const tabs = [
    { href: base, label: "Termine" },
    { href: `${base}/statistik`, label: "Statistik" },
    ...(isCoach ? [{ href: `${base}/verwaltung`, label: "Verwaltung" }] : []),
  ];
  return (
    <nav className="tabs">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
