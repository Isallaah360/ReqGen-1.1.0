"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ActionButton,
  EmptyState,
  EnterpriseHero,
  EnterpriseShell,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/app/components/enterprise/EnterpriseUI";
import { dateText, normalizeRows, text } from "@/app/components/enterprise/data";

type AuditEvent = {
  id: string;
  module: string;
  action: string;
  actorId: string;
  actor: string;
  activeRole: string;
  record: string;
  createdAt: string;
  details: string;
  severity: "info" | "success" | "warning" | "critical";
};

type SourceDefinition = {
  module: string;
  tables: string[];
  createdFields: string[];
};

type ProfileLite = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const SOURCE_DEFINITIONS: SourceDefinition[] = [
  { module: "Enterprise", tables: ["enterprise_audit_events", "audit_logs"], createdFields: ["created_at", "event_at"] },
  { module: "Requests", tables: ["request_history"], createdFields: ["created_at"] },
  { module: "Approvals", tables: ["request_attachment_checks"], createdFields: ["created_at", "checked_at"] },
  { module: "Finance", tables: ["finance_activity_history", "finance_transactions", "iet_account_transactions"], createdFields: ["created_at", "posted_at", "transaction_date"] },
  { module: "Payment Vouchers", tables: ["manual_payment_voucher_audit", "payment_voucher_history"], createdFields: ["created_at"] },
  { module: "HR", tables: ["hr_assignment_history", "hr_request_reviews", "hr_seminar_attendance_corrections"], createdFields: ["created_at", "reviewed_at", "decided_at"] },
  { module: "Roles", tables: ["user_role_switch_history"], createdFields: ["switched_at", "created_at"] },
  { module: "Registry", tables: ["registry_file_movements", "registry_correspondence"], createdFields: ["created_at", "movement_date"] },
  { module: "Security", tables: ["notifications"], createdFields: ["created_at"] },
];

function normalizeRole(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9:]+/g, "");
}

function parseActiveRole(value: unknown): string {
  if (typeof value === "string") return normalizeRole(value);
  if (Array.isArray(value)) return parseActiveRole(value[0]);
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return normalizeRole(
      row.active_role_key ??
        row.role_key ??
        row.role ??
        row.get_my_active_role ??
        row.reqgen_current_active_role
    );
  }
  return "";
}

function firstText(row: Record<string, unknown>, fields: string[], fallback = "") {
  for (const field of fields) {
    const value = text(row[field]);
    if (value) return value;
  }
  return fallback;
}

function eventSeverity(action: string): AuditEvent["severity"] {
  const key = action.toLowerCase();
  if (/(delete|reject|revoke|disable|suspend|failed|denied|unauthor|missing|reverse)/.test(key)) return "critical";
  if (/(return|late|overdue|warning|correction|change|update)/.test(key)) return "warning";
  if (/(approve|complete|create|assign|activate|verify|paid|success)/.test(key)) return "success";
  return "info";
}

function moduleTone(module: string): "blue" | "violet" | "emerald" | "amber" | "rose" | "slate" {
  if (module === "Finance" || module === "Payment Vouchers") return "emerald";
  if (module === "HR") return "violet";
  if (module === "Roles" || module === "Security") return "rose";
  if (module === "Registry") return "amber";
  if (module === "Requests" || module === "Approvals") return "blue";
  return "slate";
}

