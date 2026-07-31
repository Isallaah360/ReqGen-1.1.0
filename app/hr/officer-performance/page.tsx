"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import HRAccessGuard from "@/app/components/hr/HRAccessGuard";
import { DataTable, MetricBar } from "@/app/components/hr/HRAnalyticsUI";
import { PrimaryButton, SectionCard, StatCard, StrategicHero, StrategicNavigation, StrategicShell } from "@/app/components/hr/HRStrategicUI";

type Assignment = { id: string; officer_id: string; status: string; priority: string; assigned_at: string; due_at: string | null; completed_at: string | null };
type Profile = { id: string; full_name: string | null; email: string | null };

export default function HROfficerPerformancePage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]); const [profiles, setProfiles] = useState<Profile[]>([]); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); const [a, p] = await Promise.all([supabase.from("hr_request_assignments").select("id,officer_id,status,priority,assigned_at,due_at,completed_at").order("assigned_at", { ascending: false }), supabase.from("profiles").select("id,full_name,email")]); setAssignments((a.data || []) as Assignment[]); setProfiles((p.data || []) as Profile[]); setLoading(false); }, []);
  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => profiles.map((profile) => { const mine = assignments.filter((item) => item.officer_id === profile.id); const completed = mine.filter((item) => ["completed", "approved"].includes(item.status)).length; const pending = mine.filter((item) => !["completed", "approved", "cancelled"].includes(item.status)).length; const returned = mine.filter((item) => item.status === "returned").length; const overdue = mine.filter((item) => item.due_at && new Date(item.due_at) < new Date() && !["completed", "approved"].includes(item.status)).length; return { profile, total: mine.length, completed, pending, returned, overdue, completionRate: mine.length ? (completed / mine.length) * 100 : 0 }; }).filter((item) => item.total > 0).sort((a, b) => b.total - a.total), [assignments, profiles]);
  const totals = useMemo(() => ({ officers: rows.length, assigned: assignments.length, completed: assignments.filter((item) => ["completed", "approved"].includes(item.status)).length, overdue: rows.reduce((sum, item) => sum + item.overdue, 0) }), [assignments, rows]);
  return <HRAccessGuard bossOnly><StrategicShell><StrategicHero eyebrow="HR Governance" title="HR Officer Performance & Workload" description="Monitor assignments, completion, returned work and overdue workload to support fair task distribution and timely HR service delivery." action={<PrimaryButton tone="cyan" onClick={() => void load()}>Refresh Workload</PrimaryButton>} /><StrategicNavigation />
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Active Officers" value={loading ? "—" : totals.officers} note="Officers with recorded assignments" tone="blue" /><StatCard label="Total Assignments" value={loading ? "—" : totals.assigned} note="All delegated HR tasks" tone="violet" /><StatCard label="Completed" value={loading ? "—" : totals.completed} note="Approved or completed work" tone="emerald" /><StatCard label="Overdue" value={loading ? "—" : totals.overdue} note="Assignments past deadline" tone="rose" /></section>
    <SectionCard title="Officer Workload Register" eyebrow="Workload Balance"><DataTable headers={["Officer", "Assigned", "Completed", "Pending", "Returned", "Overdue", "Completion"]}>{rows.map((row) => <tr key={row.profile.id} className="hover:bg-slate-50"><td className="px-4 py-4"><p className="font-black text-slate-950">{row.profile.full_name || "Unnamed officer"}</p><p className="text-xs font-semibold text-slate-500">{row.profile.email || "No email"}</p></td><td className="px-4 py-4 font-black">{row.total}</td><td className="px-4 py-4 font-black text-emerald-700">{row.completed}</td><td className="px-4 py-4 font-black text-blue-700">{row.pending}</td><td className="px-4 py-4 font-black text-amber-700">{row.returned}</td><td className="px-4 py-4 font-black text-rose-700">{row.overdue}</td><td className="min-w-52 px-4 py-4"><MetricBar label={`${row.completionRate.toFixed(0)}%`} value={row.completionRate} maximum={100} /></td></tr>)}</DataTable></SectionCard>
  </StrategicShell></HRAccessGuard>;
}
