"use client";

import { HRAccessGuard } from "@/app/components/hr";
import LeaveDashboard from "@/app/components/hr/LeaveDashboard";

export default function HRLeavePage() {
  return (
    <HRAccessGuard section="leave" permission="view">
      <LeaveDashboard />
    </HRAccessGuard>
  );
}
