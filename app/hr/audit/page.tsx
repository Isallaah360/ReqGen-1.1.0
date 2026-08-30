"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  BriefcaseBusiness,
  FileClock,
  Search,
  ShieldCheck,
  UserRound,
  Workflow,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { HRAccessGuard, HRNavigation } from "@/app/components/hr";
import {
  HRAlert,
  HRBadge,
  HREmpty,
  HRHero,
  HRPageShell,
  HRPanel,
  HRRefreshButton,
  HRStatCard,
  formatDateTime,
  pretty,
} from "@/app/components/hr/HREnterprisePage";

type AuditEvent = {
  id: string;
  source: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  actorRole: string | null;
  details: Record<string, unknown>;
  createdAt: string;
  risk: "normal" | "attention" | "critical";
};
type Profile = { id: string; full_name: string | null; email: string | null };
type Row = Record<string, unknown>;

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((row): row is Row => Boolean(row) && typeof row === "object") : [];
}
function text(value: unknown, fallback = "") { return typeof value === "string" && value.trim() ? value : fallback; }
function riskFor(action: string, details: Record<string, unknown>): AuditEvent["risk"] {
  const haystack = `${action} ${JSON.stringify(details)}`.toLowerCase();
  if (["delete", "missing", "revoke", "suspend", "reject"].some((word) => haystack.includes(word))) return "critical";
  if (["return", "archive", "restore", "transfer", "hold", "correction"].some((word) => haystack.includes(word))) return "attention";
  return "normal";
}

const HR_AUDIT_NOW = Date.now();

