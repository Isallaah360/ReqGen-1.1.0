"use client";

import MotherPage from "@/app/components/v4/MotherPage";
import PrivacyBar from "@/app/components/v4/PrivacyBar";

/** Registry — mother page (mock-up 68): one tile per page; numbers, dates, offices and people only. */
export default function RegistryHome() {
  return <MotherPage moduleKey="registry" before={<PrivacyBar />} />;
}
