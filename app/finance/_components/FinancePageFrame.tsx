"use client";

import { type ReactNode } from "react";

export type FinanceTone = "blue" | "cyan" | "emerald" | "amber" | "violet" | "rose";

export function FinancePageFrame({ eyebrow, title, description, icon, badge, actions, children }: { eyebrow: string; title: string; description: string; icon: string; tone?: FinanceTone; badge?: string; actions?: ReactNode; children: ReactNode; }) {
  return (
    <main className="finance-mock-page">
      <header className="finance-mock-header">
        <div className="finance-title-block">
          <div className="finance-breadcrumb"><span>Finance</span><b>›</b><strong>{title}</strong></div>
          <div className="finance-title-line"><span className="finance-title-icon" aria-hidden="true">{icon}</span><div><h1>{title}</h1><p>{description}</p></div></div>
          {badge ? <span className="finance-mock-badge">{badge}</span> : null}
        </div>
        <div className="finance-mock-header-actions">{actions}</div>
      </header>
      <section className="finance-mock-body">{children}</section>
    </main>
  );
}

export function FinanceCard({ children, className = "" }: { children: ReactNode; className?: string }) { return <section className={`finance-mock-card ${className}`}>{children}</section>; }
export function MetricCard({ label, value, icon, helper }: { label: string; value: string; icon: string; tone?: FinanceTone; helper?: string }) { return <article className="finance-mock-metric"><span className="finance-mock-metric-icon">{icon}</span><div><p>{label}</p><strong>{value}</strong>{helper ? <small>{helper}</small> : null}</div></article>; }
export function LoadingPanel({ label = "Loading finance records..." }: { label?: string }) { return <div className="finance-mock-card"><strong>{label}</strong><p>Please wait while the secure finance workspace is prepared.</p></div>; }
export function StatusPill({ children }: { children: ReactNode; tone?: FinanceTone }) { return <span className="finance-mock-pill">{children}</span>; }
export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: FinanceTone }) { return <button {...props} className={`finance-mock-primary ${props.className || ""}`}>{children}</button>; }
