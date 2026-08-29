"use client";

import type { ReactNode } from "react";

export type AdminTone = "blue" | "cyan" | "emerald" | "violet" | "amber" | "rose" | "slate" | "fuchsia";

const accent: Record<AdminTone, string> = {
  slate: "#334155",
  blue: "#0b5cf0",
  cyan: "#0891b2",
  emerald: "#129a67",
  violet: "#7047e8",
  amber: "#ef8c18",
  rose: "#e84655",
  fuchsia: "#a21caf",
};

export function AdminHero({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="rg-module-header admin-adopted-header">
      <div className="rg-module-heading">
        <p className="rg-module-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="rg-module-description">{description}</p>
      </div>
      {actions ? <div className="rg-module-actions">{actions}</div> : null}
    </header>
  );
}

export function AdminKpiCard({ label, value, note, tone = "blue", icon }: { label: string; value: ReactNode; note?: string; tone?: AdminTone; icon?: ReactNode }) {
  return (
    <article className="rg-stat-card" style={{ ["--rg-stat-accent" as string]: accent[tone] }}>
      <div className="rg-stat-accent" />
      <div className="rg-stat-body">
        <div className="rg-stat-top"><p className="rg-stat-label">{label}</p>{icon ? <span className="rg-stat-icon">{icon}</span> : null}</div>
        <div className="rg-stat-value">{value}</div>
        {note ? <p className="rg-stat-note">{note}</p> : null}
      </div>
    </article>
  );
}

export function AdminSection({ eyebrow, title, description, children, action }: { eyebrow?: string; title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rg-section-card">
      <div className="rg-section-card-head">
        <div>
          {eyebrow ? <p className="rg-section-eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="admin-section-body">{children}</div>
    </section>
  );
}

export function AdminPrimaryButton({ children, onClick, tone = "blue", disabled, type = "button" }: { children: ReactNode; onClick?: () => void; tone?: AdminTone; disabled?: boolean; type?: "button" | "submit" }) {
  return <button type={type} onClick={onClick} disabled={disabled} className="rg-action-button" style={{ ["--rg-action-accent" as string]: accent[tone] }}>{children}</button>;
}
