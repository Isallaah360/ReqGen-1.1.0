"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ProfileNavigation from "@/app/components/profile/ProfileNavigation";
import { ActiveRoleSwitcher } from "@/app/components/ActiveRoleSwitcher";

type RoleRow = { role_key: string | null; role_name?: string | null; is_active: boolean | null; created_at?: string | null };
type AssignmentRow = { id: string; section_key: string; permission_level: string | null; is_active: boolean | null; assigned_at?: string | null };

export default function ProfileAccessPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profileRole, setProfileRole] = useState("");
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { router.push("/login"); return; }
      const [profileRes, rolesRes, assignmentsRes] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", authData.user.id).maybeSingle(),
        supabase.from("profile_roles").select("role_key,role_name,is_active,created_at").eq("profile_id", authData.user.id).order("created_at", { ascending: false }),
        supabase.from("hr_officer_assignments").select("id,section_key,permission_level,is_active,assigned_at").eq("officer_id", authData.user.id).order("assigned_at", { ascending: false }),
      ]);
      if (profileRes.error) throw profileRes.error;
      setProfileRole(profileRes.data?.role || "Staff");
      setRoles((rolesRes.data || []) as RoleRow[]);
      setAssignments(assignmentsRes.error ? [] : ((assignmentsRes.data || []) as AssignmentRow[]));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load access assignments."); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  const activeRoles = useMemo(() => roles.filter((r) => r.is_active !== false), [roles]);

  return <main data-rmb-page="profile" className="min-h-screen bg-slate-50 px-4 py-8"><div className="mx-auto max-w-6xl">
    
    <ProfileNavigation />
    {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div>}
    <section className="mt-6 grid gap-4 md:grid-cols-3"><Summary label="Primary Role" value={loading ? "…" : profileRole} /><Summary label="Active Assigned Roles" value={loading ? "…" : String(activeRoles.length)} /><Summary label="Active HR Assignments" value={loading ? "…" : String(assignments.filter((a) => a.is_active !== false).length)} /></section>
    <section className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">Assigned ReqGen Roles</h2><div className="mt-4 space-y-3">{activeRoles.length ? activeRoles.map((role, index) => <div key={`${role.role_key}-${index}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4"><div><p className="font-black text-slate-950">{role.role_name || role.role_key || "Unnamed role"}</p><p className="text-xs font-bold text-slate-500">{role.role_key || "No key"}</p></div><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">Active</span></div>) : <Empty text="No additional active roles were found." />}</div></div>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">HR Functional Assignments</h2><div className="mt-4 space-y-3">{assignments.length ? assignments.map((a) => <div key={a.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><p className="font-black capitalize text-slate-950">{a.section_key.replace(/_/g, " ")}</p><span className={`rounded-full px-3 py-1 text-xs font-black ${a.is_active !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{a.is_active !== false ? "Active" : "Inactive"}</span></div><p className="mt-2 text-sm font-bold text-slate-600">Permission: {a.permission_level || "View"}</p></div>) : <Empty text="No HR functional assignments were found." />}</div></div>
    </section>
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">Switch Current Working Role</h2><p className="mt-2 text-sm font-semibold text-slate-600">Only roles genuinely assigned to your account are available.</p><div className="mt-4"><ActiveRoleSwitcher /></div></section>
  </div></main>;
}
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">{label}</p><p className="mt-3 text-2xl font-black text-violet-950">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-bold text-slate-500">{text}</div>; }
