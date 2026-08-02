"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  ExternalLink,
  RotateCcw,
  Send,
  ShieldCheck,
  TimerReset,
  Workflow,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { HRNavigation } from "@/app/components/hr";
import {
  HRAlert,
  HRBadge,
  HRButton,
  HREmpty,
  HRHero,
  HRPageShell,
  HRPanel,
  HRRefreshButton,
  HRStatCard,
  formatDate,
  pretty,
} from "@/app/components/hr/HREnterprisePage";

type FunctionalAssignment = {
  id: string;
  section_key: string;
  permission_key: string;
  is_active: boolean;
  created_at?: string | null;
};
type RequestSummary = { request_no?: string | null; title?: string | null; current_stage?: string | null; status?: string | null };
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
  officer_recommendation: string | null;
  instructions?: string | null;
  requests?: RequestSummary | null;
};

const sectionRoutes: Record<string, string> = {
  filing: "/hr/filing",
  leave: "/hr/leave",
  staff_filing: "/hr/staff",
  registrar: "/hr/registrar",
  archive: "/hr/archive",
  weekly_seminar: "/hr/weekly-seminar",
  staff_capacity_building: "/hr/capacity-building/staff",
  department_capacity_building: "/hr/capacity-building/departments",
  department_kpi: "/hr/department-kpi",
  annual_360_assessment: "/hr/assessments/annual-360",
};

const tabs = ["all", "assigned", "in_progress", "returned", "submitted", "approved", "completed"] as const;
type WorkTab = (typeof tabs)[number];
const closed = new Set(["completed", "approved"]);

