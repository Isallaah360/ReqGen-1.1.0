"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import AppFrame, { SiteFooter } from "@/app/components/v4/AppFrame";
import { isV4Page } from "@/lib/v4/modules";

/**
 * ReqGen 6.2.0: website frame switch (Blueprint 08). Earlier: v4.0.0 app shell switch.
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
  "/app",
  "/console",
  "/credits",
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

  if (embedded || pathname === "/console") return <>{children}</>;
  // 6.2.0: public pages (sign-in, sign-up, 2FA, password) sit in the same plain website frame
  if (isPublic) return <PublicFrame>{children}</PublicFrame>;

  const moduleKey = pathname.split("/").filter(Boolean)[0] || "dashboard";
  return (
    <AppFrame>
      {isV4Page(pathname)
        ? children
        : <div className={`rg-content v4-legacy module-${moduleKey}`} data-route={pathname}>{children}</div>}
    </AppFrame>
  );
}

function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="s6-site s6-public">
      <header className="s6-top">
        <div className="s6-top-in">
          <Link className="s6-brand" href="/">
            <Image src="/v4/iet-logo.png" alt="Islamic Education Trust logo" width={44} height={44} priority />
            <span><b>Req<span>Gen</span></b><small>Islamic Education Trust, Request and Payment System</small></span>
          </Link>
        </div>
      </header>
      <main className="s6-page s6-public-page">{children}</main>
      <SiteFooter />
    </div>
  );
}