export default function AuditCentrePage() {
  const router = useRouter();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("ALL");
  const [period, setPeriod] = useState("30");
  const [severity, setSeverity] = useState("ALL");
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [coverage, setCoverage] = useState<{ available: number; attempted: number }>({ available: 0, attempted: 0 });

  const verifyAccess = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.replace("/login");
      return false;
    }

    const { data: activeRoleData } = await supabase.rpc("get_my_active_role");
    let role = parseActiveRole(activeRoleData);

    if (!role) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
      role = normalizeRole(profile?.role);
    }

    if (!["admin", "auditor"].includes(role)) {
      router.replace("/unauthorized?from=/audit-centre");
      return false;
    }

    setAuthorized(true);
    return true;
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const allowed = await verifyAccess();
      if (!allowed) return;

      const collected: AuditEvent[] = [];
      const actorIds = new Set<string>();
      let available = 0;
      let attempted = 0;

      for (const definition of SOURCE_DEFINITIONS) {
        let loadedThisModule = false;

        for (const table of definition.tables) {
          attempted += 1;
          const result = await supabase.from(table).select("*").limit(500);

          if (result.error) continue;

          loadedThisModule = true;
          available += 1;

          normalizeRows(result.data).forEach((row, index) => {
            const action = firstText(
              row,
              ["action", "event_type", "decision", "activity_type", "transaction_type", "status", "title"],
              "Activity"
            );
            const actorId = firstText(row, [
              "actor_id",
              "user_id",
              "performed_by",
              "changed_by",
              "created_by",
              "reviewed_by",
              "assigned_by",
              "posted_by",
            ]);
            if (actorId) actorIds.add(actorId);

            const detailsValue = row.details;
            const details =
              typeof detailsValue === "object" && detailsValue !== null
                ? JSON.stringify(detailsValue)
                : firstText(row, ["details", "comment", "description", "message", "narration", "reason", "remarks"]);

            collected.push({
              id: firstText(row, ["id"], `${table}-${index}`),
              module: definition.module,
              action,
              actorId,
              actor: firstText(
                row,
                ["actor_name", "user_name", "performed_by_name", "created_by_name", "officer_name", "requester_name"],
                actorId || "System"
              ),
              activeRole: firstText(row, ["active_role_name", "active_role_key", "role_name", "role_key"], "—"),
              record: firstText(
                row,
                ["reference_no", "request_no", "voucher_no", "transaction_no", "entity_id", "request_id", "record_id"],
                "—"
              ),
              createdAt: firstText(row, definition.createdFields, new Date(0).toISOString()),
              details,
              severity: eventSeverity(action),
            });
          });

          break;
        }

        if (!loadedThisModule) {
          // Optional sources are intentionally silent. The dashboard shows coverage instead.
        }
      }

      if (actorIds.size > 0) {
        const ids = [...actorIds].slice(0, 500);
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", ids);

        const profileMap: Record<string, ProfileLite> = {};
        normalizeRows(profileRows).forEach((row) => {
          const id = text(row.id);
          if (!id) return;
          profileMap[id] = {
            id,
            full_name: text(row.full_name) || null,
            email: text(row.email) || null,
          };
        });
        setProfiles(profileMap);

        collected.forEach((event) => {
          const profile = profileMap[event.actorId];
          if (profile && (event.actor === event.actorId || event.actor === "System")) {
            event.actor = profile.full_name || profile.email || event.actorId;
          }
        });
      }

      collected.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setEvents(collected);
      setCoverage({ available, attempted });
    } finally {
      setLoading(false);
    }
  }, [verifyAccess]);

  useEffect(() => {
    void load();

    const channel = supabase
      .channel("enterprise-audit-centre-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "enterprise_audit_events" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "request_history" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_role_switch_history" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "hr_assignment_history" }, () => void load())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const filtered = useMemo(() => {
    const days = Number(period);
    const cutoff = days > 0 ? Date.now() - days * 86400000 : 0;
    const needle = query.trim().toLowerCase();

    return events.filter((event) => {
      if (source !== "ALL" && event.module !== source) return false;
      if (severity !== "ALL" && event.severity !== severity) return false;
      if (cutoff && new Date(event.createdAt).getTime() < cutoff) return false;
      if (!needle) return true;

      return [
        event.module,
        event.action,
        event.actor,
        event.activeRole,
        event.record,
        event.details,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [events, period, query, severity, source]);

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return events.filter((event) => new Date(event.createdAt).toDateString() === today).length;
  }, [events]);

  const uniqueActors = useMemo(
    () => new Set(events.map((event) => event.actorId || event.actor).filter(Boolean)).size,
    [events]
  );

  const criticalCount = useMemo(
    () => events.filter((event) => event.severity === "critical").length,
    [events]
  );

  const roleSwitches = useMemo(
    () => events.filter((event) => event.module === "Roles").length,
    [events]
  );

  const moduleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((event) => counts.set(event.module, (counts.get(event.module) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);

  if (!authorized && loading) {
    return (
      <EnterpriseShell>
        <div className="mx-auto max-w-[1500px]">
          <EmptyState title="Verifying audit authority" description="ReqGen is validating your active Admin or Auditor role." />
        </div>
      </EnterpriseShell>
    );
  }

  return (
    <EnterpriseShell>
      <div className="mx-auto max-w-[1500px] space-y-4">
        <EnterpriseHero
          eyebrow="Audit Centre"
          title="Audit Centre Overview"
          description="Central hub for audit activities, controls, risk visibility and assurance evidence across authorised ReqGen records."
          actions={
            <>
              <ActionButton tone="cyan" onClick={() => void load()}>
                {loading ? "Refreshing..." : "Refresh Live Audit"}
              </ActionButton>
              <Link
                href="/admin/audit"
                className="reqgen-btn reqgen-btn-violet rounded-xl px-4 py-2 text-sm font-black text-white"
              >
                Admin Audit
              </Link>
            </>
          }
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard label="All Activities" value={loading ? "—" : events.length} note="Loaded audit evidence" tone="violet" />
          <StatCard label="Today" value={loading ? "—" : todayCount} note="Actions recorded today" tone="blue" />
          <StatCard label="Users Seen" value={loading ? "—" : uniqueActors} note="Distinct actors" tone="emerald" />
          <StatCard label="Modules" value={loading ? "—" : moduleCounts.length} note="Activity-producing areas" tone="cyan" />
          <StatCard label="Critical Events" value={loading ? "—" : criticalCount} note="High-risk actions" tone="rose" />
          <StatCard label="Role Switches" value={loading ? "—" : roleSwitches} note="Working-role changes" tone="amber" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
          <SectionCard title="Live Activity Intelligence" eyebrow="Who did what">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {moduleCounts.slice(0, 8).map(([module, count]) => (
                <div key={module} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <StatusBadge tone={moduleTone(module)}>{module}</StatusBadge>
                    <span className="text-2xl font-black text-slate-950">{count}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500"
                      style={{ width: `${Math.max(8, (count / Math.max(events.length, 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Audit Coverage" eyebrow="Source health">
            <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-5">
              <div className="text-4xl font-black text-blue-950">
                {coverage.attempted ? Math.round((coverage.available / coverage.attempted) * 100) : 0}%
              </div>
              <p className="mt-2 text-sm font-bold text-blue-900">
                {coverage.available} live sources connected from {coverage.attempted} checked sources.
              </p>
              <p className="mt-3 text-xs font-semibold leading-5 text-blue-700">
                Optional tables that do not exist are skipped silently, preventing false Roles or Finance error notices.
              </p>
            </div>
          </SectionCard>
        </section>

        <SectionCard title="Activity Register" eyebrow="Chronological evidence">
          <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_210px_190px_190px]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search user, action, role, record or details..."
              className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
            <select value={source} onChange={(event) => setSource(event.target.value)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold">
              <option value="ALL">All Modules</option>
              {moduleCounts.map(([module]) => <option key={module} value={module}>{module}</option>)}
            </select>
            <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold">
              <option value="ALL">All Risk Levels</option>
              <option value="info">Information</option>
              <option value="success">Successful</option>
              <option value="warning">Attention</option>
              <option value="critical">Critical</option>
            </select>
            <select value={period} onChange={(event) => setPeriod(event.target.value)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold">
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="365">Last Year</option>
              <option value="0">All Time</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title={loading ? "Loading audit activities" : "No audit activity found"}
              description="Activities matching your authorized filters will appear here."
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 lg:block">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      {["Time", "Module", "Action", "User / Active Role", "Record", "Details"].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filtered.map((event) => (
                      <tr key={`${event.module}-${event.id}-${event.createdAt}`} className="align-top transition hover:bg-blue-50/60">
                        <td className="whitespace-nowrap px-4 py-4 text-xs font-black text-slate-600">{dateText(event.createdAt)}</td>
                        <td className="px-4 py-4"><StatusBadge tone={moduleTone(event.module)}>{event.module}</StatusBadge></td>
                        <td className="px-4 py-4">
                          <div className="font-black text-slate-950">{event.action}</div>
                          <div className="mt-1 text-xs font-bold uppercase text-slate-400">{event.severity}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-black text-slate-900">{event.actor}</div>
                          <div className="mt-1 text-xs font-semibold text-slate-500">Acting as: {event.activeRole}</div>
                        </td>
                        <td className="max-w-[220px] break-words px-4 py-4 text-sm font-bold text-slate-700">{event.record}</td>
                        <td className="max-w-[420px] break-words px-4 py-4 text-sm font-semibold leading-6 text-slate-600">{event.details || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 lg:hidden">
                {filtered.map((event) => (
                  <article key={`${event.module}-${event.id}-${event.createdAt}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge tone={moduleTone(event.module)}>{event.module}</StatusBadge>
                      <span className="text-xs font-black text-slate-500">{dateText(event.createdAt)}</span>
                    </div>
                    <h3 className="mt-3 text-base font-black text-slate-950">{event.action}</h3>
                    <div className="mt-3 grid gap-2 text-sm">
                      <p><span className="font-black text-slate-700">User:</span> <span className="font-semibold text-slate-600">{event.actor}</span></p>
                      <p><span className="font-black text-slate-700">Active role:</span> <span className="font-semibold text-slate-600">{event.activeRole}</span></p>
                      <p className="break-words"><span className="font-black text-slate-700">Record:</span> <span className="font-semibold text-slate-600">{event.record}</span></p>
                      {event.details ? <p className="break-words leading-6 text-slate-600">{event.details}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </SectionCard>
      </div>
    </EnterpriseShell>
  );
}
