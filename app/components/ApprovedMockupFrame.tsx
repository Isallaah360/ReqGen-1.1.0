"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { getApprovedMockupSpec } from "@/lib/approvedMockupSpecs";

const SECTION_LABEL: Record<string, string> = {
  "payment-vouchers": "PAYMENT VOUCHERS",
  registry: "REGISTRY",
  hr: "HR",
  reports: "REPORTS",
  "audit-centre": "AUDIT CENTRE",
  workflow: "WORKFLOW",
  staff: "STAFF",
  admin: "ADMIN",
};
const SECTION_NO: Record<string, string> = {
  "payment-vouchers": "SECTION 5",
  registry: "SECTION 6",
  hr: "SECTION 7",
  reports: "SECTION 8",
  "audit-centre": "SECTION 9",
  workflow: "SECTION 10",
  staff: "SECTION 11",
  admin: "SECTION 12",
};

function cleanLabel(value: string) {
  return value
    .replace(/^\{.*\}$/g, "")
    .replace(/[✕—]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq(values: string[], limit: number) {
  return [...new Set(values.map(cleanLabel).filter(Boolean))].slice(0, limit);
}

export default function ApprovedMockupFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const spec = getApprovedMockupSpec(pathname);

  if (!spec || spec.type === "redirect") return <>{children}</>;

  const kpis = uniq(spec.kpis.length ? spec.kpis : spec.filters, 5);
  const filters = uniq(spec.filters, 5);
  const sections = uniq(spec.sections.length ? spec.sections : spec.headings, 5);
  const primaryTitle = sections[0] || spec.title;
  const summary = sections.slice(1, 5);
  const isPrint = spec.type === "print";

  return (
    <section
      className={`rg-approved-mockup rg-approved-${spec.type}`}
      data-approved-route={pathname}
      data-approved-section={spec.section}
    >
      <header className="rg-approved-header">
        <div className="rg-approved-heading">
          <p className="rg-approved-eyebrow">
            {SECTION_NO[spec.section] || "REQGEN"} · {SECTION_LABEL[spec.section] || spec.section.toUpperCase()} · ADOPTED SHELL
          </p>
          <h1>{spec.title}</h1>
          <p>{spec.description}</p>
        </div>
      </header>

      {!isPrint && kpis.length > 0 ? (
        <section className={`rg-approved-kpis rg-kpi-count-${Math.min(kpis.length, 5)}`} aria-label={`${spec.title} summary`}>
          {kpis.map((label, index) => (
            <article className="rg-approved-kpi" key={`${label}-${index}`}>
              <span>{label}</span>
              <strong>—</strong>
              <small>Live authorised data</small>
            </article>
          ))}
        </section>
      ) : null}

      {!isPrint && filters.length > 0 ? (
        <div className="rg-approved-filterbar" aria-hidden="true">
          <div className="rg-approved-search-faux">Search this workspace...</div>
          {filters.slice(0, 4).map((label, index) => (
            <div className="rg-approved-filter-faux" key={`${label}-${index}`}>{label}</div>
          ))}
        </div>
      ) : null}

      <div className={isPrint ? "rg-approved-grid rg-approved-grid-print" : "rg-approved-grid"}>
        <section className="rg-approved-primary">
          <div className="rg-approved-primary-head"><h2>{primaryTitle}</h2></div>
          <div className="rg-approved-body">{children}</div>
        </section>

        {!isPrint ? (
          <aside className="rg-approved-summary" aria-label={`${spec.title} workspace summary`}>
            <div className="rg-approved-summary-head">Workspace Summary</div>
            <div className="rg-approved-summary-list">
              {(summary.length ? summary : ["Quick Actions", "Current Status", "Important Information"]).map((item, index) => (
                <div className="rg-approved-summary-item" key={`${item}-${index}`}>
                  <strong>{item}</strong>
                  <small>Existing ReqGen function / record.</small>
                </div>
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
