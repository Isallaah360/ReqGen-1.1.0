import type { ReactNode } from "react";

/**
 * ReqGen v3.1.4 — THE standard page header (one per page):
 * title, at most one description line, and actions on the right.
 * No eyebrow labels, icon tiles, date/"workspace" chips or second breadcrumbs —
 * the app's breadcrumb bar and module tabs already provide that context.
 */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="rg-page-std">
      <div className="rg-page-std-text">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="rg-page-std-actions">{actions}</div> : null}
    </header>
  );
}
