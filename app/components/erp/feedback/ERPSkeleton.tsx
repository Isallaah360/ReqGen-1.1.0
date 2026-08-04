export interface ERPSkeletonProps {
  variant?: "dashboard" | "table" | "form";
  rows?: number;
}

function Bar({ width = "100%" }: { width?: string }) {
  return <span className="erp2-skeleton__bar" style={{ width }} />;
}

/** Content-only loading state. The sidebar and top navigation remain mounted. */
export default function ERPSkeleton({
  variant = "dashboard",
  rows = 6,
}: ERPSkeletonProps) {
  if (variant === "table") {
    return (
      <div className="erp2-skeleton erp2-skeleton--table" aria-label="Loading records" role="status">
        <div className="erp2-skeleton__toolbar"><Bar width="35%" /><Bar width="18%" /></div>
        {Array.from({ length: rows }).map((_, index) => (
          <div className="erp2-skeleton__row" key={index}>
            <Bar width="12%" /><Bar width="24%" /><Bar width="18%" /><Bar width="14%" /><Bar width="10%" />
          </div>
        ))}
        <span className="erp2-visually-hidden">Loading records</span>
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div className="erp2-skeleton erp2-skeleton--form" aria-label="Loading form" role="status">
        {Array.from({ length: rows }).map((_, index) => (
          <div className="erp2-skeleton__field" key={index}><Bar width="32%" /><Bar /></div>
        ))}
        <span className="erp2-visually-hidden">Loading form</span>
      </div>
    );
  }

  return (
    <div className="erp2-skeleton erp2-skeleton--dashboard" aria-label="Loading dashboard" role="status">
      <div className="erp2-skeleton__kpis">
        {Array.from({ length: 4 }).map((_, index) => <div className="erp2-skeleton__kpi" key={index}><Bar width="48%" /><Bar width="34%" /><Bar width="56%" /></div>)}
      </div>
      <div className="erp2-skeleton__panels"><div /><div /></div>
      <div className="erp2-skeleton__table"><Bar width="28%" />{Array.from({ length: 5 }).map((_, index) => <Bar key={index} />)}</div>
      <span className="erp2-visually-hidden">Loading dashboard</span>
    </div>
  );
}
