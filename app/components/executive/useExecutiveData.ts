"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { activeRoleFromRpc, normalizeRows, numberValue, roleKey, text, type GenericRow } from "@/app/components/enterprise/data";

export type ExecutiveData = Record<string, GenericRow[]>;

const SOURCES: Record<string, { table: string; order?: string; limit?: number }> = {
  requests: { table: "requests", order: "created_at", limit: 250 },
  vouchers: { table: "payment_vouchers", order: "created_at", limit: 150 },
  transactions: { table: "finance_transactions", order: "created_at", limit: 150 },
  hrAssignments: { table: "hr_request_assignments", order: "created_at", limit: 150 },
  leave: { table: "hr_leave_records", order: "created_at", limit: 150 },
  seminars: { table: "hr_weekly_seminars", order: "session_date", limit: 100 },
  seminarAttendance: { table: "hr_seminar_attendance", order: "created_at", limit: 250 },
  kpis: { table: "hr_department_kpis", order: "created_at", limit: 150 },
  registry: { table: "registry_correspondence", order: "created_at", limit: 150 },
  movements: { table: "registry_file_movements", order: "created_at", limit: 150 },
  audit: { table: "enterprise_audit_events", order: "created_at", limit: 250 },
  roleSwitches: { table: "user_role_switch_history", order: "created_at", limit: 150 },
  notifications: { table: "notifications", order: "created_at", limit: 150 },
  workflowSla: { table: "workflow_sla_events", order: "due_at", limit: 150 },
};

export function useExecutiveData() {
  const [data, setData] = useState<ExecutiveData>({});
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState("");
  const [coverage, setCoverage] = useState(0);
  const [activeRole, setActiveRole] = useState("Executive");

  const load = useCallback(async () => {
    setLoading(true);
    setWarning("");
    const { data: roleData } = await supabase.rpc("get_my_active_role");
    setActiveRole(activeRoleFromRpc(roleData) || "Executive");

    const entries = await Promise.all(Object.entries(SOURCES).map(async ([key, config]) => {
      let query = supabase.from(config.table).select("*");
      if (config.order) query = query.order(config.order, { ascending: false });
      if (config.limit) query = query.limit(config.limit);
      const result = await query;
      return { key, rows: normalizeRows(result.data), error: result.error?.message || "" };
    }));

    const next: ExecutiveData = {};
    const failed: string[] = [];
    let connected = 0;
    entries.forEach((entry) => {
      next[entry.key] = entry.rows;
      if (entry.error) failed.push(entry.key);
      else connected += 1;
    });
    setData(next);
    setCoverage(Math.round((connected / Object.keys(SOURCES).length) * 100));
    if (failed.length) setWarning("Some optional executive data sources are unavailable. Available authorized records are still displayed.");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase.channel("executive-command-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "enterprise_audit_events" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const metrics = useMemo(() => {
    const requests = data.requests ?? [];
    const closed = requests.filter((row) => /completed|paid|approved|filed|closed/i.test(text(row.status))).length;
    const pending = requests.filter((row) => !/completed|paid|approved|rejected|cancelled|deleted|filed|closed/i.test(text(row.status))).length;
    const vouchers = data.vouchers ?? [];
    const financePending = vouchers.filter((row) => !/paid|completed|cancelled|rejected/i.test(text(row.status))).length;
    const hrOpen = (data.hrAssignments ?? []).filter((row) => !/completed|approved|closed/i.test(text(row.status))).length;
    const registryOpen = (data.registry ?? []).filter((row) => !/archived|closed|completed/i.test(text(row.status))).length;
    const totalTransactionValue = (data.transactions ?? []).reduce((sum, row) => sum + numberValue(row.amount || row.transaction_amount || row.credit || row.debit), 0);
    const attendance = data.seminarAttendance ?? [];
    const present = attendance.filter((row) => /present|late/i.test(text(row.status || row.attendance_status))).length;
    const attendanceRate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;
    return { requestTotal: requests.length, requestClosed: closed, requestPending: pending, financePending, hrOpen, registryOpen, totalTransactionValue, attendanceRate, notificationsUnread: (data.notifications ?? []).filter((row) => !Boolean(row.is_read)).length };
  }, [data]);

  return { data, loading, warning, coverage, activeRole, metrics, refresh: load };
}

export function normalizedRole(value: unknown) { return roleKey(value); }
