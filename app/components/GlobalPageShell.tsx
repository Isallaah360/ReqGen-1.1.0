"use client";

import Image from "next/image";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NAVIGATION_ITEMS } from "@/lib/navigation";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/mfa",
  "/mfa/setup",
  "/unauthorized",
]);

function humanize(segment: string) {
  return decodeURIComponent(segment)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function routeMeta(pathname: string) {
  const exact = NAVIGATION_ITEMS.find((item) => item.href === pathname);
  if (exact) return exact;

  const prefix = NAVIGATION_ITEMS
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  const parts = pathname.split("/").filter(Boolean);
  const last = parts.at(-1) || "Workspace";
  const first = parts[0] || "ReqGen";

  return {
    href: pathname,
    label: prefix?.label || humanize(last),
    section: prefix?.section || humanize(first),
    description:
      prefix?.description ||
      `Secure ${humanize(first)} workspace. Functions shown here remain controlled by your active role.`,
  };
}

function ReqGenFooter() {
  return (
    <footer className="reqgen-site-footer" aria-label="ReqGen footer">
      <div className="reqgen-site-footer__inner">
        <div className="reqgen-site-footer__brand">
          <Image src="/be-logo.png" alt="Barderian Enterprises" width={38} height={32} />
          <div>
            <strong>ReqGen 1.1.0</strong>
            <span>Powered by Barderian Enterprises</span>
          </div>
        </div>
        <div className="reqgen-site-footer__links">
          <a href="https://barderians.com.ng" target="_blank" rel="noreferrer">barderians.com.ng</a>
          <a href="mailto:info@barderians.com.ng">info@barderians.com.ng</a>
          <span>© 2026 Islamic Education Trust</span>
        </div>
      </div>
    </footer>
  );
}

export default function GlobalPageShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [hasLocalHero, setHasLocalHero] = useState(false);
  const isPublic = PUBLIC_PATHS.has(pathname);
  const meta = useMemo(() => routeMeta(pathname), [pathname]);

  useEffect(() => {
    if (isPublic) return;

    const id = window.requestAnimationFrame(() => {
      const root = contentRef.current;
      if (!root) return;
      const h1 = root.querySelector("h1");
      const explicitHero = root.querySelector(
        ".workflow-hero, .reqgen-hero, .erp2-page-header, [data-page-hero='true']"
      );

      if (h1 && !explicitHero) {
        const headingBox = h1.parentElement;
        if (headingBox && headingBox !== root && headingBox.children.length <= 8) {
          headingBox.classList.add("reqgen-auto-heading");
        }
      }

      setHasLocalHero(Boolean(h1 || explicitHero));
    });

    return () => window.cancelAnimationFrame(id);
  }, [pathname, isPublic]);

  if (isPublic) {
    return (
      <div className="reqgen-public-shell">
        <div className="reqgen-public-content" ref={contentRef}>{children}</div>
        <ReqGenFooter />
      </div>
    );
  }

  return (
    <div className="reqgen-page-shell">
      {!hasLocalHero && (
        <header className="reqgen-route-hero" data-page-hero="true">
          <div className="reqgen-route-hero__copy">
            <span>{meta.section}</span>
            <h1>{meta.label}</h1>
            <p>{meta.description}</p>
          </div>
          <div className="reqgen-route-hero__badge">ReqGen 1.1.0</div>
        </header>
      )}

      <div className="reqgen-page-body" ref={contentRef}>{children}</div>
      <ReqGenFooter />
    </div>
  );
}
