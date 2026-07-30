"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export type HRRequest = {
  id: string;
  request_no: string;
  title: string;
  details: string;
  amount: number | null;
  status: string | null;
  current_stage: string | null;
  created_at: string;
  requester_name: string | null;
  checked_by_name: string | null;
  hr_name: string | null;
  dg_name: string | null;
  account_name: string | null;
  dept_id: string | null;
  dept_name: string | null;
  request_type: string | null;
  personal_category: string | null;
};

type ProfileRole = {
  role_key: string;
  role_name: string;
  is_primary: boolean;
  is_active: boolean;
};

function compact(value: string | null | undefined) {
  return (value || "").trim().toLowerCase().replace(/[\s_]+/g, "");
}

export function stageKey(value: string | null | undefined) {
  return (value || "").trim().toUpperCase().replace(/[\s_]+/g, "");
}

export function categoryKey(value: string | null | undefined) {
  return (value || "").trim().toUpperCase().replace(/[\s_]+/g, "");
}

export function isPersonal(row: HRRequest) {
  return compact(row.request_type) === "personal";
}

export function isCompleted(row: HRRequest) {
  const status = compact(row.status);
  const stage = stageKey(row.current_stage);
  return stage === "COMPLETED" || status.includes("complete") || status.includes("paid") || status.includes("closed");
}

export function isRejected(row: HRRequest) {
  const status = compact(row.status);
  const stage = stageKey(row.current_stage);
  return ["REJECTED", "DELETED", "CANCELLED"].includes(stage) || status.includes("reject") || status.includes("delete") || status.includes("cancel");
}

