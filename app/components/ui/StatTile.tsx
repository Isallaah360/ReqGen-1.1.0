import type { ReactNode } from "react";

/**
 * ReqGen v3.0.9 standard stat card — the Budget & Subheads style used
 * system-wide: rounded card, soft border, optional icon, small label,
 * large tone-coloured number, optional note.
 */
export type StatTone = "blue" | "emerald" | "amber" | "purple" | "slate" | "red";

export function StatTile({
  title,
  value,
  tone = "blue",
  icon,
  note,
}: {
  title: string;
  value: ReactNode;
  tone?: StatTone;
  icon?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <article className={`rg-stat is-${tone}`}>
      {icon ? <span className="rg-stat-icon" aria-hidden="true">{icon}</span> : null}
      <div className="rg-stat-text">
        <span className="rg-stat-label">{title}</span>
        <strong className="rg-stat-value">{value}</strong>
        {note ? <small className="rg-stat-note">{note}</small> : null}
      </div>
    </article>
  );
}
