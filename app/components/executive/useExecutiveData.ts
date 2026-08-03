"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type Row = Record<string, unknown>;
export type ExecData = Record<string, Row[]>;
const sources = [
  ["requests", "requests"], ["vouchers", "payment_vouchers"], ["transactions", "finance_transactions"],
  ["hrAssignments", "hr_request_assignments"], ["leave", "hr_leave_records"], ["seminars", "hr_seminar_sessions"],
  ["attendance", "hr_seminar_attendance"], ["registry", "registry_correspondence"], ["audit", "enterprise_audit_events"],
  ["notifications", "notifications"], ["departments", "departments"], ["profiles", "profiles"],
  ["kpis", "hr_department_kpis"], ["workflow", "workflow_sla_events"], ["roleSwitches", "user_role_switch_history"],
] as const;

export function text(value: unknown, fallback="") { return typeof value === "string" && value.trim() ? value : fallback; }
export function numberOf(value: unknown) { const n=Number(value ?? 0); return Number.isFinite(n)?n:0; }
export function dateOf(value: unknown) { const d=new Date(String(value ?? "")); return Number.isNaN(d.getTime())?null:d; }
export function dateTime(value: unknown) { const d=dateOf(value); return d?d.toLocaleString("en-NG", {dateStyle:"medium",timeStyle:"short",hour12:true}):"—"; }

export function useExecutiveData() {
  const [data,setData]=useState<ExecData>({});
  const [loading,setLoading]=useState(true);
  const [coverage,setCoverage]=useState(0);
  const [warning,setWarning]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true); setWarning(null);
    const results=await Promise.all(sources.map(async ([key,table])=>{
      const result=await supabase.from(table).select("*").order("created_at",{ascending:false}).limit(250);
      return {key,rows:Array.isArray(result.data)?result.data as Row[]:[],ok:!result.error};
    }));
    const next:ExecData={}; let ok=0;
    for(const result of results){ next[result.key]=result.rows; if(result.ok) ok++; }
    setData(next); setCoverage(Math.round(ok/results.length*100));
    if(ok===0) setWarning("No executive data source is currently available to this active role.");
    setLoading(false);
  },[]);

  useEffect(()=>{ void load(); const channel=supabase.channel("executive-live").on("postgres_changes",{event:"*",schema:"public",table:"requests"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"notifications"},()=>void load()).subscribe(); return()=>{void supabase.removeChannel(channel)}; },[load]);

  const metrics=useMemo(()=>{
    const requests=data.requests??[]; const vouchers=data.vouchers??[]; const transactions=data.transactions??[];
    const hr=data.hrAssignments??[]; const registry=data.registry??[]; const audit=data.audit??[]; const attendance=data.attendance??[]; const leave=data.leave??[];
    const pending=requests.filter(r=>!/approved|completed|paid|rejected|cancelled|filed/i.test(text(r.status))).length;
    const approved=requests.filter(r=>/approved|completed|paid|filed/i.test(text(r.status))).length;
    const financePending=vouchers.filter(r=>!/paid|completed|cancelled|rejected/i.test(text(r.status))).length;
    const hrPending=hr.filter(r=>!/approved|completed|closed/i.test(text(r.status))).length;
    const registryOpen=registry.filter(r=>!/archived|closed|completed/i.test(text(r.status))).length;
    const unread=(data.notifications??[]).filter(r=>!Boolean(r.is_read)).length;
    const expenditure=transactions.reduce((s,r)=>s+numberOf(r.amount),0);
    const present=attendance.filter(r=>!/absent/i.test(text(r.attendance_status))).length;
    const attendanceRate=attendance.length?present/attendance.length*100:0;
    const leaveToday=leave.filter(r=>{const now=new Date();const start=dateOf(r.start_date);const end=dateOf(r.end_date);return start&&end&&start<=now&&end>=now;}).length;
    return {requests:requests.length,pending,approved,financePending,hrPending,registryOpen,audit:audit.length,unread,expenditure,attendanceRate,leaveToday,vouchers:vouchers.length};
  },[data]);

  return {data,metrics,loading,coverage,warning,refresh:load};
}
