import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "@/app/components/v4/Icon";

/**
 * ReqGen v4.6.12 (Kit K8): the empty state. A drawn person with a darker
 * skin tone, in IET colours, beside a blank paper (inline, well under 30 KB).
 * One sentence and at most one action.
 */
export function EmptyArt() {
  return (
    <svg viewBox="0 0 150 120" width="150" height="120" aria-hidden="true" focusable="false">
      <ellipse cx="75" cy="108" rx="60" ry="8" fill="var(--v4-surface-3)" />
      <rect x="30" y="52" width="58" height="44" rx="6" fill="var(--v4-surface)" stroke="var(--v4-line-strong)" strokeWidth="2" />
      <path d="M40 64h38M40 74h30M40 84h20" stroke="var(--v4-line-strong)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="112" cy="40" r="11" fill="#6B3F24" />
      <path d="M101 36c2-9 20-9 22 0-6-3-16-3-22 0z" fill="#1C2B5A" />
      <path d="M98 104l4-34c1-8 20-8 21 0l4 34z" fill="#FF7A1A" />
      <path d="M100 72l-14 10" stroke="#6B3F24" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

export default function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: { label: string; href?: string; onClick?: () => void; icon?: string } }) {
  return (
    <div className="k-empty">
      <EmptyArt />
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
      {action ? (action.href
        ? <Link className="v4-btn v4-btn-primary" href={action.href}>{action.icon ? <Icon name={action.icon} /> : null}{action.label}</Link>
        : <button className="v4-btn v4-btn-primary" type="button" onClick={action.onClick}>{action.icon ? <Icon name={action.icon} /> : null}{action.label}</button>) : null}
    </div>
  );
}
