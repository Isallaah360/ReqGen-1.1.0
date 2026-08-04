import type { ReactNode } from "react";

export type ERPCardTone = "default" | "gold" | "blue" | "success" | "danger";

export interface ERPCardProps {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
  tone?: ERPCardTone;
  padding?: "none" | "compact" | "normal";
}

/** Standard surface for forms, charts, tables, KPIs and information panels. */
export default function ERPCard({
  children,
  title,
  eyebrow,
  description,
  action,
  footer,
  className = "",
  tone = "default",
  padding = "normal",
}: ERPCardProps) {
  const hasHeader = Boolean(title || eyebrow || description || action);

  return (
    <section
      className={`erp2-card erp2-card--${tone} erp2-card--pad-${padding} ${className}`.trim()}
    >
      {hasHeader ? (
        <header className="erp2-card__header">
          <div className="erp2-card__heading">
            {eyebrow ? <span className="erp2-card__eyebrow">{eyebrow}</span> : null}
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {action ? <div className="erp2-card__action">{action}</div> : null}
        </header>
      ) : null}

      <div className="erp2-card__body">{children}</div>
      {footer ? <footer className="erp2-card__footer">{footer}</footer> : null}
    </section>
  );
}
