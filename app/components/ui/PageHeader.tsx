import type { ReactNode } from "react";

/**
 * ReqGen standard page header — v4.0.0 look (title 28px, one line of help,
 * actions on the right). Used by pages not yet rebuilt, so they match v4.
 */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="v4-ui v4-page-head v4-bridge-head">
      <div>
        <h1 className="v4-page-title">{title}</h1>
        {description ? <p className="v4-page-sub">{description}</p> : null}
      </div>
      {actions ? <div className="v4-actions">{actions}</div> : null}
    </header>
  );
}
