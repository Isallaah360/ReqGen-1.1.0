/**
 * ReqGen v3.1.0 loader: the familiar Windows/Android-style circle of dots
 * chasing each other, in IET orange (no logo). Skeleton cards shimmer where
 * content will appear. Respects reduced-motion preferences.
 */
export default function ReqGenLoader({ title = "Loading…", detail = "Preparing your workspace", skeleton = true }: {
  title?: string; detail?: string; skeleton?: boolean;
}) {
  return (
    <section className="rg-loader" aria-live="polite" aria-busy="true">
      <div className="rg-spinner" aria-hidden="true">
        <i /><i /><i /><i /><i />
      </div>
      <p className="rg-loader-title" role="status">{title}</p>
      <p className="rg-loader-detail">{detail}</p>
      {skeleton ? <div className="rg-loader-skeleton" aria-hidden="true"><i /><i /><i /><i /></div> : null}
    </section>
  );
}
