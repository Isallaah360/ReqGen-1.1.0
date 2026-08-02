"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type NavItem = {
  href: string;
  label: string;
  description: string;
};

const items: NavItem[] = [
  { href: "/admin", label: "Admin Dashboard", description: "System overview" },
  { href: "/admin/users", label: "User Management", description: "Accounts and access" },
  { href: "/admin/roles", label: "Roles & Permissions", description: "Authority control" },
  { href: "/admin/departments", label: "Departments", description: "Structure and leadership" },
  { href: "/admin/account-routing", label: "Account Routing", description: "Department routing" },
  { href: "/admin/security", label: "Security Centre", description: "MFA and controls" },
  { href: "/admin/settings", label: "System Settings", description: "Global configuration" },
  { href: "/admin/audit", label: "Admin Audit", description: "Changes and role switches" },
];

function normalizeRole(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9:]+/g, "");
}

function roleFromRpc(value: unknown): string {
  if (typeof value === "string") return normalizeRole(value);
  if (Array.isArray(value)) return roleFromRpc(value[0]);
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return normalizeRole(
      row.active_role_key ??
        row.role_key ??
        row.role ??
        row.get_my_active_role ??
        row.reqgen_current_active_role
    );
  }
  return "";
}

export default function AdminNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [activeRole, setActiveRole] = useState("");

  const loadRole = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const { data } = await supabase.rpc("get_my_active_role");
    let role = roleFromRpc(data);

    if (!role) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .maybeSingle();
      role = normalizeRole(profile?.role);
    }

    setActiveRole(role);
  }, []);

  useEffect(() => {
    void loadRole();
  }, [loadRole]);

  const visibleItems = useMemo(() => {
    if (activeRole === "auditor") {
      return items.filter((item) =>
        ["/admin/security", "/admin/audit"].includes(item.href)
      );
    }
    return items;
  }, [activeRole]);

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <section className="no-print mx-auto w-full max-w-5xl rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-lg shadow-slate-200/40 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">
            Administration Menu
          </p>
          <p className="mt-1 text-xs font-bold text-slate-500">
            Simple numbered access to the eight Administration workspaces.
          </p>
        </div>
        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={() => router.push("/admin/access-audit")}
            className="reqgen-btn reqgen-btn-cyan rounded-xl px-3 py-2 text-xs font-black text-white"
          >
            Access Audit
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/workflow-test")}
            className="reqgen-btn reqgen-btn-emerald rounded-xl px-3 py-2 text-xs font-black text-white"
          >
            Workflow Test
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/release-readiness")}
            className="reqgen-btn reqgen-btn-blue rounded-xl px-3 py-2 text-xs font-black text-white"
          >
            Release Readiness
          </button>
          <button
            type="button"
            onClick={() => router.push("/audit-centre")}
            className="reqgen-btn reqgen-btn-violet rounded-xl px-3 py-2 text-xs font-black text-white"
          >
            Enterprise Audit
          </button>
        </div>
      </div>

      <nav className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {visibleItems.map((item, index) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex min-h-[64px] items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-200 ${
                active
                  ? "border-blue-600 bg-gradient-to-r from-blue-700 to-cyan-600 text-white shadow-lg"
                  : "border-slate-200 bg-white text-slate-800 shadow-sm hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-black ${
                  active
                    ? "bg-white/20 text-white"
                    : "bg-slate-900 text-white group-hover:bg-blue-700"
                }`}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className={`block text-xs font-black uppercase tracking-wide ${active ? "text-white" : "text-slate-900"}`}>
                  {item.label}
                </span>
                <span className={`mt-0.5 block text-[11px] font-semibold ${active ? "text-blue-100" : "text-slate-500"}`}>
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
