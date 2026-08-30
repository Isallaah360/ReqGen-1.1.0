"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, Clock3, FileCheck2, Filter, RefreshCw, Search, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { HRAccessGuard, HRNavigation } from "@/app/components/hr";
import { supabase } from "@/lib/supabaseClient";

type HRRequest = {
  id: string;
  request_no: string;
  title: string;
  status: string | null;
  current_stage: string | null;
  created_at: string;
  requester_name: string | null;
  dept_name: string | null;
  request_type: string | null;
  personal_category: string | null;
};

type Queue = "all" | "review" | "filing" | "completed" | "rejected";

type FilingSummaryCard = {
  label: string;
  value: number;
  note: string;
  icon: LucideIcon;
  tone: string;
};

const compact = (value: string | null | undefined) => (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const stage = (value: string | null | undefined) => compact(value).toUpperCase();
const isPersonal = (row: HRRequest) => compact(row.request_type) === "personal";
const isCompleted = (row: HRRequest) => ["completed", "paid", "closed"].some((item) => compact(`${row.status} ${row.current_stage}`).includes(item));
const isRejected = (row: HRRequest) => ["rejected", "cancelled", "deleted"].some((item) => compact(`${row.status} ${row.current_stage}`).includes(item));
const category = (row: HRRequest) => {
  const value = compact(row.personal_category);
  if (value === "fund") return "Personal Fund";
  if (value === "leave") return "Leave";
  if (value === "contractrenewal") return "Contract Renewal";
  if (value === "resignation") return "Resignation";
  return row.personal_category || "Personal Other";
};
const stageLabel = (value: string | null | undefined) => {
  const key = stage(value);
  if (key === "HRFILING") return "HR Filing";
  if (key === "HR") return "HR Review";
  if (key === "DG") return "DG Decision";
  if (key === "ACCOUNT") return "Account Officer";
  if (key === "COMPLETED") return "Completed";
  return value || "Unassigned";
};
const formatDate = (value: string) => new Date(value).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

export default function HRFilingPage() {
  const [rows, setRows] = useState<HRRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState<Queue>("filing");
  const [department, setDepartment] = useState("all");

  const load = useCallback(async (soft = false) => {
    if (soft) { setRefreshing(true); } else { setLoading(true); }
    setMessage(null);
    const { data, error } = await supabase.rpc("get_hr_filing_requests");
    if (error) {
      setRows([]);
      setMessage(`Unable to load HR requests: ${error.message}`);
    } else {
      setRows(((data || []) as HRRequest[]).filter(isPersonal));
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
    const channel = supabase.channel("hr-filing-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => void load(true))
      .subscribe();
    const focus = () => void load(true);
    window.addEventListener("focus", focus);
    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("focus", focus);
    };
  }, [load]);

  const counts = useMemo(() => ({
    all: rows.length,
    review: rows.filter((row) => stage(row.current_stage) === "HR").length,
    filing: rows.filter((row) => stage(row.current_stage) === "HRFILING").length,
    completed: rows.filter(isCompleted).length,
    rejected: rows.filter(isRejected).length,
  }), [rows]);

  const departments = useMemo(() => Array.from(new Set(rows.map((row) => row.dept_name).filter(Boolean) as string[])).sort(), [rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (department !== "all" && row.dept_name !== department) return false;
      if (queue === "review" && stage(row.current_stage) !== "HR") return false;
      if (queue === "filing" && stage(row.current_stage) !== "HRFILING") return false;
      if (queue === "completed" && !isCompleted(row)) return false;
      if (queue === "rejected" && !isRejected(row)) return false;
      if (!term) return true;
      return [row.request_no, row.title, row.requester_name, row.dept_name, row.current_stage, row.status, row.personal_category]
        .join(" ").toLowerCase().includes(term);
    });
  }, [department, query, queue, rows]);

  const tabs: Array<{ key: Queue; label: string; count: number; tone: string }> = [
    { key: "all", label: "All HR Requests", count: counts.all, tone: "from-slate-700 to-slate-900" },
    { key: "review", label: "HR Review", count: counts.review, tone: "from-cyan-600 to-blue-700" },
    { key: "filing", label: "Ready for Filing", count: counts.filing, tone: "from-violet-600 to-purple-700" },
    { key: "completed", label: "Completed", count: counts.completed, tone: "from-emerald-600 to-teal-700" },
    { key: "rejected", label: "Rejected / Closed", count: counts.rejected, tone: "from-rose-600 to-red-700" },
  ];

  const filingSummaryCards: FilingSummaryCard[] = [
    {
      label: "All HR Requests",
      value: counts.all,
      note: "Personal HR workflows",
      icon: Users,
      tone: "from-blue-600 to-indigo-700",
    },
    {
      label: "Initial HR Review",
      value: counts.review,
      note: "Awaiting HR treatment",
      icon: Clock3,
      tone: "from-cyan-500 to-blue-700",
    },
    {
      label: "Ready for Filing",
      value: counts.filing,
      note: "Approved by DG or paid",
      icon: FileCheck2,
      tone: "from-violet-600 to-purple-700",
    },
    {
      label: "Completed",
      value: counts.completed,
      note: "Successfully filed",
      icon: CheckCircle2,
      tone: "from-emerald-600 to-teal-700",
    },
    {
      label: "Archive Signals",
      value: counts.rejected,
      note: "Rejected or closed",
      icon: Archive,
      tone: "from-rose-600 to-red-700",
    },
  ];

  return (
    <HRAccessGuard section="filing" permission="process">
      <main className="rg-module-page rg-adopted-page">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rg-module-header">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">HR Operations</p>
                <h1 className="mt-3 text-3xl font-black lg:text-5xl">HR Filing & Request Processing</h1>
                <p className="mt-4 max-w-3xl font-semibold leading-7 text-indigo-100">Process every HR-related personal request from HR review through DG decision and final filing. Open a record to take the action permitted by its current workflow stage.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/hr" className="rounded-xl bg-white/10 px-5 py-3 text-sm font-black text-white ring-1 ring-white/20 transition hover:bg-white/20">HR Dashboard</Link>
                <button onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-cyan-400 disabled:opacity-60">
                  <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Refreshing..." : "Refresh Records"}
                </button>
              </div>
            </div>
          </section>

          <HRNavigation />

          {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{message}</div> : null}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {filingSummaryCards.map(({ label, value, note, icon: Icon }) => (
              <article
                key={label}
                className="rg-stat-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/75">
                      {label}
                    </p>
                    <p className="mt-3 text-3xl font-black">
                      {loading ? "—" : value}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-white/75">
                      {note}
                    </p>
                  </div>
                  <Icon className="h-7 w-7" />
                </div>
              </article>
            ))}
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {tabs.map((tab) => <button key={tab.key} onClick={() => setQueue(tab.key)} className={`flex min-h-14 items-center justify-between rounded-xl bg-gradient-to-r ${tab.tone} px-4 py-3 text-left text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg ${queue === tab.key ? "ring-4 ring-blue-200" : ""}`}><span>{tab.label}</span><span className="rounded-full bg-white/20 px-2.5 py-1 text-xs">{tab.count}</span></button>)}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[1fr_260px_auto]">
              <label className="relative"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search request number, staff, department or category..." className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
              <label className="relative"><Filter className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><select value={department} onChange={(event) => setDepartment(event.target.value)} className="min-h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"><option value="all">All Departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select></label>
              <button onClick={() => { setQuery(""); setDepartment("all"); setQueue("filing"); }} className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-md hover:bg-cyan-700">Reset</button>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-xl font-black text-slate-950">HR Operational Register</h2><p className="mt-1 text-sm font-semibold text-slate-500">Showing {filtered.length} of {rows.length} records.</p></div>
            {filtered.length === 0 ? <div className="p-12 text-center font-bold text-slate-500">No matching HR request is available.</div> : <div className="divide-y divide-slate-100">{filtered.map((row) => {
              const actionable = ["HR", "HRFILING"].includes(stage(row.current_stage));
              return <article key={row.id} className="p-5 transition hover:bg-slate-50"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-black text-blue-700">{row.request_no}</span><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-200">{category(row)}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${stage(row.current_stage) === "HRFILING" ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200" : "bg-slate-100 text-slate-700"}`}>{stageLabel(row.current_stage)}</span></div><h3 className="mt-2 text-lg font-black text-slate-950">{row.title}</h3><p className="mt-1 text-sm font-semibold text-slate-600">{row.requester_name || "Unknown Staff"} · {row.dept_name || "Unassigned Department"} · {formatDate(row.created_at)}</p></div><Link href={`/requests/${row.id}`} className={`inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 ${actionable ? "bg-gradient-to-r from-violet-700 to-purple-600" : "bg-slate-700 hover:bg-slate-800"}`}>{actionable ? "Open & Process" : "View Record"}</Link></div></article>;
            })}</div>}
          </section>
        </div>
      </main>
    </HRAccessGuard>
  );
}
