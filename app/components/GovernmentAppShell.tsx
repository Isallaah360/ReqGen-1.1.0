"use client";

import Link from "next/link";
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
  ChevronDown,
  CircleHelp,
  Sun,
  Globe2,
  PanelLeftClose,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { NAVIGATION_ITEMS } from "@/lib/navigation";
import { canAccessPath } from "@/lib/permissions";
import { getCurrentAuthContext } from "@/lib/auth";

const PUBLIC_PATHS = new Set([
  "/", "/login", "/signup", "/forgot-password", "/reset-password", "/mfa",
  "/mfa/setup", "/unauthorized", "/about",
]);

const MODULE_SUBNAV: Record<string, { href: string; label: string }[]> = {
  "/requests": [
    { href: "/requests", label: "Requests Overview" },
    { href: "/requests/new", label: "Create New Request" },
  ],
  "/finance": [
    { href: "/finance", label: "Finance Overview" },
    { href: "/finance/manage-accounts", label: "IET Bank Accounts" },
    { href: "/finance/manage-accounts/assign", label: "Assign Bank to Officer" },
    { href: "/finance/subheads", label: "Finance Subheads" },
    { href: "/finance/departments", label: "Finance Departments" },
    { href: "/finance/account-ledger", label: "Account Ledger" },
    { href: "/finance/subhead-ledger", label: "Subhead Ledger" },
    { href: "/finance/account-transfers", label: "Account Transfers" },
    { href: "/finance/transactions", label: "Transactions Register" },
    { href: "/finance/manual-voucher", label: "Manual Voucher Centre" },
    { href: "/finance/vouchers", label: "Finance Vouchers" },
    { href: "/finance/reports", label: "Finance Reports" },
    { href: "/finance/reports/monthly", label: "Monthly Reports" },
    { href: "/finance/reports/annual", label: "Annual Reports" },
    { href: "/finance/print-centre", label: "Print / PDF Centre" },
    { href: "/finance/export-centre", label: "Export Centre" },
    { href: "/finance/audit-trail", label: "Audit Trail" },
    { href: "/finance/activity-history", label: "Activity History" },
    { href: "/finance/settings", label: "Finance Settings" },
  ],
};

const CORE_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/requests", label: "Requests", icon: FileText },
  { href: "/finance", label: "Finance", icon: Landmark },
  { href: "/hr", label: "HR", icon: Users },
  { href: "/registry", label: "Registry", icon: Archive },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/audit-centre", label: "Audit", icon: ShieldCheck },
];

