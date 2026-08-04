import type { ReactNode } from "react";
import LegacyERP from "@/app/components/enterprise/LegacyERP";

export default function ERP2Layout({ children }: { children: ReactNode }) {
  return <><LegacyERP />{children}</>;
}
