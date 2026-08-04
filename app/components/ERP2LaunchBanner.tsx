"use client";

import Link from "next/link";
import { ArrowRight, LayoutDashboard, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";

export default function ERP2LaunchBanner() {
  const pathname = usePathname();
  if (pathname.startsWith("/erp-2") || pathname === "/login" || pathname === "/signup") return null;

  return (
    <aside className="erp2-launch-banner" aria-label="ReqGen ERP 2.0 launch access">
      <div className="erp2-launch-mark"><Sparkles size={18} /></div>
      <div className="erp2-launch-copy">
        <strong>REQGEN ERP 2.0 IS LIVE</strong>
        <span>Open the new enterprise workspace to review the accelerated UI release.</span>
      </div>
      <Link href="/erp-2/dashboard" className="erp2-launch-button">
        <LayoutDashboard size={17} />
        Open ERP 2.0
        <ArrowRight size={16} />
      </Link>
    </aside>
  );
}
