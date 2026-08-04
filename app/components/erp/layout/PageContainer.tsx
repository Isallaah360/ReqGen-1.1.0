import type { ReactNode } from "react";

export type ERPPageWidth = "standard" | "wide" | "full";

export interface PageContainerProps {
  children: ReactNode;
  className?: string;
  width?: ERPPageWidth;
}

/** Keeps every ERP module aligned to one controlled content width. */
export default function PageContainer({
  children,
  className = "",
  width = "standard",
}: PageContainerProps) {
  return (
    <div
      className={`erp2-page-container erp2-page-container--${width} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
