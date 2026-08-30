"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { getApprovedMockupSpec } from "@/lib/approvedMockupSpecs";

type FrameSpec = { section: string; type: string; title: string; description: string };

const SECTION_LABEL: Record<string, string> = {
  "payment-vouchers": "PAYMENT VOUCHERS",
  registry: "REGISTRY",
  hr: "HR",
  reports: "REPORTS",
  "audit-centre": "AUDIT",
  workflow: "WORKFLOW",
  staff: "STAFF",
  admin: "ADMIN",
};


const CANONICAL_SECTION_ROUTES: Record<string, FrameSpec> = {
  "/payment-vouchers/new": { section: "payment-vouchers", type: "form", title: "Create Voucher", description: "Create a payment voucher using the approved ReqGen voucher workflow and authorised finance data." },
  "/payment-vouchers/pending": { section: "payment-vouchers", type: "dashboard", title: "Pending Approval", description: "Review vouchers still moving through checking, authorization or payment approval." },
  "/payment-vouchers/approved": { section: "payment-vouchers", type: "dashboard", title: "Approved Vouchers", description: "Review approved vouchers ready for payment, printing or finance follow-up." },
  "/payment-vouchers/print-centre": { section: "payment-vouchers", type: "dashboard", title: "Print / PDF Centre", description: "Locate approved vouchers and open the official voucher print workspace." },
  "/payment-vouchers/history": { section: "payment-vouchers", type: "dashboard", title: "Payment History", description: "Review the historical register of paid, completed and closed payment vouchers." },
};

/**
 * RMB canonical presentation frame for the approved Sections 5-12 routes.
 *
 * Important: this component does not invent controls, KPIs, filters or data.
 * It provides only the locked title/header/body composition. The functional
 * page underneath remains responsible for all live controls and data contracts.
 */
export default function ApprovedMockupFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const approvedSpec = getApprovedMockupSpec(pathname);
  const spec = (approvedSpec || CANONICAL_SECTION_ROUTES[pathname]) as FrameSpec | undefined;

  if (!spec || spec.type === "redirect" || spec.type === "print") {
    return <>{children}</>;
  }

  return (
    <section
      className={`rg-approved-mockup rg-approved-${spec.type}`}
      data-approved-route={pathname}
      data-approved-section={spec.section}
      data-approved-type={spec.type}
    >
      <header className="rg-approved-header">
        <div className="rg-approved-heading">
          <p className="rg-approved-eyebrow">
            {SECTION_LABEL[spec.section] || spec.section.toUpperCase()}
          </p>
          <h1>{spec.title}</h1>
          <p>{spec.description}</p>
        </div>
      </header>

      <div className="rg-approved-body">{children}</div>
    </section>
  );
}
