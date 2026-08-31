"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/profile", label: "Profile" },
  { href: "/profile/access", label: "Access" },
  { href: "/profile/activity", label: "Activity" },
  { href: "/profile/security", label: "Security" },
  { href: "/change-password", label: "Password" },
];

export default function ProfileNavigation() {
  const pathname = usePathname();
  if (pathname.startsWith("/erp-2")) return null;
  return (
    <nav className="rg-local-tabs" aria-label="Profile sections">
      {items.map((item) => {
        const active = pathname === item.href;
        return <Link key={item.href} href={item.href} className={active ? "is-active" : ""}>{item.label}</Link>;
      })}
    </nav>
  );
}
