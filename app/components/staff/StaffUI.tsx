"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type StaffTone = "blue" | "cyan" | "emerald" | "violet" | "amber" | "rose" | "slate";

const accent: Record<StaffTone, string> = {
  slate: "#334155",
  blue: "#0b5cf0",
  cyan: "#0891b2",
  emerald: "#129a67",
  violet: "#7047e8",
  amber: "#ef8c18",
  rose: "#e84655",
};

export function StaffShell({ children }: { children: ReactNode }) {
  return <main className="rg-module-page rg-adopted-page">{children}</main>;
}

export function StaffHero({
  name,
  designation,
  description,
  actions,
  prominentGreeting = false,
}: {
  name: string;
  designation?: string;
  description: string;
  actions?: ReactNode;
  prominentGreeting?: boolean;
}) {
  const detail = prominentGreeting && description.includes(".")
    ? description.slice(description.indexOf(".") + 1).trim()
    : description;

  return (
    <header className="rg-module-header staff-adopted-header">
      <div className="rg-module-heading">
        <p className="rg-module-eyebrow">Staff Self-Service</p>
        <h1>{prominentGreeting ? "Staff Overview" : designation || name}</h1>
        {prominentGreeting ? <p className="staff-greeting">Welcome back, {name}</p> : null}
        {prominentGreeting && designation ? <p className="staff-designation">{designation}</p> : null}
        <p className="rg-module-description">{detail}</p>
      </div>
      {actions ? <div className="rg-module-actions">{actions}</div> : null}
    </header>
  );
}

export function StaffStat({ label, value, note, tone = "blue" }: { label: string; value: ReactNode; note?: string; tone?: StaffTone }) {
  return (
    <article className="rg-stat-card" style={{ ["--rg-stat-accent" as string]: accent[tone] }}>
      <div className="rg-stat-accent" />
      <div className="rg-stat-body">
        <p className="rg-stat-label">{label}</p>
        <div className="rg-stat-value">{value}</div>
        {note ? <p className="rg-stat-note">{note}</p> : null}
      </div>
    </article>
  );
}

export function StaffSection({ title, eyebrow, children, action }: { title: string; eyebrow?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rg-section-card">
      <div className="rg-section-card-head">
        <div>
          {eyebrow ? <p className="rg-section-eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      <div className="staff-section-body">{children}</div>
    </section>
  );
}

export function StaffAction({ href, children, tone = "blue" }: { href: string; children: ReactNode; tone?: StaffTone }) {
  return (
    <Link href={href} className="rg-action-button" style={{ ["--rg-action-accent" as string]: accent[tone] }}>
      {children}
    </Link>
  );
}

export function StaffBadge({ children, tone = "slate" }: { children: ReactNode; tone?: StaffTone }) {
  return (
    <span className="rg-status-badge" style={{ ["--rg-status-accent" as string]: accent[tone] }}>
      {children}
    </span>
  );
}

export function StaffEmpty({ title, description }: { title: string; description: string }) {
  return <div className="rg-empty-state"><strong>{title}</strong><p>{description}</p></div>;
}
