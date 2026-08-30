"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DataTable } from "@/app/components/hr/HRAnalyticsUI";
import {
  PrimaryButton,
  SectionCard,
  StatCard,
  StrategicHero,
  StrategicNavigation,
  StrategicShell,
} from "@/app/components/hr/HRStrategicUI";

type EventRow = {
  id: string;
  source: string;
  action: string;
  actor: string;
  details: string;
  created_at: string;
};

type RawRow = Record<string, unknown>;

type ComplianceResult = {
  source: string;
  rows: RawRow[];
};

function normalizeRows(value: unknown): RawRow[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is RawRow =>
      typeof item === "object" && item !== null && !Array.isArray(item)
  );
}

export default function HRCompliancePage() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);

    const sources = [
      [
        "HR Assignment",
        "hr_assignment_history",
        "id,action,actor_id,details,created_at",
        "created_at",
      ],
      [
        "Role Switch",
        "user_role_switch_history",
        "id,user_id,new_role_key,previous_role_key,switched_at",
        "switched_at",
      ],
      [
        "Seminar Correction",
        "hr_seminar_attendance_corrections",
        "id,decision,correction_reason,created_at",
        "created_at",
      ],
      [
        "KPI Review",
        "hr_kpi_reviews",
        "id,status,comment,created_at",
        "created_at",
      ],
    ] as const;

    try {
      const result: ComplianceResult[] = await Promise.all(
        sources.map(async ([source, table, select, orderColumn]) => {
          const response = await supabase
            .from(table)
            .select(select)
            .order(orderColumn, { ascending: false })
            .limit(100);

          if (response.error) {
            console.warn(`Unable to load ${table}:`, response.error.message);
          }

          return {
            source,
            rows: normalizeRows(response.data),
          };
        })
      );

      const events: EventRow[] = [];

      for (const resultItem of result) {
        for (const item of resultItem.rows) {
          events.push({
            id: String(item.id ?? crypto.randomUUID()),
            source: resultItem.source,
            action: String(
              item.action ??
                item.decision ??
                item.status ??
                item.new_role_key ??
                "Recorded action"
            ),
            actor: String(item.actor_id ?? item.user_id ?? "System"),
            details: String(
              item.details ??
                item.correction_reason ??
                item.comment ??
                (item.previous_role_key
                  ? `${String(item.previous_role_key)} → ${String(
                      item.new_role_key ?? ""
                    )}`
                  : "No additional details")
            ),
            created_at: String(item.created_at ?? item.switched_at ?? ""),
          });
        }
      }

      events.sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );

      setRows(events);
    } catch (error) {
      console.error("Unable to load HR compliance events:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  const filtered = rows.filter((row) =>
    `${row.source} ${row.action} ${row.details}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <>
      <StrategicShell>
        <StrategicHero
          eyebrow="HR Audit & Compliance"
          title="HR Compliance Centre"
          description="A consolidated, searchable chronology of HR assignments, role switches, attendance corrections, KPI reviews and sensitive governance actions."
          action={
            <PrimaryButton tone="cyan" onClick={() => void load()}>
              Refresh Audit
            </PrimaryButton>
          }
        />

        <StrategicNavigation />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Audit Events"
            value={loading ? "—" : rows.length}
            note="Combined HR governance evidence"
            tone="blue"
          />
          <StatCard
            label="Assignment Actions"
            value={
              rows.filter((row) => row.source === "HR Assignment").length
            }
            note="Delegation and review history"
            tone="violet"
          />
          <StatCard
            label="Role Switches"
            value={rows.filter((row) => row.source === "Role Switch").length}
            note="Active-role context changes"
            tone="cyan"
          />
          <StatCard
            label="Corrections & Reviews"
            value={
              rows.filter((row) =>
                ["Seminar Correction", "KPI Review"].includes(row.source)
              ).length
            }
            note="Controlled amendments and moderation"
            tone="amber"
          />
        </section>

        <SectionCard
          title="Compliance Timeline"
          eyebrow="Immutable Evidence"
          action={
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search audit events"
              className="rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-blue-600"
            />
          }
        >
          <DataTable headers={["Date", "Source", "Action", "Actor", "Details"]}>
            {filtered.map((row) => (
              <tr key={`${row.source}-${row.id}`} className="hover:bg-slate-50">
                <td className="px-4 py-4 text-xs font-bold text-slate-600">
                  {row.created_at
                    ? new Date(row.created_at).toLocaleString("en-NG")
                    : "—"}
                </td>
                <td className="px-4 py-4 font-black text-blue-800">
                  {row.source}
                </td>
                <td className="px-4 py-4 font-black text-slate-900">
                  {row.action}
                </td>
                <td className="px-4 py-4 text-xs font-semibold text-slate-600">
                  {row.actor}
                </td>
                <td className="max-w-xl px-4 py-4 text-sm font-semibold text-slate-700">
                  {row.details}
                </td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>
      </StrategicShell>
    </>
  );
}
