import type { ReactNode } from "react";

export interface ERPWorkspaceProps {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}

/**
 * The scrollable content region beneath the persistent ERP shell.
 * This component never renders application navigation or security UI.
 */
export default function ERPWorkspace({
  children,
  className = "",
  labelledBy,
}: ERPWorkspaceProps) {
  return (
    <main
      id="erp-main-content"
      className={`erp2-workspace ${className}`.trim()}
      aria-labelledby={labelledBy}
      tabIndex={-1}
    >
      {children}
    </main>
  );
}
