"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/profile", label: "Personal Information" },
  { href: "/profile/access", label: "Access & Roles" },
  { href: "/profile/activity", label: "Activity" },
  { href: "/profile/security", label: "Security & Sessions" },
  { href: "/change-password", label: "Change Password" },
];

export default function ProfileNavigation() {
  const pathname = usePathname();
  if (pathname.startsWith("/erp-2")) return null;
  return (
    <nav className="rg-local-tabs" data-rg-tabs="true" aria-label="Profile sections">
      {items.map((item) => {
        const active = pathname === item.href;
        return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={active ? "is-active" : ""}>{item.label}</Link>;
      })}
    </nav>
  );
}
