"use client";
import type { ReactNode } from "react";

export function PVHero({ actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  if (!actions) return null;
  return <div className="rg-rmb-actions-row">{actions}</div>;
}
export function PVActionButton({ children, onClick, disabled, tone = "blue", type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; tone?: "blue" | "cyan" | "violet" | "emerald" | "slate" | "danger"; type?: "button" | "submit" }) {
  const map = { blue:"#0b5cf0", cyan:"#0891b2", violet:"#7047e8", emerald:"#129a67", slate:"#334155", danger:"#e84655" } as const;
  return <button type={type} onClick={onClick} disabled={disabled} className="rg-action-button" style={{ ['--rg-action-accent' as string]: map[tone] }}>{children}</button>;
}
export function PVSectionHeader({ title, description, badge }: { title: string; description?: string; badge?: ReactNode }) {
  return <div className="rg-section-card-head rg-pv-section-head"><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>{badge}</div>;
}
