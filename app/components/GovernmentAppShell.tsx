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
  MessageSquareText,
  Menu,
  X,
  LogOut,
  ChevronRight,
  ChevronDown,
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
    return () => {
      mounted = false;
      window.removeEventListener("reqgen-active-role-changed", refresh);
    };
  }, [isPublic, pathname]);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setQuery("");
    if (pathname.startsWith("/finance")) setExpandedNav("/finance");
    else if (pathname.startsWith("/requests")) setExpandedNav("/requests");
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
    <div className="gov-shell mock-app-shell">
      <button className="gov-mobile-backdrop" data-open={mobileOpen ? "true" : "false"} onClick={() => setMobileOpen(false)} aria-label="Close navigation" />

      <aside className={`gov-sidebar ${mobileOpen ? "is-open" : ""}`} aria-label="Primary navigation">
        <div className="gov-brand">
          <Image src="/iet-logo.png" alt="Islamic Education Trust" width={58} height={58} className="gov-brand-logo" priority />
          <div><strong>ReqGen</strong><span>Request Management System</span></div>
          <button className="gov-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>

        <nav className="gov-nav">
          {accessiblePrimary.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            const children = MODULE_SUBNAV[item.href] || [];
            const expanded = expandedNav === item.href;
            return (
              <div key={item.href} className={`gov-nav-group ${active ? "is-active" : ""}`}>
                <div className={`gov-nav-link ${active ? "is-active" : ""}`}>
                  <Link href={item.href} className="gov-nav-main-link" onClick={() => children.length && setExpandedNav(item.href)}>
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                  {children.length ? (
                    <button
                      type="button"
                      className="gov-nav-expand"
                      aria-label={`${expanded ? "Collapse" : "Expand"} ${item.label} navigation`}
                      aria-expanded={expanded}
                      onClick={() => setExpandedNav(expanded ? null : item.href)}
                    >
                      <ChevronDown size={14} className={expanded ? "is-open" : ""} aria-hidden="true" />
                    </button>
                  ) : <ChevronRight size={14} className="gov-nav-chevron" aria-hidden="true" />}
                </div>
                {children.length && expanded ? (
                  <div className="gov-subnav" aria-label={`${item.label} pages`}>
                    {children.map((child) => (
                      <Link key={child.href} href={child.href} className={pathname === child.href ? "is-active" : ""}>
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="gov-nav-secondary">
          <span>Quick Links</span>
          <Link href="/profile"><UserRound size={17} />My Profile</Link>
          <Link href="/staff/notifications"><Bell size={17} />Notifications</Link>
          <Link href="/about"><CircleHelp size={17} />Help &amp; Support</Link>
          <Link href="/admin/settings"><Settings size={17} />Settings</Link>
        </div>

        <div className="gov-sidebar-user">
          <div className="gov-avatar">{initials}</div>
          <div className="gov-sidebar-user-copy"><strong>{userName}</strong><span>{userEmail || "Authenticated user"}</span></div>
          <button onClick={signOut} aria-label="Log out" data-tip="Sign out securely from ReqGen."><LogOut size={17} /></button>
        </div>
      </aside>

      <div className="gov-stage">
        <header className="gov-topbar">
          <button className="gov-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>

          <div className="gov-search-wrap">
            <button className="gov-search-trigger" onClick={() => setSearchOpen((value) => !value)}>
              <Search size={16} /><span>Search requests, transactions, documents...</span>
            </button>
            {searchOpen && (
              <div className="gov-search-popover">
                <div className="gov-search-input-wrap"><Search size={17} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search authorised ReqGen pages and functions..." /></div>
                <div className="gov-search-results">
                  {query && searchResults.length === 0 ? <p>No authorised result found.</p> : null}
                  {searchResults.map((item) => (
                    <Link key={item.href} href={item.href}><strong>{item.label}</strong><span>{item.section} · {item.description}</span></Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="gov-topbar-actions">
            <Link href="/staff/notifications" className="gov-icon-button gov-icon-badge" aria-label="Notifications"><Bell size={18} /><b>•</b></Link>
            <Link href="/dashboard/activity" className="gov-icon-button" aria-label="Activity"><MessageSquareText size={18} /></Link>
            <ActiveRoleBadge />
            <div className="gov-topbar-profile">
              <div className="gov-avatar">{initials}</div>
              <div><strong>{userName}</strong><span>Authorised user</span></div>
            </div>
          </div>
        </header>

        <main id="reqgen-main-content" className="gov-main" role="main">
          <div className={`gov-content ${pathname.startsWith("/finance") ? "module-finance" : pathname.startsWith("/requests") ? "module-requests" : ""}`}>{children}</div>
          <StaffFooter />
        </main>
      </div>
    </div>
  );
}
