"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { HRAccessGuard, HRNavigation } from "@/app/components/hr";

type Officer = { id: string; full_name: string | null; email: string | null; role: string | null };
type Assignment = { id: string; officer_id: string; section_key: string; permission_key: string; is_active: boolean };
const sections = ["leave","staff_filing","registrar","archive","weekly_seminar","staff_capacity_building","department_capacity_building","department_kpi","annual_360_assessment"];
const permissions = ["view","process","recommend","submit_to_hr_boss","file","archive","manage"];

export default function HRAssignmentsPage() {
  const [officers,setOfficers]=useState<Officer[]>([]); const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [officerId,setOfficerId]=useState(""); const [section,setSection]=useState(sections[0]); const [permission,setPermission]=useState("process"); const [busy,setBusy]=useState(false);
  async function load(){
    const [{data:p},{data:a}] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,role").order("full_name"),
      supabase.from("hr_officer_assignments").select("id,officer_id,section_key,permission_key,is_active").order("created_at",{ascending:false})
    ]);
    setOfficers((p||[]) as Officer[]); setAssignments((a||[]) as Assignment[]);
  }
  useEffect(()=>{load();},[]);
  const names=useMemo(()=>new Map(officers.map(o=>[o.id,o.full_name||o.email||o.id])),[officers]);
  async function assign(){ if(!officerId)return; setBusy(true); const {data:u}=await supabase.auth.getUser(); await supabase.from("hr_officer_assignments").upsert({officer_id:officerId,section_key:section,permission_key:permission,is_active:true,assigned_by:u.user?.id},{onConflict:"officer_id,section_key,permission_key"}); setBusy(false); load(); }
  async function toggle(item:Assignment){ await supabase.from("hr_officer_assignments").update({is_active:!item.is_active}).eq("id",item.id); load(); }
  return <HRAccessGuard bossOnly><main className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8"><div className="mx-auto max-w-7xl space-y-6"><section className="rounded-[2rem] bg-gradient-to-br from-violet-950 to-indigo-700 p-8 text-white shadow-xl"><p className="text-xs font-black uppercase tracking-[.25em] text-violet-200">HR Boss Control</p><h1 className="mt-3 text-3xl font-black">Officer Assignment Centre</h1><p className="mt-3 max-w-3xl font-semibold text-violet-100">Assign several HR domains and permission levels to the same officer. Every assignment can be suspended or restored independently.</p></section><HRNavigation />
  <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4"><select value={officerId} onChange={e=>setOfficerId(e.target.value)} className="rounded-xl border p-3 font-bold"><option value="">Select officer</option>{officers.map(o=><option key={o.id} value={o.id}>{o.full_name||o.email}</option>)}</select><select value={section} onChange={e=>setSection(e.target.value)} className="rounded-xl border p-3 font-bold">{sections.map(s=><option key={s}>{s}</option>)}</select><select value={permission} onChange={e=>setPermission(e.target.value)} className="rounded-xl border p-3 font-bold">{permissions.map(p=><option key={p}>{p}</option>)}</select><button disabled={busy||!officerId} onClick={assign} className="rounded-xl bg-violet-600 px-5 py-3 font-extrabold text-white disabled:opacity-50">{busy?"Assigning…":"Assign Role"}</button></section>
  <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-950 text-white"><tr><th className="p-4">Officer</th><th className="p-4">HR Section</th><th className="p-4">Permission</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead><tbody>{assignments.map(a=><tr key={a.id} className="border-t"><td className="p-4 font-bold">{names.get(a.officer_id)||a.officer_id}</td><td className="p-4">{a.section_key}</td><td className="p-4">{a.permission_key}</td><td className="p-4"><span className={`rounded-full px-3 py-1 font-bold ${a.is_active?"bg-emerald-100 text-emerald-700":"bg-slate-200 text-slate-600"}`}>{a.is_active?"Active":"Suspended"}</span></td><td className="p-4"><button onClick={()=>toggle(a)} className={`rounded-xl px-4 py-2 font-extrabold text-white ${a.is_active?"bg-red-600":"bg-emerald-600"}`}>{a.is_active?"Suspend":"Restore"}</button></td></tr>)}</tbody></table></div></section>
  </div></main></HRAccessGuard>;
}