export function isArchived(row: HRRequest) {
  return isCompleted(row) || isRejected(row);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function categoryLabel(row: HRRequest) {
  const key = categoryKey(row.personal_category);
  if (key === "FUND") return "Personal Fund";
  if (key === "CONTRACTRENEWAL") return "Contract Renewal";
  if (key === "NONFUND" || !key) return "Personal Other";
  return (row.personal_category || "Personal Other").trim();
}

export function stageLabel(value: string | null | undefined) {
  const key = stageKey(value);
  if (key === "HRFILING") return "HR Filing";
  if (key === "ACCOUNT") return "Account Officer";
  if (key === "COMPLETED") return "Completed";
  return value || "—";
}

export function statusTone(row: HRRequest) {
  if (isCompleted(row)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (isRejected(row)) return "border-rose-200 bg-rose-50 text-rose-700";
  if (stageKey(row.current_stage) === "HRFILING") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export function useHRRequests() {
  const router = useRouter();
  const [rows, setRows] = useState<HRRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [roleSummary, setRoleSummary] = useState("Staff");

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setMessage(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    const [profileResult, rolesResult] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
      supabase.from("profile_roles").select("role_key,role_name,is_primary,is_active").eq("profile_id", auth.user.id).eq("is_active", true),
    ]);

    if (profileResult.error) {
      setMessage("Unable to load your HR access profile: " + profileResult.error.message);
      setAllowed(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const fallbackRole = String(profileResult.data?.role || "Staff");
    const activeRoles = ((rolesResult.data || []) as ProfileRole[]).filter((role) => role.is_active);
    const roleKeys = new Set([compact(fallbackRole), ...activeRoles.map((role) => compact(role.role_key))]);
    const canAccess = ["admin", "auditor", "hr", "hrofficer1", "hrofficer2", "hrofficer3"].some((role) => roleKeys.has(role));

    setAllowed(canAccess);
    setRoleSummary(activeRoles.length ? activeRoles.slice().sort((a, b) => Number(b.is_primary) - Number(a.is_primary)).map((role) => role.role_name).join(", ") : fallbackRole);

    if (!canAccess) {
      setMessage("Access denied. This workspace is limited to HR Officers, Admin and Auditor roles.");
      setRows([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data, error } = await supabase.rpc("get_hr_filing_requests");
    if (error) {
      setMessage("Unable to load HR workflow records: " + error.message);
      setRows([]);
    } else {
      setRows(((data || []) as HRRequest[]).filter(isPersonal));
    }

    setLoading(false);
    setRefreshing(false);
  }, [router]);

  useEffect(() => {
    void load(false);
    const onFocus = () => void load(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  return { rows, loading, refreshing, message, allowed, roleSummary, refresh: () => load(true) };
}

export function HRIcon({ name, className = "h-5 w-5" }: { name: "staff" | "leave" | "archive" | "refresh" | "view" | "search" | "dashboard"; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths = {
    staff: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    leave: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>,
    archive: <><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></>,
    refresh: <><path d="M20 11a8.1 8.1 0 1 0 2 5.3"/><path d="M20 4v7h-7"/></>,
    view: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  };
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>{paths[name]}</svg>;
}

export function HRModuleNav() {
  const pathname = usePathname();
  const items = [
    { href: "/hr/filing", label: "HR Overview", icon: "dashboard" as const, tone: "bg-slate-700 hover:bg-slate-800" },
    { href: "/hr-filing/staff", label: "Staff Files", icon: "staff" as const, tone: "bg-blue-600 hover:bg-blue-700" },
    { href: "/hr-filing/leave", label: "Leave Records", icon: "leave" as const, tone: "bg-emerald-600 hover:bg-emerald-700" },
    { href: "/hr-filing/archive", label: "HR Archive", icon: "archive" as const, tone: "bg-violet-600 hover:bg-violet-700" },
  ];

  return <nav className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="HR module navigation">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const active = pathname === item.href;
        return <Link key={item.href} href={item.href} className={`flex min-h-14 items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-200 ${item.tone} ${active ? "ring-4 ring-slate-200" : ""}`}>
          <HRIcon name={item.icon} className="h-6 w-6" />
          {item.label}
        </Link>;
      })}
    </div>
  </nav>;
}

export function HRPageHero({ eyebrow, title, description, icon, roleSummary, refreshing, onRefresh }: { eyebrow: string; title: string; description: string; icon: "staff" | "leave" | "archive"; roleSummary: string; refreshing: boolean; onRefresh: () => void }) {
  return <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-xl md:p-8">
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20"><HRIcon name={icon} className="h-8 w-8" /></div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-blue-100 md:text-base">{description}</p>
          <p className="mt-3 text-xs font-bold text-white/70">Active capacity: <span className="text-white">{roleSummary}</span></p>
        </div>
      </div>
      <button onClick={onRefresh} disabled={refreshing} className="reqgen-btn reqgen-btn-cyan inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-400 disabled:opacity-60">
        <HRIcon name="refresh" className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "Refreshing..." : "Refresh Records"}
      </button>
    </div>
  </section>;
}

export function HRStatCard({ label, value, note, tone = "blue" }: { label: string; value: number | string; note: string; tone?: "blue" | "emerald" | "violet" | "amber" | "rose" | "slate" }) {
  const tones = {
    blue: "from-blue-600 to-indigo-700",
    emerald: "from-emerald-500 to-teal-700",
    violet: "from-violet-600 to-purple-700",
    amber: "from-amber-500 to-orange-600",
    rose: "from-rose-500 to-red-700",
    slate: "from-slate-600 to-slate-800",
  };
  return <div className={`rounded-3xl bg-gradient-to-br ${tones[tone]} p-5 text-white shadow-lg`}>
    <p className="text-xs font-black uppercase tracking-[0.16em] text-white/75">{label}</p>
    <p className="mt-3 text-3xl font-black">{value}</p>
    <p className="mt-2 text-xs font-semibold text-white/75">{note}</p>
  </div>;
}

export function HRAccessState({ loading, allowed, message }: { loading: boolean; allowed: boolean; message: string | null }) {
  if (loading) return <main className="min-h-screen bg-slate-50 px-4"><div className="mx-auto max-w-7xl py-12 font-bold text-slate-600">Loading HR workspace...</div></main>;
  if (allowed) return null;
  return <main className="min-h-screen bg-slate-50 px-4"><div className="mx-auto max-w-3xl py-12"><div className="rounded-3xl border bg-white p-7 shadow-sm"><h1 className="text-2xl font-black text-slate-950">HR Workspace Access</h1><p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{message || "Access denied."}</p><Link href="/dashboard" className="reqgen-btn reqgen-btn-slate mt-5 inline-flex rounded-xl bg-slate-700 px-5 py-3 text-sm font-black text-white shadow-md hover:bg-slate-800">Back to Dashboard</Link></div></div></main>;
}

export function HRRecordTable({ rows, emptyText }: { rows: HRRequest[]; emptyText: string }) {
  return <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-950 text-white"><tr><th className="px-5 py-4 font-black">Reference</th><th className="px-5 py-4 font-black">Staff / Department</th><th className="px-5 py-4 font-black">Category</th><th className="px-5 py-4 font-black">Stage</th><th className="px-5 py-4 font-black">Date</th><th className="px-5 py-4 text-right font-black">Action</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? <tr><td colSpan={6} className="px-6 py-14 text-center font-semibold text-slate-500">{emptyText}</td></tr> : rows.map((row) => <tr key={row.id} className="hover:bg-slate-50">
            <td className="px-5 py-4"><p className="font-black text-slate-950">{row.request_no}</p><p className="mt-1 max-w-xs truncate text-xs font-semibold text-slate-500">{row.title}</p></td>
            <td className="px-5 py-4"><p className="font-bold text-slate-800">{row.requester_name || "—"}</p><p className="mt-1 text-xs text-slate-500">{row.dept_name || "Unassigned Department"}</p></td>
            <td className="px-5 py-4"><span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{categoryLabel(row)}</span></td>
            <td className="px-5 py-4"><span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(row)}`}>{stageLabel(row.current_stage)}</span></td>
            <td className="px-5 py-4 font-semibold text-slate-600">{formatDate(row.created_at)}</td>
            <td className="px-5 py-4 text-right"><Link href={`/requests/${row.id}`} className="reqgen-btn reqgen-btn-blue inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-md hover:bg-blue-700"><HRIcon name="view" className="h-4 w-4" />View Workflow</Link></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}

export function HRSearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="relative block"><span className="sr-only">Search</span><HRIcon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"/><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>;
}

export function useFilteredRows(rows: HRRequest[], search: string) {
  return useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => [row.request_no, row.title, row.requester_name, row.dept_name, row.personal_category, row.status, row.current_stage].join(" ").toLowerCase().includes(query));
  }, [rows, search]);
}
