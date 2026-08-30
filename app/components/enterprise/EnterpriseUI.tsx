"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type Tone = "slate" | "blue" | "cyan" | "emerald" | "violet" | "amber" | "rose";

const accent: Record<Tone, string> = {
  slate: "#334155", blue: "#0b5cf0", cyan: "#0891b2", emerald: "#129a67",
  violet: "#7047e8", amber: "#ef8c18", rose: "#e84655",
};

export function EnterpriseShell({ children }: { children: ReactNode }) {
  return <div className="rg-module-page rg-adopted-page">{children}</div>;
}

export function EnterpriseHero({ actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  if (!actions) return null;
  return <div className="rg-rmb-actions-row">{actions}</div>;
}

export function ActionButton({ children, tone = "blue", onClick, disabled = false, type = "button" }: { children: ReactNode; tone?: Tone; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return <button type={type} onClick={onClick} disabled={disabled} className="rg-action-button" style={{ ['--rg-action-accent' as string]: accent[tone] }}>{children}</button>;
}

export function ActionLink({ href, children, tone = "blue" }: { href: string; children: ReactNode; tone?: Tone }) {
  return <Link href={href} className="rg-action-button" style={{ ['--rg-action-accent' as string]: accent[tone] }}>{children}</Link>;
}

export function StatCard({ label, value, note, tone = "blue" }: { label: string; value: ReactNode; note?: string; tone?: Tone }) {
  return <article className="rg-stat-card" style={{ ['--rg-stat-accent' as string]: accent[tone] }}><div className="rg-stat-accent"/><div className="rg-stat-body"><p className="rg-stat-label">{label}</p><div className="rg-stat-value">{value}</div>{note ? <p className="rg-stat-note">{note}</p> : null}</div></article>;
}

export function SectionCard({ title, eyebrow, children, action }: { title: string; eyebrow?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="rg-section-card"><div className="rg-section-card-head"><div>{eyebrow ? <p className="rg-section-eyebrow">{eyebrow}</p> : null}<h2>{title}</h2></div>{action}</div>{children}</section>;
}

export function StatusBadge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return <span className="rg-status-badge" style={{ ['--rg-status-accent' as string]: accent[tone] }}>{children}</span>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rg-empty-state"><strong>{title}</strong><p>{description}</p></div>;
}

export function LoadingGrid() {
  return <div className="rg-loading-grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} />)}</div>;
}
