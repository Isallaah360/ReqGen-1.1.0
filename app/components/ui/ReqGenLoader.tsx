import Image from "next/image";

/**
 * v3.0.10 loading animation: the IET logo stays still while an IET-coloured arc
 * sweeps around it and a dotted ring turns the other way; skeleton cards
 * shimmer where content will appear. Respects reduced-motion preferences.
 */
export default function ReqGenLoader({ title = "Preparing your workspace…", detail = "Loading requests, approvals and balances", skeleton = true }: {
  title?: string; detail?: string; skeleton?: boolean;
}) {
  return (
    <section className="rg-loader" aria-live="polite" aria-busy="true">
      <div className="rg-loader-mark">
        <svg className="rg-loader-arc" width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
          <defs>
            <linearGradient id="rgLoaderArc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f06c24" /><stop offset=".45" stopColor="#e43c24" />
              <stop offset=".75" stopColor="#f09c18" /><stop offset="1" stopColor="#30a8d8" />
            </linearGradient>
          </defs>
          <circle cx="75" cy="75" r="68" fill="none" stroke="#f3e6da" strokeWidth="6" />
          <circle cx="75" cy="75" r="68" fill="none" stroke="url(#rgLoaderArc)" strokeWidth="6" strokeLinecap="round" strokeDasharray="150 278" />
        </svg>
        <svg className="rg-loader-dots" width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
          <circle cx="75" cy="75" r="57" fill="none" stroke="#f06c24" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="0.1 9.5" opacity=".75" />
        </svg>
        <span className="rg-loader-logo">
          <Image src="/iet-logo-mark.png" alt="Islamic Education Trust logo" width={82} height={82} priority />
        </span>
      </div>
      <p className="rg-loader-title" role="status">{title}</p>
      <p className="rg-loader-detail">{detail}</p>
      {skeleton ? <div className="rg-loader-skeleton" aria-hidden="true"><i /><i /><i /><i /></div> : null}
    </section>
  );
}
