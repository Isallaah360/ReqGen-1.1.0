"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ProfileNavigation from "@/app/components/profile/ProfileNavigation";

type Activity = { id: string; action: string; detail: string; created_at: string; source: string };

export default function ProfileActivityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setWarning(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { router.push("/login"); return; }
      const uid = authData.user.id;
      const [roleHistory, hrHistory] = await Promise.all([
        supabase.from("user_role_switch_history").select("id,previous_role_key,new_role_key,switched_at").eq("user_id", uid).order("switched_at", { ascending: false }).limit(100),
        supabase.from("hr_assignment_history").select("id,action,details,created_at").eq("actor_id", uid).order("created_at", { ascending: false }).limit(100),
      ]);
      const rows: Activity[] = [];
      if (!roleHistory.error) for (const row of roleHistory.data || []) rows.push({ id: `role-${row.id}`, action: "Working role changed", detail: `${row.previous_role_key || "none"} → ${row.new_role_key || "unknown"}`, created_at: row.switched_at, source: "Role Context" });
      if (!hrHistory.error) for (const row of hrHistory.data || []) rows.push({ id: `hr-${row.id}`, action: row.action || "HR activity", detail: typeof row.details === "string" ? row.details : JSON.stringify(row.details || {}), created_at: row.created_at, source: "HR Activity" });
      rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivities(rows);
      if (roleHistory.error && hrHistory.error) setWarning("No personal activity sources are currently available to this account.");
    } catch (caught) { setWarning(caught instanceof Error ? caught.message : "Unable to load activity."); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  const filtered = useMemo(() => activities.filter((a) => `${a.action} ${a.detail} ${a.source}`.toLowerCase().includes(search.toLowerCase())), [activities, search]);

  return <main data-rmb-page="profile" className="min-h-screen bg-slate-50 px-4 py-8"><div className="mx-auto max-w-6xl">
    
    <ProfileNavigation />
    {warning && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 font-bold text-amber-900">{warning}</div>}
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Activity Timeline</p><h2 className="mt-1 text-2xl font-black text-slate-950">{loading ? "Loading…" : `${filtered.length} recorded activities`}</h2></div><div className="flex gap-2"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search my activity" className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" /><button type="button" onClick={() => void load()} className="rounded-xl bg-cyan-700 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-800">Refresh</button></div></div>
      <div className="mt-5 space-y-3">{filtered.length ? filtered.map((a) => <article key={a.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-black text-slate-950">{a.action}</p><p className="mt-1 break-words text-sm font-semibold text-slate-600">{a.detail}</p></div><div className="text-right"><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">{a.source}</span><p className="mt-2 text-xs font-bold text-slate-500">{new Date(a.created_at).toLocaleString()}</p></div></div></article>) : <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center font-bold text-slate-500">No matching activity was found.</div>}</div>
    </section>
  </div></main>;
}
