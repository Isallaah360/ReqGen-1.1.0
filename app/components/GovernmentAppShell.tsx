"use client";

import Image from "next/image";
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
  MessageSquare,
  Menu,
  X,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { NAVIGATION_ITEMS } from "@/lib/navigation";
import { canAccessPath } from "@/lib/permissions";
import { getCurrentAuthContext } from "@/lib/auth";
import { ActiveRoleSwitcher } from "./ActiveRoleSwitcher";
import StaffFooter from "./staff/StaffFooter";

const PUBLIC_PATHS = new Set([
  "/", "/login", "/signup", "/forgot-password", "/reset-password", "/mfa",
  "/mfa/setup", "/unauthorized", "/about",
]);

type SubNavItem = { href: string; label: string };

const MODULE_SUBNAV: Record<string, SubNavItem[]> = {
  "/requests": [
    { href: "/requests", label: "Requests Overview" },
    { href: "/requests/new", label: "Create New Request" },
  ],
  "/approvals": [
    { href: "/approvals", label: "Approvals Overview" },
    { href: "/approvals/action-centre", label: "Action Centre" },
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
  "/payment-vouchers": [
    { href: "/payment-vouchers", label: "Voucher Register" },
    { href: "/payment-vouchers/reports", label: "Voucher Reports" },
    { href: "/payment-vouchers/settings", label: "Voucher Settings" },
  ],
  "/registry": [
    { href: "/registry", label: "Registry Overview" },
    { href: "/registry/incoming", label: "Incoming Register" },
    { href: "/registry/outgoing", label: "Outgoing Register" },
    { href: "/registry/dispatch", label: "Dispatch" },
    { href: "/registry/operations", label: "Registry Operations" },
    { href: "/registry/archive", label: "Archive" },
  ],
  "/hr": [
    { href: "/hr", label: "HR Overview" },
    { href: "/hr/my-work", label: "My HR Work" },
    { href: "/hr/review", label: "Review Queue" },
    { href: "/hr/filing", label: "HR Filing" },
    { href: "/hr/staff", label: "Staff Directory" },
    { href: "/hr/leave", label: "Leave Management" },
    { href: "/hr/assignments", label: "Assignments" },
    { href: "/hr/analytics", label: "HR Analytics" },
    { href: "/hr/department-kpi", label: "Department KPI" },
    { href: "/hr/officer-performance", label: "Officer Performance" },
    { href: "/hr/reports", label: "HR Reports" },
    { href: "/hr/output", label: "HR Output" },
    { href: "/hr/compliance", label: "Compliance" },
    { href: "/hr/audit", label: "HR Audit" },
    { href: "/hr/settings", label: "HR Settings" },
  ],
  "/reports": [
    { href: "/reports", label: "Reports Centre" },
    { href: "/reports/enterprise-analytics", label: "Analytics" },
  ],
  "/audit-centre": [
    { href: "/audit-centre", label: "Audit Centre" },
  ],
  "/workflow": [
    { href: "/workflow", label: "Workflow Centre" },
  ],
  "/staff": [
    { href: "/staff", label: "Staff Overview" },
    { href: "/staff/requests", label: "My Requests" },
    { href: "/staff/leave", label: "My Leave" },
    { href: "/staff/attendance", label: "Attendance" },
    { href: "/staff/profile", label: "My Profile" },
    { href: "/staff/training", label: "Training" },
    { href: "/staff/performance", label: "Performance" },
    { href: "/staff/notifications", label: "Notifications" },
    { href: "/staff/downloads", label: "Downloads" },
  ],
  "/admin": [
    { href: "/admin", label: "Admin Dashboard" },
    { href: "/admin/users", label: "User Management" },
    { href: "/admin/roles", label: "Roles & Permissions" },
    { href: "/admin/departments", label: "Departments" },
    { href: "/admin/account-routing", label: "Account Routing" },
    { href: "/admin/security", label: "Security Centre" },
    { href: "/admin/settings", label: "System Settings" },
    { href: "/admin/audit", label: "Admin Audit" },
    { href: "/admin/access-audit", label: "Access Audit" },
    { href: "/admin/system-health", label: "System Health" },
    { href: "/admin/release-readiness", label: "Release Readiness" },
    { href: "/admin/workflow-test", label: "Workflow Test" },
  ],
};

const MAIN_NAV = [
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
  const [contextReady, setContextReady] = useState(false);
  const [userName, setUserName] = useState("ReqGen User");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    if (isPublic) {
      setContextReady(false);
      setRoleSet(new Set());
      return;
    }
    let mounted = true;
    async function loadContext() {
      const [context, auth] = await Promise.all([getCurrentAuthContext(), supabase.auth.getUser()]);
      if (!mounted) return;
      const next = new Set<string>();
      if (context?.activeRoleKey) next.add(context.activeRoleKey);
      setRoleSet(next);
      setContextReady(true);
      const user = auth.data.user;
      const metaName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0];
      setUserName(metaName || "ReqGen User");
      setUserEmail(user?.email || "");
    }
    void loadContext();
    const refresh = () => { setContextReady(false); void loadContext(); };
    window.addEventListener("reqgen-active-role-changed", refresh);
    return () => { mounted = false; window.removeEventListener("reqgen-active-role-changed", refresh); };
  }, [isPublic]);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setQuery("");
    const parent = Object.keys(MODULE_SUBNAV).find((href) => pathname === href || pathname.startsWith(`${href}/`));
    setExpandedNav(parent || null);
  }, [pathname]);

  const visibleNav = useMemo(
    () => contextReady ? MAIN_NAV.filter((item) => canAccessPath(item.href, roleSet)) : [],
    [contextReady, roleSet]
  );

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !contextReady) return [];
    return NAVIGATION_ITEMS
      .filter((item) => canAccessPath(item.href, roleSet))
      .filter((item) => `${item.label} ${item.description} ${item.section} ${(item.keywords || []).join(" ")}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, contextReady, roleSet]);

  if (isPublic) return <>{children}</>;

  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "RG";
  const moduleKey = pathname.split("/").filter(Boolean)[0] || "dashboard";

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const renderNav = () => visibleNav.map((item) => {
    const Icon = item.icon;
    const active = isActive(pathname, item.href);
    const subnav = (MODULE_SUBNAV[item.href] || []).filter((child) => canAccessPath(child.href, roleSet));
    const expanded = expandedNav === item.href;
    return (
      <div key={item.href} className={`rg-nav-group ${active ? "is-active" : ""}`}>
        <div className={`rg-nav-row ${active ? "is-active" : ""}`}>
          <Link href={item.href} className="rg-nav-link" onClick={() => subnav.length && setExpandedNav(item.href)}>
            <Icon size={18} /><span>{item.label}</span>
          </Link>
          {subnav.length ? (
            <button type="button" className="rg-nav-toggle" aria-label={`${expanded ? "Collapse" : "Expand"} ${item.label}`} onClick={() => setExpandedNav(expanded ? null : item.href)}>
              <ChevronDown size={16} className={expanded ? "is-open" : ""}/>
            </button>
          ) : null}
        </div>
        {subnav.length && expanded ? (
          <div className="rg-subnav">
            {subnav.map((child) => (
              <Link key={child.href} href={child.href} className={pathname === child.href ? "is-active" : ""}>{child.label}</Link>
            ))}
          </div>
        ) : null}
      </div>
    );
  });

  return (
    <div className="rg-shell">
      <button className={`rg-backdrop ${mobileOpen ? "is-open" : ""}`} onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
      <aside className={`rg-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <div className="rg-brand">
          <Link href="/dashboard" className="rg-brand-mark" aria-label="ReqGen 1.1.0 dashboard">
            <span className="rg-brand-logo"><Image src="/be-logo.png" alt="Barderian Enterprises" width={38} height={32} priority /></span>
            <span className="rg-brand-copy"><strong>ReqGen 1.1.0</strong><small>Request Management System</small></span>
          </Link>
          <button className="rg-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={19}/></button>
        </div>

        <nav className="rg-nav" aria-label="ReqGen modules">{renderNav()}</nav>

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
            <button className="rg-search-trigger" onClick={() => setSearchOpen((v) => !v)}>
              <Search size={16}/><span>Search requests, transactions, documents...</span>
            </button>
            {searchOpen ? (
              <div className="rg-search-popover">
                <div className="rg-search-input"><Search size={17}/><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search authorised ReqGen pages..."/></div>
                <div className="rg-search-results">
                  {query && searchResults.length === 0 ? <p>No authorised result found.</p> : null}
                  {searchResults.map((item) => <Link key={item.href} href={item.href}><strong>{item.label}</strong><span>{item.section} · {item.description}</span></Link>)}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rg-top-actions">
            <Link href="/staff/notifications" className="rg-icon-btn rg-bell" aria-label="Notifications"><Bell size={19}/><b>3</b></Link>
            <Link href="/dashboard/activity" className="rg-icon-btn" aria-label="Activity and messages"><MessageSquare size={19}/></Link>
            <ActiveRoleSwitcher compact />
            <Link href="/profile" className="rg-profile">
              <div className="rg-avatar">{initials}</div>
              <div><strong>{userName}</strong><span>Authorised user</span></div>
            </Link>
          </div>
        </header>

        <main id="reqgen-main-content" className="rg-main" role="main">
          <div className={`rg-content module-${moduleKey}`}>{children}</div>
          <StaffFooter />
        </main>
      </section>
    </div>
  );
}
