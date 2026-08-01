"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type NavItem = {
  href: string;
  label: string;
  description: string;
  tone: string;
  icon: React.ReactNode;
};

const iconClass = "h-5 w-5 shrink-0";

const items: NavItem[] = [
  { href: "/admin", label: "ADMIN DASHBOARD", description: "System overview", tone: "from-slate-700 to-slate-900", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/></svg> },
  { href: "/admin/users", label: "USER MANAGEMENT", description: "Accounts and access", tone: "from-blue-600 to-blue-800", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg> },
  { href: "/admin/roles", label: "ROLES & PERMISSIONS", description: "Authority control", tone: "from-violet-600 to-violet-800", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg> },
  { href: "/admin/departments", label: "DEPARTMENTS", description: "Structure and leadership", tone: "from-emerald-600 to-emerald-800", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18"/><path d="M6 21V8l6-4 6 4v13"/><path d="M9 12h6M9 16h6"/></svg> },
  { href: "/admin/account-routing", label: "ACCOUNT ROUTING", description: "Department finance routing", tone: "from-cyan-600 to-cyan-800", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="2"/><circle cx="16" cy="17" r="2"/></svg> },
  { href: "/admin/security", label: "SECURITY CENTRE", description: "MFA and controls", tone: "from-rose-600 to-rose-800", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg> },
  { href: "/admin/settings", label: "SYSTEM SETTINGS", description: "Global configuration", tone: "from-amber-500 to-orange-700", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.34.33.54.78.6 1.25H21v4h-.1A1.7 1.7 0 0 0 19.4 15Z"/></svg> },
  { href: "/admin/audit", label: "ADMIN AUDIT", description: "Changes and role switches", tone: "from-fuchsia-600 to-purple-800", icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
];

function normalizeRole(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9:]+/g, "");
}

function roleFromRpc(value: unknown) {
  if (typeof value === "string") return normalizeRole(value);
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return normalizeRole(row.active_role_key ?? row.role_key ?? row.role);
  }
  return "";
}

export default function AdminNavigation() {
  const pathname = usePathname();
  const [activeRole, setActiveRole] = useState("");

  const loadRole = useCallback(async () => {
    const { data } = await supabase.rpc("get_my_active_role");
    setActiveRole(roleFromRpc(data));
  }, []);

  useEffect(() => {
    void loadRole();
    const refresh = () => void loadRole();
    window.addEventListener("reqgen-active-role-changed", refresh);
    return () => window.removeEventListener("reqgen-active-role-changed", refresh);
  }, [loadRole]);

  const visibleItems = useMemo(() => {
    if (activeRole === "admin") return items;
    if (activeRole === "auditor") {
      return items.filter((item) => ["/admin/security", "/admin/audit"].includes(item.href));
    }
    return [];
  }, [activeRole]);

  if (visibleItems.length === 0) return null;

  return (
    <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {visibleItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/"));
          return (
            <Link key={item.href} href={item.href} className={`group flex min-h-16 items-center gap-3 rounded-2xl bg-gradient-to-r ${item.tone} px-4 py-3 font-black text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-200 ${active ? "ring-4 ring-sky-200" : ""}`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">{item.icon}</span>
              <span className="min-w-0"><span className="block text-xs font-black tracking-wide">{item.label}</span><span className="mt-0.5 block truncate text-[11px] font-bold text-white/80">{item.description}</span></span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
