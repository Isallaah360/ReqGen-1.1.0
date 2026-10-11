"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import AppFrame from "@/app/components/v4/AppFrame";
import { isV4Page } from "@/lib/v4/modules";

/**
 * ReqGen v4.0.0 — app shell switch.
 * Public pages (home, sign-in, 2FA…) and embedded/print views render on their
 * own. Every signed-in page sits inside the v4 frame (left menu, top bar,
 * breadcrumb, footer). Pages not yet rebuilt in v4 keep their v3 styles via
 * the .rg-content wrapper.
 */
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/mfa",
  "/mfa/setup",
  "/unauthorized",
  "/check",
]);

export default function GovernmentAppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <ShellSwitch>{children}</ShellSwitch>
    </Suspense>
  );
}

function ShellFallback() {
  return (
    <div className="v4-ui" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div className="v4-card v4-card-pad" style={{ textAlign: "center" }}>
        <strong>ReqGen</strong>
        <p className="v4-muted" style={{ margin: "4px 0 0" }}>Loading your secure workspace…</p>
      </div>
    </div>
  );
}

function ShellSwitch({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const params = useSearchParams();
  const embedded = params.get("embedded") === "1";
  const isPublic = PUBLIC_PATHS.has(pathname) || pathname.startsWith("/check/");

  if (isPublic || embedded) return <>{children}</>;

  const moduleKey = pathname.split("/").filter(Boolean)[0] || "dashboard";
  return (
    <AppFrame>
      {isV4Page(pathname)
        ? children
        : <div className={`rg-content v4-legacy module-${moduleKey}`} data-route={pathname}>{children}</div>}
    </AppFrame>
  );
}