export default function HRMyWorkPage() {
  const [functions, setFunctions] = useState<FunctionalAssignment[]>([]);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [active, setActive] = useState<WorkTab>("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [recommendations, setRecommendations] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setMessage(authError?.message || "Your session could not be verified.");
      setLoading(false);
      return;
    }

    const [functionsResult, tasksResult] = await Promise.all([
      supabase.from("hr_officer_assignments").select("id,section_key,permission_key,is_active,created_at").eq("officer_id", authData.user.id).eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("hr_request_assignments").select("id,request_id,section_key,status,priority,due_at,assigned_at,submitted_at,boss_comment,officer_recommendation,instructions,requests(request_no,title,current_stage,status)").eq("officer_id", authData.user.id).order("assigned_at", { ascending: false }),
    ]);

    setFunctions((functionsResult.data || []) as FunctionalAssignment[]);
    setItems((tasksResult.data || []) as unknown as WorkItem[]);
    setRecommendations(Object.fromEntries(((tasksResult.data || []) as unknown as WorkItem[]).map((item) => [item.id, item.officer_recommendation || ""])));
    setMessage(functionsResult.error?.message || tasksResult.error?.message || "");
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const channel = supabase.channel("hr-my-work-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "hr_request_assignments" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "hr_officer_assignments" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesTab = active === "all" || item.status === active;
      const text = [item.requests?.request_no, item.requests?.title, item.section_key, item.status, item.priority, item.instructions, item.requests?.current_stage].filter(Boolean).join(" ").toLowerCase();
      return matchesTab && (!needle || text.includes(needle));
    });
  }, [items, active, query]);

  const overdue = items.filter((item) => item.due_at && !closed.has(item.status) && new Date(item.due_at).getTime() < Date.now()).length;

  async function updateStatus(item: WorkItem, status: string) {
    setUpdatingId(item.id);
    setMessage("");
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status, updated_at: now };
    if (status === "in_progress") patch.started_at = now;
    if (status === "submitted") {
      patch.submitted_at = now;
      patch.officer_recommendation = recommendations[item.id]?.trim() || null;
    }
    const { error } = await supabase.from("hr_request_assignments").update(patch).eq("id", item.id);
    setUpdatingId(null);
    setMessage(error?.message || (status === "submitted" ? "Work submitted to HR Boss for review." : "Assignment status updated."));
    if (!error) await load();
  }

  return (
    <HRPageShell>
      <HRHero
        eyebrow="Assigned HR Officer Workspace"
        title="My HR Work"
        description="Your enterprise HR authority profile and delegated case queue. Functional assignments show what you are permitted to do; delegated requests show the individual work requiring action."
        icon={BriefcaseBusiness}
        tone="cyan"
        action={<HRRefreshButton onClick={() => void load()} loading={loading} />}
      />
      <HRNavigation />
      {message ? <HRAlert message={message} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HRStatCard label="Assigned Functions" value={functions.length} note="Active HR domains and permission levels" icon={ShieldCheck} tone="blue" />
        <HRStatCard label="Delegated Cases" value={items.length} note="Specific requests assigned to your account" icon={Workflow} tone="cyan" />
        <HRStatCard label="In Progress" value={items.filter((item) => item.status === "in_progress").length} note="Cases you have started processing" icon={Clock3} tone="amber" />
        <HRStatCard label="Overdue" value={overdue} note="Open assignments past their due date" icon={TimerReset} tone={overdue ? "rose" : "emerald"} />
      </section>

      <HRPanel title="My Assigned HR Functions" eyebrow="Functional Authority">
        {functions.length === 0 ? (
          <HREmpty title="No active HR function assigned" description="Ask the HR Boss to grant an HR section and permission level from Officer Assignments." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {functions.map((item) => (
              <article key={item.id} className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-blue-700">HR Function</p><h3 className="mt-2 text-lg font-black text-slate-950">{pretty(item.section_key)}</h3></div><HRBadge value="active" tone="emerald" /></div>
                <div className="mt-4 flex items-center justify-between gap-3"><HRBadge value={item.permission_key} tone="violet" /><Link href={sectionRoutes[item.section_key] || "/hr"} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-xs font-black text-white"><ExternalLink className="h-4 w-4" />Open Function</Link></div>
              </article>
            ))}
          </div>
        )}
      </HRPanel>

      <HRPanel
        title="Delegated Request Queue"
        eyebrow="Actionable Case Work"
        action={<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search request, function or status..." className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-cyan-500" />}
      >
        <div className="mb-5 flex flex-wrap gap-2">
          {tabs.map((tab) => <button key={tab} onClick={() => setActive(tab)} className={`rounded-xl px-4 py-2 text-xs font-black ${active === tab ? "bg-cyan-700 text-white shadow-md" : "bg-slate-100 text-slate-700"}`}>{pretty(tab)} ({tab === "all" ? items.length : items.filter((item) => item.status === tab).length})</button>)}
        </div>

        {loading ? <p className="py-12 text-center font-bold text-slate-500">Loading your HR work...</p> : shown.length === 0 ? (
          <HREmpty title="No delegated request matches this view" description="Functional permissions are already shown above. A request appears here only when the HR Boss delegates a specific case to you." />
        ) : (
          <div className="grid gap-4">
            {shown.map((item) => {
              const late = Boolean(item.due_at && !closed.has(item.status) && new Date(item.due_at).getTime() < Date.now());
              return (
                <article key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:bg-white hover:shadow-lg">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-2"><HRBadge value={item.status} tone={item.status === "returned" ? "rose" : item.status === "completed" ? "emerald" : "blue"} /><HRBadge value={item.priority} tone={item.priority === "critical" ? "rose" : item.priority === "high" ? "amber" : "slate"} />{late ? <HRBadge value="overdue" tone="rose" /> : null}</div>
                      <h3 className="mt-3 text-xl font-black text-slate-950">{item.requests?.request_no || item.request_id} · {item.requests?.title || "Untitled request"}</h3>
                      <p className="mt-2 text-sm font-semibold text-slate-500">Function: {pretty(item.section_key)} · Stage: {pretty(item.requests?.current_stage)} · Due: {formatDate(item.due_at)}</p>
                      {item.instructions ? <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-blue-900"><strong>Instructions:</strong> {item.instructions}</p> : null}
                      {item.boss_comment ? <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-900"><strong>HR Boss feedback:</strong> {item.boss_comment}</p> : null}
                      <textarea value={recommendations[item.id] || ""} onChange={(event) => setRecommendations((current) => ({ ...current, [item.id]: event.target.value }))} rows={3} className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold" placeholder="Enter your assessment, recommendation or filing note..." />
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 xl:w-52 xl:flex-col">
                      <Link href={`/requests/${item.request_id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white"><ExternalLink className="h-4 w-4" />Open Request</Link>
                      {item.status === "assigned" || item.status === "returned" ? <HRButton onClick={() => void updateStatus(item, "in_progress")} disabled={updatingId === item.id} tone="amber"><RotateCcw className="h-4 w-4" />Start Work</HRButton> : null}
                      {item.status === "in_progress" ? <HRButton onClick={() => void updateStatus(item, "submitted")} disabled={updatingId === item.id} tone="emerald"><Send className="h-4 w-4" />Submit to HR Boss</HRButton> : null}
                      {item.status === "approved" || item.status === "completed" ? <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-black text-emerald-800"><CheckCircle2 className="h-4 w-4" />Reviewed</div> : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </HRPanel>
    </HRPageShell>
  );
}
