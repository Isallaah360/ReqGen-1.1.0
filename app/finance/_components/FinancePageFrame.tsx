"use client";

import { type ReactNode } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { StatTile } from "@/app/components/ui/StatTile";
import {
  Activity, Archive, BarChart3, BookOpen, BookText, CalendarDays, Clock3, Compass, CreditCard, FileSpreadsheet,
  CheckCircle2, Files, FileText, FolderOpen, Inbox, Landmark, Link2, LockKeyhole, Printer, Receipt, Repeat, Search, Settings, ShieldCheck, Upload, XCircle,
} from "lucide-react";

/**
 * v3.0.6: Finance pages historically passed emoji as icons. They are mapped to
 * the standard line-icon set here, so every Finance page uses the same icons
 * as the rest of ReqGen (and they follow light/dark theme colours).
 */
const EMOJI_ICON: Record<string, typeof Receipt> = {
  "🧾": Receipt, "🔁": Repeat, "⚙️": Settings, "⚙": Settings, "💠": Activity, "🕘": Clock3, "🔎": Search,
  "🏦": Landmark, "🏛️": Landmark, "🏛": Landmark, "🕊️": Inbox, "🧭": Compass, "🔗": Link2, "🗄️": Archive, "🗃️": Archive,
  "📗": FileSpreadsheet, "📑": Files, "🛡️": ShieldCheck, "🛡": ShieldCheck, "💳": CreditCard, "📘": BookOpen,
  "📒": BookText, "📊": BarChart3, "📄": FileText, "🗂️": FolderOpen, "📅": CalendarDays, "🔐": LockKeyhole, "☀️": CalendarDays, "✓": CheckCircle2, "✕": XCircle, "📤": Upload, "🖨️": Printer, "🖨": Printer,
};
export function FinanceIcon({ icon, size = 20 }: { icon: ReactNode; size?: number }) {
  if (typeof icon !== "string") return <>{icon}</>;
  const Icon = EMOJI_ICON[icon.trim()] || EMOJI_ICON[icon.trim().replace(/\uFE0F/g, "")];
  if (Icon) return <Icon size={size} aria-hidden="true" />;
  return <FileText size={size} aria-hidden="true" />;
}

export type FinanceTone = "blue" | "cyan" | "emerald" | "amber" | "violet" | "rose";

export function FinancePageFrame({ title, description, actions, children }: { eyebrow: string; title: string; description: string; icon: ReactNode; tone?: FinanceTone; badge?: string; actions?: ReactNode; children: ReactNode; }) {
  return (
    <main className="finance-mock-page">
      <PageHeader title={title} description={description} actions={actions} />
      <section className="finance-mock-body">{children}</section>
    </main>
  );
}

export function FinanceCard({ children, className = "" }: { children: ReactNode; className?: string }) { return <section className={`finance-mock-card ${className}`}>{children}</section>; }
export function MetricCard({ label, value, icon, helper }: { label: string; value: string; icon: ReactNode; tone?: FinanceTone; helper?: string }) {
  return <StatTile title={label} value={value} icon={<FinanceIcon icon={icon} size={18} />} note={helper} tone="orange" />;
}
export function LoadingPanel({ label = "Loading finance records..." }: { label?: string }) { return <div className="finance-mock-card"><strong>{label}</strong><p>Please wait while the secure finance workspace is prepared.</p></div>; }
export function StatusPill({ children }: { children: ReactNode; tone?: FinanceTone }) { return <span className="finance-mock-pill">{children}</span>; }
export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: FinanceTone }) { return <button {...props} className={`finance-mock-primary ${props.className || ""}`}>{children}</button>; }
