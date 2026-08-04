"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import NavBar from "./NavBar";

export default function LegacyRootNavigation() {
  const pathname = usePathname();
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    setEmbedded(new URLSearchParams(window.location.search).get("embedded") === "1");
  }, [pathname]);

  if (pathname.startsWith("/erp-2") || embedded) return null;
  return <NavBar />;
}
