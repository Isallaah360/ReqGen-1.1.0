"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { HRNavigation } from "@/app/components/hr";

type WorkItem = {
  id: string;
  request_id: string;
  section_key: string;
  status: string;
  priority: string;
  due_at: string | null;
  assigned_at: string;
  submitted_at: string | null;
  boss_comment: string | null;
  requests?: { request_no?: string | null; title?: string | null; current_stage?: string | null; status?: string | null } | null;
};

const tabs = ["all", "assigned", "in_progress", "returned", "submitted", "completed"];
const label = (v: string) => v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function HRMyWorkPage() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [active, setActive] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data, error } = await supabase
      .from("hr_request_assignments")
      .select("id,request_id,section_key,status,priority,due_at,assigned_at,submitted_at,boss_comment,requests(request_no,title,current_stage,status)")
      .eq("officer_id", auth.user.id)
      .order("assigned_at", { ascending: false });
    setItems((data || []) as unknown as WorkItem[]);
    setMessage(error?.message || "");
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  const shown = useMemo(() => active === "all" ? items : items.filter((x) => x.status === active), [items, active]);

  async function updateStatus(id: string, status: string) {
    setMessage("");
    const patch: Record<string, unknown> = { status };
    if (status === "in_progress") patch.started_at = new Date().toISOString();
    if (status === "submitted") patch.submitted_at = new Date().toISOString();
    const { error } = await supabase.from("hr_request_assignments").update(patch).eq("id", id);
    if (error) setMessage(error.message); else load();
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8"><div className="mx-auto max-w-7xl space-y-6">
    <section className="rounded-[2rem] bg-gradient-to-br from-cyan-950 via-blue-900 to-indigo-700 p-8 text-white shadow-xl">
      <p className="text-xs font-black uppercase tracking-[.25em] text-cyan-200">Assigned HR Officer Workspace</p>
      <h1 className="mt-3 text-3xl font-black lg:text-5xl">My HR Work</h1>
      <p className="mt-3 max-w-3xl font-semibold text-blue-100">Only work allocated to your account appears here. Submit your completed assessment to the HR Boss for final review.</p>
    </section>
    <HRNavigation />
    <section className="flex flex-wrap gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">{tabs.map((tab) => <button key={tab} onClick={() => setActive(tab)} className={`rounded-2xl px-5 py-3 text-sm font-extrabold text-white shadow-sm ${active === tab ? "bg-slate-950 ring-4 ring-slate-200" : "bg-cyan-600 hover:bg-cyan-700"}`}>{label(tab)} <span className="ml-2 rounded-full bg-white/20 px-2 py-1 text-xs">{tab === "all" ? items.length : items.filter((x) => x.status === tab).length}</span></button>)}</section>
    {message && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{message}</div>}
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-950 text-white"><tr><th className="p-4">Request</th><th className="p-4">Section</th><th className="p-4">Priority</th><th className="p-4">Due</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={6} className="p-8 text-center font-bold text-slate-500">Loading assigned work…</td></tr> : shown.length === 0 ? <tr><td colSpan={6} className="p-8 text-center font-bold text-slate-500">No matching HR assignments.</td></tr> : shown.map((item) => <tr key={item.id} className="border-t align-top"><td className="p-4"><p className="font-black text-slate-950">{item.requests?.request_no || item.request_id}</p><p className="mt-1 max-w-sm text-slate-600">{item.requests?.title || "HR-bound request"}</p>{item.boss_comment && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-bold text-amber-800">HR Boss: {item.boss_comment}</p>}</td><td className="p-4 font-bold">{label(item.section_key)}</td><td className="p-4">{label(item.priority)}</td><td className="p-4">{item.due_at ? new Date(item.due_at).toLocaleDateString() : "—"}</td><td className="p-4"><span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">{label(item.status)}</span></td><td className="p-4"><div className="flex flex-wrap gap-2"><Link href={`/requests/${item.request_id}`} className="rounded-xl bg-blue-700 px-3 py-2 font-extrabold text-white">Open</Link>{["assigned","returned"].includes(item.status) && <button onClick={() => updateStatus(item.id,"in_progress")} className="rounded-xl bg-orange-600 px-3 py-2 font-extrabold text-white">Start</button>}{item.status === "in_progress" && <button onClick={() => updateStatus(item.id,"submitted")} className="rounded-xl bg-violet-600 px-3 py-2 font-extrabold text-white">Submit to HR Boss</button>}</div></td></tr>)}</tbody></table></div></section>
  </div></main>;
}
