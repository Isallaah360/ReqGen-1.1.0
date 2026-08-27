"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  PauseCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { HRAccessGuard, HRNavigation } from "@/app/components/hr";
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

type Officer = { id: string; full_name: string | null; email: string | null; role: string | null };
type FunctionalAssignment = {
  id: string;
  officer_id: string;
  section_key: string;
  permission_key: string;
  is_active: boolean;
  created_at?: string | null;
};
type RequestAssignment = {
  id: string;
  request_id: string;
  officer_id: string;
  section_key: string;
  status: string;
  priority: string;
  due_at: string | null;
  instructions: string | null;
  assigned_at?: string | null;
  requests?: {
    request_no?: string | null;
    title?: string | null;
    current_stage?: string | null;
    status?: string | null;
  } | null;
};
type RequestRow = {
  id: string;
  request_no: string | null;
  title: string | null;
  current_stage: string | null;
  status: string | null;
  request_type?: string | null;
  personal_category?: string | null;
};
type SummaryCard = { title: string; value: number; icon: LucideIcon; tone: "blue" | "cyan" | "emerald" | "amber" | "rose" | "violet" | "slate"; note: string };

const sections = [
  ["filing", "HR Filing & Personal Requests", "/hr/filing"],
  ["leave", "Leave Management", "/hr/leave"],
  ["staff_filing", "Staff Files", "/hr/staff"],
  ["registrar", "Registrar Centre", "/hr/registrar"],
  ["archive", "HR Archive", "/hr/archive"],
  ["weekly_seminar", "Wednesday Weekly Seminar", "/hr/weekly-seminar"],
  ["staff_capacity_building", "Staff Capacity Building", "/hr/capacity-building/staff"],
  ["department_capacity_building", "Department Capacity Building", "/hr/capacity-building/departments"],
  ["department_kpi", "Department KPI", "/hr/department-kpi"],
  ["annual_360_assessment", "Annual Staff 360° Assessment", "/hr/assessments/annual-360"],
] as const;

const permissions = [
  ["view", "View Only"],
  ["process", "Process Records"],
  ["recommend", "Make Recommendation"],
  ["submit_to_hr_boss", "Submit to HR Boss"],
  ["file", "Complete Filing"],
  ["archive", "Archive Records"],
  ["manage", "Full Section Management"],
] as const;

const priorities = ["low", "normal", "high", "critical"] as const;

