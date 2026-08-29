"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { getApprovedMockupSpec } from "@/lib/approvedMockupSpecs";

const SECTION_LABEL: Record<string, string> = {
  "payment-vouchers": "Payment Vouchers",
  registry: "Registry",
  hr: "Human Resources",
  reports: "Reports",
  "audit-centre": "Audit Centre",
  workflow: "Workflow",
  staff: "Staff",
  admin: "Administration",
};

export default function ApprovedMockupFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const spec = getApprovedMockupSpec(pathname);

  if (!spec || spec.type === "redirect") return <>{children}</>;

  const showSummary = spec.type !== "print";
  const summary = spec.sections.length ? spec.sections.slice(0, 5) : [spec.title];

  return (
    <section className={`rg-approved-mockup rg-approved-${spec.type}`} data-approved-route={pathname}>
      <header className="rg-approved-header">
        <div className="rg-approved-heading">
          <p className="rg-approved-eyebrow">{SECTION_LABEL[spec.section] || spec.section} · Approved Shell</p>
          <h1>{spec.title}</h1>
          <p>{spec.description}</p>
        </div>
      </header>

      <div className={showSummary ? "rg-approved-grid" : "rg-approved-grid rg-approved-grid-print"}>
        <div className="rg-approved-body">{children}</div>
        {showSummary ? (
          <aside className="rg-approved-summary" aria-label={`${spec.title} workspace summary`}>
            <div className="rg-approved-summary-head">Workspace Summary</div>
            <div className="rg-approved-summary-list">
              {summary.map((item, index) => (
                <div className="rg-approved-summary-item" key={`${item}-${index}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{item}</strong><small>Available in this workspace</small></div>
                </div>
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
