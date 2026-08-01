"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const items = [
  ["/admin", "Admin Dashboard"],
  ["/admin/users", "User Management"],
  ["/admin/roles", "Roles & Permissions"],
  ["/admin/departments", "Departments"],
  ["/admin/account-routing", "Account Routing"],
  ["/admin/security", "Security Centre"],
  ["/admin/settings", "System Settings"],
  ["/admin/audit", "Admin Audit"],
] as const;

function normalizeRole(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9:]+/g, "");
}

function extractRole(value: unknown) {
  if (typeof value === "string") return normalizeRole(value);
  if (Array.isArray(value)) return extractRole(value[0]);
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return normalizeRole(row.active_role_key ?? row.role_key ?? row.role ?? row.get_my_active_role);
  }
  return "";
}

export default function AdminNavigation() {
  const pathname = usePathname();
  const [activeRole, setActiveRole] = useState("");

  const loadRole = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_active_role");
    if (!error) setActiveRole(extractRole(data));
  }, []);

  useEffect(() => {
    void loadRole();
    const refresh = () => void loadRole();
    window.addEventListener("reqgen-active-role-changed", refresh);
    return () => window.removeEventListener("reqgen-active-role-changed", refresh);
  }, [loadRole]);

  const visibleItems = useMemo(() => {
    if (activeRole === "admin") return items;
    if (activeRole === "auditor") return items.filter(([href]) => href === "/admin/security" || href === "/admin/audit");
    return [];
  }, [activeRole]);

  if (!visibleItems.length) return null;

  return (
    <nav aria-label="Administration workspace menu" className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-700">Administration Workspace Menu</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">Select a secured administration workspace.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{visibleItems.length} centres</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {visibleItems.map(([href, label], index) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={`group flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-black transition focus:outline-none focus:ring-4 focus:ring-blue-100 ${active ? "border-blue-700 bg-blue-700 text-white shadow-md" : "border-slate-200 bg-slate-50 text-slate-800 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"}`}>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-black ${active ? "bg-white/20 text-white" : "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200 group-hover:ring-blue-200"}`}>{String(index + 1).padStart(2, "0")}</span>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