export default function HRAssignmentsPage() {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [functionalAssignments, setFunctionalAssignments] = useState<FunctionalAssignment[]>([]);
  const [requestAssignments, setRequestAssignments] = useState<RequestAssignment[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [officerId, setOfficerId] = useState("");
  const [section, setSection] = useState("filing");
  const [permission, setPermission] = useState("process");
  const [requestId, setRequestId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [dueAt, setDueAt] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const [profilesResult, functionalResult, taskResult, requestResult] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,role").order("full_name"),
      supabase.from("hr_officer_assignments").select("id,officer_id,section_key,permission_key,is_active,created_at").order("created_at", { ascending: false }),
      supabase.from("hr_request_assignments").select("id,request_id,officer_id,section_key,status,priority,due_at,instructions,assigned_at,requests(request_no,title,current_stage,status)").order("assigned_at", { ascending: false }).limit(300),
      supabase.from("requests").select("id,request_no,title,current_stage,status,request_type,personal_category").order("created_at", { ascending: false }).limit(300),
    ]);

    setOfficers((profilesResult.data || []) as Officer[]);
    setFunctionalAssignments((functionalResult.data || []) as FunctionalAssignment[]);
    setRequestAssignments((taskResult.data || []) as unknown as RequestAssignment[]);
    setRequests((requestResult.data || []) as RequestRow[]);
    setMessage(
      profilesResult.error?.message ||
        functionalResult.error?.message ||
        taskResult.error?.message ||
        requestResult.error?.message ||
        ""
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const names = useMemo(
    () => new Map(officers.map((officer) => [officer.id, officer.full_name || officer.email || officer.id])),
    [officers]
  );
  const activeAuthorities = functionalAssignments.filter((item) => item.is_active);
  const summary: SummaryCard[] = [
    {
      title: "Assigned Officers",
      value: new Set(activeAuthorities.map((item) => item.officer_id)).size,
      icon: Users,
      tone: "blue",
      note: "Distinct officers holding an active HR authority",
    },
    {
      title: "Active Authorities",
      value: activeAuthorities.length,
      icon: ShieldCheck,
      tone: "emerald",
      note: "Section and permission combinations currently enabled",
    },
    {
      title: "Delegated Requests",
      value: requestAssignments.filter((item) => !["completed", "approved"].includes(item.status)).length,
      icon: ClipboardList,
      tone: "violet",
      note: "Live case assignments visible in officers’ My Work queues",
    },
    {
      title: "Suspended",
      value: functionalAssignments.filter((item) => !item.is_active).length,
      icon: PauseCircle,
      tone: "amber",
      note: "Authorities retained for history but currently inactive",
    },
  ];

  async function assignAuthority() {
    if (!officerId) return;
    setBusy(true);
    setMessage("");
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("hr_officer_assignments").upsert(
      {
        officer_id: officerId,
        section_key: section,
        permission_key: permission,
        is_active: true,
        assigned_by: auth.user?.id,
      },
      { onConflict: "officer_id,section_key,permission_key" }
    );
    setBusy(false);
    setMessage(error ? error.message : "HR authority assigned successfully. The officer can now see this function in My HR Work.");
    if (!error) await load();
  }

  async function delegateRequest() {
    if (!officerId || !requestId) return;
    setBusy(true);
    setMessage("");
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("hr_request_assignments").upsert(
      {
        request_id: requestId,
        officer_id: officerId,
        section_key: section,
        status: "assigned",
        priority,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        instructions: instructions.trim() || null,
        assigned_by: auth.user?.id,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: "request_id,officer_id,section_key" }
    );
    setBusy(false);
    setMessage(error ? error.message : "Request delegated successfully and added to the officer’s My HR Work queue.");
    if (!error) {
      setRequestId("");
      setDueAt("");
      setInstructions("");
      await load();
    }
  }

  async function toggleAuthority(item: FunctionalAssignment) {
    const { error } = await supabase
      .from("hr_officer_assignments")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    setMessage(error ? error.message : item.is_active ? "Authority suspended." : "Authority restored.");
    if (!error) await load();
  }

  return (
    <HRAccessGuard bossOnly>
      <HRPageShell>
        <HRHero
          eyebrow="HR Authority Model"
          title="Officer Assignment & Delegation Centre"
          description="Grant functional HR authority, assign precise permission levels and delegate individual HR cases. Functional authority appears immediately in My HR Work; request delegation creates an actionable case queue."
          icon={BriefcaseBusiness}
          tone="violet"
          action={<HRRefreshButton onClick={() => void load()} loading={loading} />}
        />

        <HRNavigation />
        {message ? <HRAlert message={message} /> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((card) => (
            <HRStatCard key={card.title} label={card.title} value={card.value} note={card.note} icon={card.icon} tone={card.tone} />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <HRPanel title="Grant Functional Authority" eyebrow="Role Assignment">
            <div className="grid gap-4">
              <label>
                <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">HR Officer</span>
                <select value={officerId} onChange={(event) => setOfficerId(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-bold outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100">
                  <option value="">Select officer</option>
                  {officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name || officer.email}</option>)}
                </select>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">HR Function</span>
                  <select value={section} onChange={(event) => setSection(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-bold outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100">
                    {sections.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Permission Level</span>
                  <select value={permission} onChange={(event) => setPermission(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-bold outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100">
                    {permissions.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                  </select>
                </label>
              </div>
              <HRButton onClick={() => void assignAuthority()} disabled={busy || !officerId} tone="violet">
                <ShieldCheck className="h-4 w-4" /> {busy ? "Saving..." : "Assign Authority"}
              </HRButton>
            </div>
          </HRPanel>

          <HRPanel title="Delegate a Specific HR Request" eyebrow="Case Assignment">
            <div className="grid gap-4">
              <label>
                <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Request</span>
                <select value={requestId} onChange={(event) => setRequestId(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                  <option value="">Select HR request</option>
                  {requests.map((request) => <option key={request.id} value={request.id}>{request.request_no || "Request"} · {request.title || "Untitled"} · {request.current_stage || request.status}</option>)}
                </select>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Priority</span>
                  <select value={priority} onChange={(event) => setPriority(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-bold">
                    {priorities.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Due Date & Time</span>
                  <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-bold" />
                </label>
              </div>
              <label>
                <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Officer Instructions</span>
                <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold" placeholder="State the expected review, filing or recommendation work..." />
              </label>
              <HRButton onClick={() => void delegateRequest()} disabled={busy || !officerId || !requestId} tone="blue">
                <Send className="h-4 w-4" /> {busy ? "Delegating..." : "Delegate to My HR Work"}
              </HRButton>
            </div>
          </HRPanel>
        </section>

        <HRPanel title="Functional Authority Register" eyebrow="Permissions">
          {functionalAssignments.length === 0 ? <HREmpty title="No HR authority assigned" /> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {functionalAssignments.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{names.get(item.officer_id) || item.officer_id}</p>
                      <p className="mt-1 text-sm font-bold text-blue-700">{pretty(item.section_key)}</p>
                    </div>
                    <HRBadge value={item.is_active ? "active" : "suspended"} tone={item.is_active ? "emerald" : "amber"} />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <HRBadge value={item.permission_key} tone="violet" />
                    <button onClick={() => void toggleAuthority(item)} className={`rounded-xl px-3 py-2 text-xs font-black text-white ${item.is_active ? "bg-amber-600" : "bg-emerald-600"}`}>
                      {item.is_active ? "Suspend" : "Restore"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </HRPanel>

        <HRPanel title="Delegated Request Register" eyebrow="My Work Feed">
          {requestAssignments.length === 0 ? <HREmpty title="No request has been delegated" description="Use the case assignment form above to create actionable work in an officer’s My HR Work queue." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950 text-white"><tr><th className="p-4">Request</th><th className="p-4">Officer</th><th className="p-4">Function</th><th className="p-4">Priority</th><th className="p-4">Status</th><th className="p-4">Due</th></tr></thead>
                <tbody>
                  {requestAssignments.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100 align-top">
                      <td className="p-4"><p className="font-black text-slate-950">{item.requests?.request_no || item.request_id}</p><p className="mt-1 text-slate-600">{item.requests?.title || "Untitled request"}</p></td>
                      <td className="p-4 font-bold">{names.get(item.officer_id) || item.officer_id}</td>
                      <td className="p-4">{pretty(item.section_key)}</td>
                      <td className="p-4"><HRBadge value={item.priority} tone={item.priority === "critical" ? "rose" : item.priority === "high" ? "amber" : "blue"} /></td>
                      <td className="p-4"><HRBadge value={item.status} tone="violet" /></td>
                      <td className="p-4">{formatDate(item.due_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </HRPanel>
      </HRPageShell>
    </HRAccessGuard>
  );
}
