"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  PrimaryButton,
  SectionCard,
  StrategicHero,
  StrategicNavigation,
  StrategicShell,
} from "@/app/components/hr/HRStrategicUI";

type ReportKey =
  | "development"
  | "capacity"
  | "seminar"
  | "kpi"
  | "assessment"
  | "officers";

type ReportRow = Record<string, unknown>;

type ReportDefinition = {
  table: string;
  select: string;
};

const reportNames: Record<ReportKey, string> = {
  development: "Staff Development Report",
  capacity: "Department Capacity Report",
  seminar: "Weekly Seminar Attendance Report",
  kpi: "Department KPI Report",
  assessment: "Annual 360° Assessment Report",
  officers: "HR Officer Workload Report",
};

const reportDefinitions: Record<ReportKey, ReportDefinition> = {
  development: {
    table: "hr_staff_training_programmes",
    select: "*",
  },
  capacity: {
    table: "hr_department_capacity_programmes",
    select: "*",
  },
  seminar: {
    table: "hr_seminar_attendance",
    select: "*",
  },
  kpi: {
    table: "hr_department_kpis",
    select: "*",
  },
  assessment: {
    table: "hr_assessment_results",
    select: "*",
  },
  officers: {
    table: "hr_request_assignments",
    select: "*",
  },
};

function normalizeRows(value: unknown): ReportRow[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is ReportRow =>
      typeof item === "object" && item !== null && !Array.isArray(item)
  );
}

export default function HROutputPage() {
  const [selected, setSelected] = useState<ReportKey>("development");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async (key: ReportKey) => {
    setLoading(true);
    setWarning(null);

    try {
      const definition = reportDefinitions[key];
      const response = await supabase
        .from(definition.table)
        .select(definition.select)
        .limit(1000);

      if (response.error) {
        console.error(
          `Unable to load ${definition.table}:`,
          response.error.message
        );
        setRows([]);
        setWarning(
          "This report source is unavailable or restricted for the current role."
        );
        return;
      }

      setRows(normalizeRows(response.data));
    } catch (error) {
      console.error("Unable to load HR output report:", error);
      setRows([]);
      setWarning("Unable to load the selected HR report at this time.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(selected);
  }, [load, selected]);

  const headers = useMemo(
    () =>
      Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(
        0,
        12
      ),
    [rows]
  );

  function exportCsv() {
    if (!rows.length || !headers.length) return;

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map(
            (header) =>
              `"${String(row[header] ?? "").replace(/"/g, '""')}"`
          )
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected}-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    window.open('/output?report=hr_staff', '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      <StrategicShell>
        <StrategicHero
          eyebrow="HR Reports & Output"
          title="HR Print & Export Centre"
          description="Generate standardized printable and exportable records for development, capacity, seminar attendance, KPI, assessments and HR officer workload."
        />

        <StrategicNavigation />

        {warning ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            {warning}
          </div>
        ) : null}

        <SectionCard title="Report Selection" eyebrow="Output Configuration">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
            <select
              value={selected}
              onChange={(event) =>
                setSelected(event.target.value as ReportKey)
              }
              className="rounded-xl border-2 border-slate-200 bg-white px-4 py-3 font-black text-slate-900 outline-none focus:border-blue-600"
            >
              {Object.entries(reportNames).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>

            <PrimaryButton tone="violet" onClick={printReport}>
              Print Report
            </PrimaryButton>

            <PrimaryButton
              tone="emerald"
              onClick={exportCsv}
              disabled={!rows.length}
            >
              Export CSV
            </PrimaryButton>
          </div>
        </SectionCard>

        <section
          id="hr-output-report"
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none"
        >
          <div className="border-b-2 border-slate-900 pb-4 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">
              Islamic Education Trust
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              {reportNames[selected]}
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Generated {new Date().toLocaleString("en-NG")}
            </p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-100">
                <tr>
                  {headers.map((header) => (
                    <th
                      key={header}
                      className="px-3 py-2 text-left font-black uppercase text-slate-700"
                    >
                      {header.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={Math.max(headers.length, 1)}
                      className="px-4 py-10 text-center font-bold text-slate-500"
                    >
                      Loading report...
                    </td>
                  </tr>
                ) : rows.length ? (
                  rows.map((row, index) => (
                    <tr key={String(row.id ?? index)}>
                      {headers.map((header) => (
                        <td
                          key={header}
                          className="max-w-52 truncate px-3 py-2 font-semibold text-slate-700"
                        >
                          {String(row[header] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={Math.max(headers.length, 1)}
                      className="px-4 py-10 text-center font-bold text-slate-500"
                    >
                      No records are available for this report.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </StrategicShell>
    </>
  );
}
