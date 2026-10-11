"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "./Icon";
import type { Tone } from "@/lib/v4/modules";

/* ReqGen v4 UI kit — the approved mock-up components as React. */

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Every v4 page sits inside this wrapper so the v4 element styles apply. */
export function V4Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("v4-ui v4-page", className)}>{children}</div>;
}

export type Action = { href?: string; onClick?: () => void; label: string; icon?: string; kind?: "primary" | "secondary" | "ghost" | "danger"; disabled?: boolean };

export function Btn({ a, small }: { a: Action; small?: boolean }) {
  const cls = cx("v4-btn", `v4-btn-${a.kind || "secondary"}`);
  const style = small ? { minHeight: 38, padding: "0 14px" } : undefined;
  const inner = <>{a.icon ? <Icon name={a.icon} /> : null}{a.label}</>;
  if (a.href && !a.disabled) return <Link className={cls} href={a.href} style={style}>{inner}</Link>;
  return <button className={cls} type="button" onClick={a.onClick} disabled={a.disabled} style={style}>{inner}</button>;
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: Action[] }) {
  return (
    <div className="v4-page-head">
      <div>
        <h1 className="v4-page-title">{title}</h1>
        {sub ? <p className="v4-page-sub">{sub}</p> : null}
      </div>
      {actions && actions.length ? <div className="v4-actions">{actions.map((a) => <Btn key={a.label} a={a} />)}</div> : null}
    </div>
  );
}

export type StatItem = { label: string; value: ReactNode; note?: ReactNode; icon: string; tone: Tone; href?: string; pressed?: boolean; onClick?: () => void };

export function Stat({ s }: { s: StatItem }) {
  const body = (
    <>
      <span className={`v4-ico v4-t-${s.tone}`}><Icon name={s.icon} /></span>
      <span>
        <span className="v4-l">{s.label}</span>
        <span className="v4-v">{s.value}</span>
        {s.note ? <span className="v4-n">{s.note}</span> : null}
      </span>
    </>
  );
  if (s.href) return <Link className="v4-stat" href={s.href}>{body}</Link>;
  return <button className="v4-stat" type="button" aria-pressed={s.pressed ? "true" : "false"} onClick={s.onClick}>{body}</button>;
}

export function Stats({ items, label = "Summary" }: { items: StatItem[]; label?: string }) {
  if (!items.length) return null;
  return <section className="v4-stats" aria-label={label}>{items.map((s) => <Stat key={s.label} s={s} />)}</section>;
}

export type TileItem = { href: string; title: string; purpose: string; icon: string; tone: Tone; meta?: ReactNode; badge?: ReactNode };

export function Tile({ t }: { t: TileItem }) {
  return (
    <Link className="v4-tile" href={t.href}>
      {t.badge ? <span className="v4-badge">{t.badge}</span> : null}
      <span className={`v4-ico v4-t-${t.tone}`}><Icon name={t.icon} /></span>
      <strong>{t.title}</strong>
      <p>{t.purpose}</p>
      <span className="v4-meta">
        <span className="v4-muted">{t.meta ?? " "}</span>
        <span className="v4-go">Open<Icon name="right" size="sm" /></span>
      </span>
    </Link>
  );
}

export function Tiles({ items, label }: { items: TileItem[]; label: string }) {
  return <section className="v4-tiles" aria-label={label}>{items.map((t) => <Tile key={t.href + t.title} t={t} />)}</section>;
}

export function Card({ title, link, children, pad, className }: { title?: ReactNode; link?: { href: string; label: string }; children: ReactNode; pad?: boolean; className?: string }) {
  return (
    <section className={cx("v4-card", pad && "v4-card-pad", className)}>
      {title ? (
        <div className={pad ? undefined : "v4-card-head"} style={pad ? { display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 } : undefined}>
          <h2 className="v4-h2">{title}</h2>
          {link ? <Link href={link.href}>{link.label} <Icon name="right" size="sm" /></Link> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export type ChipTone = "green" | "amber" | "red" | "blue" | "brand" | "grey";

export function Chip({ tone = "grey", children }: { tone?: ChipTone; children: ReactNode }) {
  return <span className={`v4-chip v4-chip-${tone}`}>{children}</span>;
}

const NOTICE_ICON: Record<string, string> = { blue: "info", green: "check", amber: "clock", red: "alert" };

export function Notice({ tone = "blue", title, children }: { tone?: "blue" | "green" | "amber" | "red"; title?: string; children?: ReactNode }) {
  return (
    <div className={`v4-notice v4-notice-${tone}`} role={tone === "red" ? "alert" : undefined}>
      <Icon name={NOTICE_ICON[tone]} />
      <span>{title ? <b>{title}</b> : null}{title && children ? " " : null}{children}</span>
    </div>
  );
}

export type RowItem = { key: string; icon: string; tone: Tone; title: ReactNode; sub?: ReactNode; right?: ReactNode; unread?: boolean; href?: string; onClick?: () => void };

export function Rows({ items, empty }: { items: RowItem[]; empty?: ReactNode }) {
  if (!items.length) return <p className="v4-muted" style={{ padding: "16px 20px", margin: 0 }}>{empty ?? "Nothing here yet."}</p>;
  return (
    <ul className="v4-rows">
      {items.map((r) => {
        const inner = (
          <>
            <span className={`v4-ri v4-t-${r.tone}`}><Icon name={r.icon} /></span>
            <span className="v4-rt"><strong>{r.title}</strong>{r.sub ? <span>{r.sub}</span> : null}</span>
            {r.right ? <span className="v4-rr">{r.right}</span> : null}
          </>
        );
        return (
          <li key={r.key} className={r.unread ? "v4-unread" : undefined}>
            {r.href ? <Link href={r.href} className="v4-row-link" onClick={r.onClick}>{inner}</Link>
              : r.onClick ? <button type="button" className="v4-row-link" onClick={r.onClick}>{inner}</button>
              : inner}
          </li>
        );
      })}
    </ul>
  );
}

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: Array<{ key: T; label: string; count?: number }>; label: string }) {
  return (
    <div className="v4-tabs" role="tablist" aria-label={label}>
      {items.map((t) => (
        <button key={t.key} role="tab" type="button" aria-selected={value === t.key} onClick={() => onChange(t.key)}>
          {t.label}{typeof t.count === "number" ? <span className="v4-n">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon = "info", title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="v4-empty-state">
      <span className="v4-ico v4-t-blue"><Icon name={icon} /></span>
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return <div className="v4-skeleton" aria-hidden="true">{Array.from({ length: lines }).map((_, i) => <i key={i} />)}</div>;
}

export function naira(n: number | null | undefined, opts: { compact?: boolean } = {}) {
  const v = Number(n || 0);
  if (opts.compact && Math.abs(v) >= 1_000_000) return `₦ ${(v / 1_000_000).toFixed(2)}m`;
  return `₦ ${v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
