"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type FinanceTone = "blue" | "cyan" | "emerald" | "amber" | "violet" | "rose";

const financeTabs = [
  ["/finance", "Overview"],
  ["/finance/manage-accounts", "Bank Accounts"],
  ["/finance/subheads", "Subheads"],
  ["/finance/account-ledger", "Account Ledger"],
  ["/finance/transactions", "Transactions"],
  ["/finance/reports", "Reports"],
  ["/finance/audit-trail", "Audit"],
  ["/finance/settings", "Settings"],
] as const;

export function FinancePageFrame({ eyebrow, title, description, icon, badge, actions, children }: { eyebrow: string; title: string; description: string; icon: string; tone?: FinanceTone; badge?: string; actions?: ReactNode; children: ReactNode; }) {
  const pathname = usePathname();
  return (
    <main className="finance-mock-page">
      <header className="finance-mock-header">
        <div>
          <span className="finance-mock-eyebrow">{eyebrow}</span>
          <h1><span aria-hidden="true">{icon}</span>{title}</h1>
          <p>{description}</p>
          {badge ? <span className="finance-mock-badge">{badge}</span> : null}
        </div>
        <div className="finance-mock-header-actions">{actions}</div>
      </header>
      <nav className="finance-mock-tabs" aria-label="Finance workspace navigation">
        {financeTabs.map(([href,label]) => <Link key={href} href={href} className={pathname === href || (href !== "/finance" && pathname.startsWith(`${href}/`)) ? "is-active" : ""}>{label}</Link>)}
      </nav>
      <section className="finance-mock-body">{children}</section>
    </main>
  );
}

export function FinanceCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`finance-mock-card ${className}`}>{children}</section>;
}
export function MetricCard({ label, value, icon, helper }: { label: string; value: string; icon: string; tone?: FinanceTone; helper?: string }) {
  return <article className="finance-mock-metric"><span className="finance-mock-metric-icon">{icon}</span><div><p>{label}</p><strong>{value}</strong>{helper ? <small>{helper}</small> : null}</div></article>;
}
export function LoadingPanel({ label = "Loading finance records..." }: { label?: string }) { return <div className="finance-mock-card"><strong>{label}</strong><p>Please wait while the secure finance workspace is prepared.</p></div>; }
export function StatusPill({ children }: { children: ReactNode; tone?: FinanceTone }) { return <span className="finance-mock-pill">{children}</span>; }
export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: FinanceTone }) { return <button {...props} className={`finance-mock-primary ${props.className || ""}`}>{children}</button>; }
