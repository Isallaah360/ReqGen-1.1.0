"use client";

import MotherPage from "@/app/components/v4/MotherPage";
import { Notice } from "@/app/components/v4/ui";

/** Audit — mother page (mock-up 74): one audit log, journeys, reconciliation and backups. */
export default function AuditHome() {
  return (
    <MotherPage moduleKey="audit">
      <Notice tone="blue">The Compliance report lives in <b>Reports › Compliance</b> — one place for every report.</Notice>
    </MotherPage>
  );
}