export default function HRAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState("");
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("all");
  const [risk, setRisk] = useState("all");
  const [date, setDate] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setWarning("");
    const sources = await Promise.all([
      supabase.from("hr_assignment_history").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("hr_request_reviews").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("hr_staff_file_movements").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("hr_request_assignments").select("*").order("assigned_at", { ascending: false }).limit(500),
      supabase.from("hr_officer_assignments").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("id,full_name,email"),
    ]);

    const [historyResult, reviewResult, movementResult, requestAssignmentResult, authorityResult, profileResult] = sources;
    setProfiles((profileResult.data || []) as Profile[]);
    const next: AuditEvent[] = [];

    asRows(historyResult.data).forEach((row) => {
      const action = text(row.action, "hr_activity");
      const details = (row.details && typeof row.details === "object" ? row.details : {}) as Record<string, unknown>;
      next.push({ id: `history-${text(row.id, crypto.randomUUID())}`, source: "HR Activity", module: text(row.entity_type, "HR"), action, entityType: text(row.entity_type, "record"), entityId: text(row.entity_id) || null, actorId: text(row.actor_id) || null, actorRole: text(row.actor_role) || null, details, createdAt: text(row.created_at, new Date().toISOString()), risk: riskFor(action, details) });
    });
    asRows(reviewResult.data).forEach((row) => {
      const action = `request_${text(row.decision, "reviewed")}`;
      const details = { comment: row.comment, officer_id: row.officer_id, assignment_id: row.assignment_id };
      next.push({ id: `review-${text(row.id, crypto.randomUUID())}`, source: "HR Review", module: "Request Review", action, entityType: "request", entityId: text(row.request_id) || null, actorId: text(row.reviewed_by) || null, actorRole: "HR Boss", details, createdAt: text(row.created_at, text(row.reviewed_at, new Date().toISOString())), risk: riskFor(action, details) });
    });
    asRows(movementResult.data).forEach((row) => {
      const action = text(row.movement_type, "file_movement");
      const details = { from_location: row.from_location, to_location: row.to_location, purpose: row.purpose, remarks: row.remarks, expected_return_at: row.expected_return_at, returned_at: row.returned_at };
      next.push({ id: `movement-${text(row.id, crypto.randomUUID())}`, source: "File Movement", module: "Registrar", action, entityType: "staff_file", entityId: text(row.staff_file_id) || null, actorId: text(row.created_by, text(row.actor_id)) || null, actorRole: "Registrar", details, createdAt: text(row.created_at, new Date().toISOString()), risk: riskFor(action, details) });
    });
    asRows(requestAssignmentResult.data).forEach((row) => {
      const action = `case_${text(row.status, "assigned")}`;
      const details = { section_key: row.section_key, priority: row.priority, due_at: row.due_at, instructions: row.instructions, boss_comment: row.boss_comment, recommendation: row.officer_recommendation };
      next.push({ id: `case-${text(row.id, crypto.randomUUID())}`, source: "Case Delegation", module: "HR Work", action, entityType: "request_assignment", entityId: text(row.request_id) || null, actorId: text(row.officer_id) || null, actorRole: "HR Officer", details, createdAt: text(row.updated_at, text(row.assigned_at, new Date().toISOString())), risk: riskFor(action, details) });
    });
    asRows(authorityResult.data).forEach((row) => {
      const action = row.is_active === false ? "authority_suspended" : "authority_active";
      const details = { section_key: row.section_key, permission_key: row.permission_key, assigned_by: row.assigned_by };
      next.push({ id: `authority-${text(row.id, crypto.randomUUID())}`, source: "Authority Register", module: "HR Security", action, entityType: "officer_authority", entityId: text(row.id) || null, actorId: text(row.officer_id) || null, actorRole: "HR Officer", details, createdAt: text(row.updated_at, text(row.created_at, new Date().toISOString())), risk: riskFor(action, details) });
    });

    setEvents(next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    const failed = [historyResult, reviewResult, movementResult, requestAssignmentResult, authorityResult].filter((result) => result.error).length;
    if (failed) setWarning(`${failed} optional HR audit source(s) could not be read under the current database policy. Available evidence is displayed.`);
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  useEffect(() => {
    const channel = supabase.channel("hr-enterprise-audit-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "hr_assignment_history" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "hr_request_reviews" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "hr_staff_file_movements" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "hr_request_assignments" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const names = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile.full_name || profile.email || profile.id])), [profiles]);
  const modules = useMemo(() => Array.from(new Set(events.map((event) => event.module))).sort(), [events]);
  const filtered = useMemo(() => events.filter((event) => {
    const created = new Date(event.createdAt);
    const today = new Date(HR_AUDIT_NOW);
    const dateMatch = date === "all" || (date === "today" && created.toDateString() === today.toDateString()) || (date === "7days" && created.getTime() >= HR_AUDIT_NOW - 7 * 86400000) || (date === "30days" && created.getTime() >= HR_AUDIT_NOW - 30 * 86400000);
    const textValue = [event.action, event.module, event.entityType, event.entityId, event.actorRole, names.get(event.actorId || ""), JSON.stringify(event.details)].join(" ").toLowerCase();
    return (module === "all" || event.module === module) && (risk === "all" || event.risk === risk) && dateMatch && (!search || textValue.includes(search.toLowerCase()));
  }), [events, module, risk, date, search, names]);

  return (
    <HRAccessGuard bossOnly auditorAllowed>
      <HRPageShell>
        <HRHero eyebrow="Immutable HR Accountability" title="HR Audit & Compliance Centre" description="A live institutional evidence trail showing who granted authority, delegated work, reviewed requests, moved personnel files, archived records or changed HR operational status." icon={ShieldCheck} tone="slate" action={<HRRefreshButton onClick={() => void load()} loading={loading} />} />
        <HRNavigation />
        {warning ? <HRAlert message={warning} /> : null}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <HRStatCard label="Audit Evidence" value={events.length} note="Consolidated HR events currently available" icon={Activity} tone="slate" />
          <HRStatCard label="Today" value={events.filter((event) => new Date(event.createdAt).toDateString() === new Date().toDateString()).length} note="Events recorded during the current day" icon={Workflow} tone="cyan" />
          <HRStatCard label="Actors" value={new Set(events.map((event) => event.actorId).filter(Boolean)).size} note="Distinct users represented in HR evidence" icon={UserRound} tone="violet" />
          <HRStatCard label="Critical Events" value={events.filter((event) => event.risk === "critical").length} note="Deletion, missing-file, rejection or suspension events" icon={FileClock} tone="rose" />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl bg-gradient-to-br from-blue-700 to-indigo-900 p-5 text-white shadow-lg"><BriefcaseBusiness className="h-7 w-7" /><p className="mt-4 text-xs font-black uppercase tracking-wider text-white/70">Authority & Delegation</p><p className="mt-2 text-3xl font-black">{events.filter((event) => ["HR Security", "HR Work"].includes(event.module)).length}</p><p className="mt-2 text-sm font-semibold text-white/75">Officer permissions and delegated case activity</p></article>
          <article className="rounded-3xl bg-gradient-to-br from-violet-600 to-purple-900 p-5 text-white shadow-lg"><Archive className="h-7 w-7" /><p className="mt-4 text-xs font-black uppercase tracking-wider text-white/70">File Governance</p><p className="mt-2 text-3xl font-black">{events.filter((event) => event.module === "Registrar").length}</p><p className="mt-2 text-sm font-semibold text-white/75">Custody, transfer, archive and restoration evidence</p></article>
          <article className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-900 p-5 text-white shadow-lg"><ShieldCheck className="h-7 w-7" /><p className="mt-4 text-xs font-black uppercase tracking-wider text-white/70">Compliance Coverage</p><p className="mt-2 text-3xl font-black">{new Set(events.map((event) => event.source)).size}</p><p className="mt-2 text-sm font-semibold text-white/75">Connected HR evidence sources</p></article>
        </section>

        <HRPanel title="HR Activity Evidence Register" eyebrow="Who Did What, Where and When" action={<div className="grid gap-2 sm:grid-cols-4"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users, actions or records..." className="min-h-11 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm font-semibold" /></div><select value={module} onChange={(event) => setModule(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold"><option value="all">All modules</option>{modules.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={risk} onChange={(event) => setRisk(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold"><option value="all">All risk levels</option><option value="normal">Normal</option><option value="attention">Attention</option><option value="critical">Critical</option></select><select value={date} onChange={(event) => setDate(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold"><option value="all">All dates</option><option value="today">Today</option><option value="7days">Last 7 days</option><option value="30days">Last 30 days</option></select></div>}>
          {loading ? <p className="py-12 text-center font-bold text-slate-500">Loading HR audit evidence...</p> : filtered.length === 0 ? <HREmpty title="No audit event matches the selected filters" /> : (
            <div className="grid gap-3">
              {filtered.map((event) => <article key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white hover:shadow-md"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0"><div className="flex flex-wrap gap-2"><HRBadge value={event.action} tone={event.risk === "critical" ? "rose" : event.risk === "attention" ? "amber" : "blue"} /><HRBadge value={event.module} tone="violet" /><HRBadge value={event.source} tone="slate" /></div><h3 className="mt-3 font-black text-slate-950">{names.get(event.actorId || "") || "System / Unresolved Actor"}</h3><p className="mt-1 text-sm font-semibold text-slate-500">{formatDateTime(event.createdAt)} · {pretty(event.actorRole)} · {pretty(event.entityType)} {event.entityId || "Not linked"}</p></div><details className="w-full max-w-2xl rounded-xl bg-slate-950 p-3 text-xs text-slate-200"><summary className="cursor-pointer font-black text-white">View before/after and supporting details</summary><pre className="mt-3 whitespace-pre-wrap break-words">{JSON.stringify(event.details, null, 2)}</pre></details></div></article>)}
            </div>
          )}
        </HRPanel>
      </HRPageShell>
    </HRAccessGuard>
  );
}
