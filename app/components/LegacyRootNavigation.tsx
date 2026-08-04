"use client";

import { usePathname } from "next/navigation";
import NavBar from "./NavBar";

export default function LegacyRootNavigation() {
  const pathname = usePathname();
  if (pathname.startsWith("/erp-2")) return null;
  return <NavBar />;
}
