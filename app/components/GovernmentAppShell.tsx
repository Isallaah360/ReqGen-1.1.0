"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  Landmark,
  CreditCard,
  Archive,
  Users,
  BarChart3,
  Workflow,
  UserRound,
  Settings,
  Search,
  Bell,
  Menu,
  X,
  LogOut,
  ChevronRight,
  CircleHelp,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { NAVIGATION_ITEMS } from "@/lib/navigation";
import { canAccessPath } from "@/lib/permissions";
import { getCurrentAuthContext } from "@/lib/auth";
import { ActiveRoleBadge } from "./ActiveRoleSwitcher";
import StaffFooter from "./staff/StaffFooter";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/mfa",
  "/mfa/setup",
  "/unauthorized",
  "/about",
]);

const PRIMARY_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/requests", label: "Requests", icon: FileText },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/finance", label: "Finance", icon: Landmark },
  { href: "/payment-vouchers", label: "Payment Vouchers", icon: CreditCard },
  { href: "/registry", label: "Registry", icon: Archive },
  { href: "/hr", label: "HR", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/audit-centre", label: "Audit Centre", icon: ShieldCheck },
  { href: "/workflow", label: "Workflow", icon: Workflow },
  { href: "/staff", label: "Staff", icon: UserRound },
  { href: "/admin", label: "Admin", icon: Settings },
];

function titleFromPath(pathname: string) {
  const exact = NAVIGATION_ITEMS.find((item) => item.href === pathname);
  if (exact) return { title: exact.label, description: exact.description, section: exact.section };

  const staticMatch = NAVIGATION_ITEMS
    .filter((item) => pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (staticMatch) return { title: staticMatch.label, description: staticMatch.description, section: staticMatch.section };

  const parts = pathname.split("/").filter(Boolean);
  const last = parts.at(-1) || "ReqGen";
  const title = last
    .replace(/\[|\]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return {
    title,
    description: "Secure institutional workspace for authorised ReqGen operations.",
    section: parts[0]?.replace(/[-_]+/g, " ") || "ReqGen",
  };
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href || pathname.startsWith("/dashboard/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function GovernmentAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.has(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [roleSet, setRoleSet] = useState<Set<string>>(new Set());
  const [userName, setUserName] = useState("ReqGen User");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    if (isPublic) return;
    let mounted = true;
    async function loadContext() {
      const [context, auth] = await Promise.all([getCurrentAuthContext(), supabase.auth.getUser()]);
      if (!mounted) return;
      const next = new Set<string>();
      if (context?.activeRoleKey) next.add(context.activeRoleKey);
      setRoleSet(next);
      const user = auth.data.user;
      const metaName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0];
      setUserName(metaName || "ReqGen User");
      setUserEmail(user?.email || "");
    }
    void loadContext();
    const refresh = () => void loadContext();
    window.addEventListener("reqgen-active-role-changed", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("reqgen-active-role-changed", refresh);
    };
  }, [isPublic, pathname]);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setQuery("");
  }, [pathname]);

  const accessiblePrimary = useMemo(
    () => PRIMARY_NAV.filter((item) => roleSet.size === 0 || canAccessPath(item.href, roleSet)),
    [roleSet],
  );

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return NAVIGATION_ITEMS
      .filter((item) => roleSet.size === 0 || canAccessPath(item.href, roleSet))
      .filter((item) => `${item.label} ${item.description} ${item.section} ${(item.keywords || []).join(" ")}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, roleSet]);

  if (isPublic) return <>{children}</>;

  const context = titleFromPath(pathname);
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "RG";

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="gov-shell">
      <button className="gov-mobile-backdrop" data-open={mobileOpen ? "true" : "false"} onClick={() => setMobileOpen(false)} aria-label="Close navigation" />

      <aside className={`gov-sidebar ${mobileOpen ? "is-open" : ""}`} aria-label="Primary navigation">
        <div className="gov-brand">
          <Image src="/iet-logo.png" alt="Islamic Education Trust" width={52} height={52} className="gov-brand-logo" priority />
          <div>
            <strong>ReqGen</strong>
            <span>Request Management System</span>
          </div>
          <button className="gov-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>

        <nav className="gov-nav">
          {accessiblePrimary.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} className={`gov-nav-link ${active ? "is-active" : ""}`}>
                <Icon size={19} aria-hidden="true" />
                <span>{item.label}</span>
                <ChevronRight size={15} className="gov-nav-chevron" aria-hidden="true" />
              </Link>
            );
          })}
        </nav>

        <div className="gov-nav-secondary">
          <span>Quick links</span>
          <Link href="/profile"><UserRound size={18} />My Profile</Link>
          <Link href="/staff/notifications"><Bell size={18} />Notifications</Link>
          <Link href="/about"><CircleHelp size={18} />About ReqGen</Link>
        </div>

        <div className="gov-sidebar-user">
          <div className="gov-avatar">{initials}</div>
          <div className="gov-sidebar-user-copy">
            <strong>{userName}</strong>
            <span>{userEmail || "Authenticated user"}</span>
          </div>
          <button onClick={signOut} aria-label="Log out" data-tip="Sign out securely from ReqGen."><LogOut size={18} /></button>
        </div>
      </aside>

      <div className="gov-stage">
        <header className="gov-topbar">
          <button className="gov-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={22} /></button>

          <div className="gov-search-wrap">
            <button className="gov-search-trigger" onClick={() => setSearchOpen((value) => !value)} data-tip="Search authorised ReqGen pages and functions.">
              <Search size={18} />
              <span>Search ReqGen...</span>
            </button>
            {searchOpen && (
              <div className="gov-search-popover">
                <div className="gov-search-input-wrap"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages, reports, registers..." /></div>
                <div className="gov-search-results">
                  {query && searchResults.length === 0 ? <p>No authorised result found.</p> : null}
                  {searchResults.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <strong>{item.label}</strong>
                      <span>{item.section} · {item.description}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="gov-topbar-actions">
            <Link href="/staff/notifications" className="gov-icon-button" aria-label="Notifications"><Bell size={19} /></Link>
            <ActiveRoleBadge />
            <div className="gov-topbar-profile">
              <div className="gov-avatar">{initials}</div>
              <div><strong>{userName}</strong><span>Authorised user</span></div>
            </div>
          </div>
        </header>

        <main id="reqgen-main-content" className="gov-main" role="main">
          <div className="gov-content">{children}</div>
          <StaffFooter />
        </main>
      </div>
    </div>
  );
}
