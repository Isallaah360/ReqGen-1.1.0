"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FileText, ShieldCheck, Landmark, CreditCard, Archive, Users,
  BarChart3, Workflow, UserRound, Settings, Search, Bell, Menu, X, LogOut,
  ChevronRight, CircleHelp, MessageSquare, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { NAVIGATION_ITEMS } from "@/lib/navigation";
import { canAccessPath } from "@/lib/permissions";
import { getCurrentAuthContext } from "@/lib/auth";
import { ActiveRoleBadge } from "./ActiveRoleSwitcher";
import StaffFooter from "./staff/StaffFooter";

const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/forgot-password", "/reset-password", "/mfa", "/mfa/setup", "/unauthorized", "/about"]);

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
  const [collapsed, setCollapsed] = useState(false);
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
    return () => { mounted = false; window.removeEventListener("reqgen-active-role-changed", refresh); };
  }, [isPublic, pathname]);

  useEffect(() => { setMobileOpen(false); setSearchOpen(false); setQuery(""); }, [pathname]);

  const accessiblePrimary = useMemo(() => PRIMARY_NAV.filter((item) => roleSet.size === 0 || canAccessPath(item.href, roleSet)), [roleSet]);
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

  return (
    <div className={`mock-shell ${collapsed ? "is-collapsed" : ""}`}>
      <button className="mock-mobile-backdrop" data-open={mobileOpen ? "true" : "false"} onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
      <aside className={`mock-sidebar ${mobileOpen ? "is-open" : ""}`} aria-label="Primary navigation">
        <div className="mock-brand">
          <Image src="/iet-logo.png" alt="Islamic Education Trust" width={58} height={58} className="mock-brand-logo" priority />
          <div className="mock-brand-copy"><strong>ReqGen</strong><span>Request Management System</span></div>
          <button className="mock-collapse" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <ChevronsRight size={18}/> : <ChevronsLeft size={18}/>}</button>
          <button className="mock-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20}/></button>
        </div>

        <nav className="mock-nav">
          {accessiblePrimary.map((item) => {
            const Icon = item.icon; const active = isActive(pathname, item.href);
            return <Link key={item.href} href={item.href} className={`mock-nav-link ${active ? "is-active" : ""}`}><Icon size={18}/><span>{item.label}</span><ChevronRight size={14} className="mock-nav-chevron"/></Link>;
          })}
        </nav>

        <div className="mock-nav-secondary">
          <b>QUICK LINKS</b>
          <Link href="/profile"><UserRound size={17}/><span>My Profile</span></Link>
          <Link href="/staff/notifications"><Bell size={17}/><span>Notifications</span><i>8</i></Link>
          <Link href="/about"><CircleHelp size={17}/><span>Help & Support</span></Link>
          <Link href="/admin/settings"><Settings size={17}/><span>Settings</span></Link>
        </div>

        <div className="mock-sidebar-user">
          <div className="mock-avatar">{initials}</div>
          <div className="mock-sidebar-user-copy"><strong>{userName}</strong><span>{userEmail || "Authorised user"}</span></div>
          <button onClick={signOut} aria-label="Log out" data-tip="Sign out securely from ReqGen."><LogOut size={17}/></button>
        </div>
      </aside>

      <div className="mock-stage">
        <header className="mock-topbar">
          <button className="mock-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={21}/></button>
          <div className="mock-search-wrap">
            <button className="mock-search-trigger" onClick={() => setSearchOpen((v) => !v)}><Search size={17}/><span>Search requests, transactions, documents...</span></button>
            {searchOpen && <div className="mock-search-popover"><div className="mock-search-input-wrap"><Search size={17}/><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search authorised ReqGen pages..."/></div><div className="mock-search-results">{query && searchResults.length === 0 ? <p>No authorised result found.</p> : null}{searchResults.map((item) => <Link key={item.href} href={item.href}><strong>{item.label}</strong><span>{item.section} · {item.description}</span></Link>)}</div></div>}
          </div>
          <div className="mock-topbar-actions">
            <Link href="/staff/notifications" className="mock-icon-button" aria-label="Notifications"><Bell size={19}/><b>8</b></Link>
            <Link href="/staff/notifications" className="mock-icon-button" aria-label="Messages"><MessageSquare size={19}/><b>3</b></Link>
            <div className="mock-role"><ActiveRoleBadge/></div>
            <div className="mock-topbar-profile"><div className="mock-avatar">{initials}</div><div><strong>{userName}</strong><span>Administrator</span></div></div>
          </div>
        </header>

        <main id="reqgen-main-content" className="mock-main" role="main">
          <div className="mock-content">{children}</div>
          <StaffFooter />
        </main>
      </div>
    </div>
  );
}