const MORE_NAV = [
  { href: "/payment-vouchers", label: "Payment Vouchers", icon: CreditCard },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/workflow", label: "Workflow", icon: Workflow },
  { href: "/staff", label: "Staff", icon: UserRound },
  { href: "/admin", label: "Admin", icon: Settings },
];

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
  const [expandedNav, setExpandedNav] = useState<string | null>(null);
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
    return () => { mounted = false; window.removeEventListener("reqgen-active-role-changed", refresh); };
  }, [isPublic, pathname]);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setQuery("");
    if (pathname.startsWith("/finance")) setExpandedNav("/finance");
    else if (pathname.startsWith("/requests")) setExpandedNav("/requests");
    else setExpandedNav(null);
  }, [pathname]);

  const visibleCore = useMemo(() => CORE_NAV.filter((item) => roleSet.size === 0 || canAccessPath(item.href, roleSet)), [roleSet]);
  const visibleMore = useMemo(() => MORE_NAV.filter((item) => roleSet.size === 0 || canAccessPath(item.href, roleSet)), [roleSet]);
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return NAVIGATION_ITEMS
      .filter((item) => roleSet.size === 0 || canAccessPath(item.href, roleSet))
      .filter((item) => `${item.label} ${item.description} ${item.section} ${(item.keywords || []).join(" ")}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, roleSet]);

  if (isPublic) return <>{children}</>;

  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "RG";
  async function signOut() { await supabase.auth.signOut(); router.replace("/login"); }

  const renderNav = (items: typeof CORE_NAV) => items.map((item) => {
    const Icon = item.icon;
    const active = isActive(pathname, item.href);
    const subnav = MODULE_SUBNAV[item.href] || [];
    const expanded = expandedNav === item.href;
    return (
      <div key={item.href} className={`rg-nav-group ${active ? "is-active" : ""}`}>
        <div className={`rg-nav-row ${active ? "is-active" : ""}`}>
          <Link href={item.href} className="rg-nav-link" onClick={() => subnav.length && setExpandedNav(item.href)}>
            <Icon size={17} /><span>{item.label}</span>
          </Link>
          {subnav.length ? <button type="button" className="rg-nav-toggle" aria-label={`${expanded ? "Collapse" : "Expand"} ${item.label}`} onClick={() => setExpandedNav(expanded ? null : item.href)}><ChevronDown size={15} className={expanded ? "is-open" : ""}/></button> : null}
        </div>
        {subnav.length && expanded ? <div className="rg-subnav">{subnav.map((child) => <Link key={child.href} href={child.href} className={pathname === child.href ? "is-active" : ""}>{child.label}</Link>)}</div> : null}
      </div>
    );
  });

  return (
    <div className="rg-shell">
      <button className={`rg-backdrop ${mobileOpen ? "is-open" : ""}`} onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
      <aside className={`rg-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <div className="rg-brand">
          <Link href="/dashboard" className="rg-brand-mark" aria-label="ReqGen 2.0 home"><span className="rg-cube"><i/><b/><em/></span><strong>ReqGen<sup>2.0</sup></strong></Link>
          <button className="rg-sidebar-collapse" aria-label="Navigation"><PanelLeftClose size={19}/></button>
          <button className="rg-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={19}/></button>
        </div>
        <nav className="rg-nav">{renderNav(visibleCore)}</nav>
        {visibleMore.length ? <div className="rg-more"><span>MORE MODULES</span>{renderNav(visibleMore)}</div> : null}
        <div className="rg-sidebar-user">
          <div className="rg-avatar">{initials}</div>
          <div><strong>{userName}</strong><span>{userEmail || "Authorised user"}</span></div>
          <button onClick={signOut} aria-label="Sign out"><LogOut size={16}/></button>
        </div>
      </aside>

      <section className="rg-stage">
        <header className="rg-topbar">
          <button className="rg-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20}/></button>
          <div className="rg-search-wrap">
            <button className="rg-search-trigger" onClick={() => setSearchOpen((v) => !v)}><Search size={16}/><span>Search anything...</span><kbd>Ctrl + K</kbd></button>
            {searchOpen ? <div className="rg-search-popover"><div className="rg-search-input"><Search size={17}/><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search authorised ReqGen pages..."/></div><div className="rg-search-results">{query && searchResults.length === 0 ? <p>No authorised result found.</p> : null}{searchResults.map((item) => <Link key={item.href} href={item.href}><strong>{item.label}</strong><span>{item.section} · {item.description}</span></Link>)}</div></div> : null}
          </div>
          <div className="rg-top-actions">
            <button type="button" className="rg-icon-btn" aria-label="Theme"><Sun size={19}/></button>
            <button type="button" className="rg-icon-btn" aria-label="Language"><Globe2 size={19}/></button>
            <Link href="/staff/notifications" className="rg-icon-btn rg-bell" aria-label="Notifications"><Bell size={19}/><b>3</b></Link>
            <Link href="/profile" className="rg-profile"><div className="rg-avatar">{initials}</div><div><strong>{userName}</strong><span>System Administrator</span></div><ChevronDown size={15}/></Link>
          </div>
        </header>
        <main id="reqgen-main-content" className="rg-main" role="main"><div className={`rg-content ${pathname.startsWith("/finance") ? "module-finance" : pathname.startsWith("/requests") ? "module-requests" : ""}`}>{children}</div><footer className="rg-footer">© 2026 ReqGen 2.0. All rights reserved.</footer></main>
      </section>
    </div>
  );
}
