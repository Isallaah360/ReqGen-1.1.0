"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import NavBar from "./NavBar";

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

export default function LegacyRootNavigation() {
  const pathname = usePathname();
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    const isEmbedded = new URLSearchParams(window.location.search).get("embedded") === "1";
    setEmbedded(isEmbedded);
    document.documentElement.classList.toggle("reqgen-erp-embedded", isEmbedded);
    document.body.classList.toggle("reqgen-erp-embedded", isEmbedded);
    return () => {
      document.documentElement.classList.remove("reqgen-erp-embedded");
      document.body.classList.remove("reqgen-erp-embedded");
    };
  }, [pathname]);

  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/erp-2") || embedded) return null;
  return <NavBar />;
}
