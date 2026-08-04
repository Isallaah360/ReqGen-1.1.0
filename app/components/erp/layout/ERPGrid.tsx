import type { CSSProperties, ReactNode } from "react";

export interface ERPGridProps {
  children: ReactNode;
  className?: string;
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  minItemWidth?: number;
  gap?: "sm" | "md" | "lg";
  align?: "stretch" | "start";
}

/** Responsive grid that prevents stretched cards and uncontrolled empty space. */
export default function ERPGrid({
  children,
  className = "",
  columns,
  minItemWidth = 220,
  gap = "md",
  align = "stretch",
}: ERPGridProps) {
  const style = {
    "--erp2-grid-columns": columns ?? "auto",
    "--erp2-grid-min": `${minItemWidth}px`,
  } as CSSProperties;

  return (
    <div
      className={`erp2-grid erp2-grid--gap-${gap} erp2-grid--align-${align} ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}
