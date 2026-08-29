"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import StrictActiveRoleBoundary from "@/app/components/security/StrictActiveRoleBoundary";
import { ActionButton, EmptyState, EnterpriseHero, EnterpriseShell, SectionCard, StatCard, StatusBadge } from "@/app/components/enterprise/EnterpriseUI";
import { dateText, normalizeRows, numberValue, text } from "@/app/components/enterprise/data";

type Rule = { id: string; name: string; requestType: string; fromStage: string; toStage: string; slaHours: number; active: boolean; createdAt: string };
type SlaEvent = { id: string; requestId: string; stage: string; dueAt: string; status: string; escalated: boolean };

export default function WorkflowIntelligencePage() {
  const [rules, setRules] = useState<Rule[]>([]); const [events, setEvents] = useState<SlaEvent[]>([]); const [loading, setLoading] = useState(true); const [warning, setWarning] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", requestType: "ALL", fromStage: "", toStage: "", slaHours: "24" });

  const load = useCallback(async () => { setLoading(true); setWarning(null); const [ruleResult,eventResult] = await Promise.all([supabase.from("workflow_rules").select("*").order("created_at",{ascending:false}),supabase.from("workflow_sla_events").select("*").order("due_at",{ascending:true}).limit(500)]);
    if (ruleResult.error || eventResult.error) setWarning("Workflow intelligence tables are unavailable or restricted to the current active role.");
    setRules(normalizeRows(ruleResult.data).map(row=>({id:text(row.id),name:text(row.name,"Unnamed rule"),requestType:text(row.request_type,"ALL"),fromStage:text(row.from_stage,"—"),toStage:text(row.to_stage,"—"),slaHours:numberValue(row.sla_hours),active:Boolean(row.is_active),createdAt:text(row.created_at)})));
    setEvents(normalizeRows(eventResult.data).map(row=>({id:text(row.id),requestId:text(row.request_id),stage:text(row.stage_key,"—"),dueAt:text(row.due_at),status:text(row.status,"pending"),escalated:Boolean(row.escalated_at)}))); setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  async function createRule() { if (!form.name.trim() || !form.fromStage.trim() || !form.toStage.trim()) { setWarning("Rule name, from stage and to stage are required."); return; }
    const result = await supabase.from("workflow_rules").insert({name:form.name.trim(),request_type:form.requestType,from_stage:form.fromStage.trim().toUpperCase(),to_stage:form.toStage.trim().toUpperCase(),sla_hours:Number(form.slaHours)||24,is_active:true});
    if (result.error) { setWarning(result.error.message); return; } setForm({name:"",requestType:"ALL",fromStage:"",toStage:"",slaHours:"24"}); await load();
  }

  const stats = useMemo(()=>{
    const activeRules = rules.filter(r=>r.active).length;
    const pending = events.filter(e=>/pending|open/i.test(e.status)).length;
    const completed = events.filter(e=>/complete|closed|done/i.test(e.status)).length;
    const overdue = events.filter(e=>new Date(e.dueAt).getTime()<Date.now()&&!/complete|closed|done/i.test(e.status)).length;
    const escalated = events.filter(e=>e.escalated).length;
    const successRate = events.length ? Math.round((completed / events.length) * 1000) / 10 : 0;
    return { activeRules,pending,completed,overdue,escalated,totalRules:rules.length,totalEvents:events.length,successRate };
  },[rules,events]);

  return <StrictActiveRoleBoundary allowedRoles={["admin","auditor","dg"]} label="Workflow Intelligence Centre"><EnterpriseShell><div className="mx-auto max-w-[1500px] space-y-6">
    <EnterpriseHero eyebrow="Workflow Engine" title="Workflow Engine Overview" description="Design, automate and monitor institutional workflows using the routing, SLA and escalation records already available in ReqGen." actions={<ActionButton tone="cyan" onClick={()=>void load()}>{loading?"Refreshing...":"Refresh Intelligence"}</ActionButton>} />
    {warning?<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{warning}</div>:null}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7"><StatCard label="Total Workflows" value={loading?"—":stats.totalRules} note="Configured rules" tone="blue"/><StatCard label="Active Workflows" value={loading?"—":stats.activeRules} note="Enabled definitions" tone="emerald"/><StatCard label="Total Instances" value={loading?"—":stats.totalEvents} note="SLA events" tone="violet"/><StatCard label="Completed" value={loading?"—":stats.completed} note="Closed events" tone="emerald"/><StatCard label="Pending" value={loading?"—":stats.pending} note="Awaiting action" tone="amber"/><StatCard label="Overdue" value={loading?"—":stats.overdue} note="Past target" tone="rose"/><StatCard label="Success Rate" value={loading?"—":`${stats.successRate}%`} note={`${stats.escalated} escalated`} tone="cyan"/></section>
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]"><SectionCard title="Create Workflow Rule" eyebrow="Controlled configuration"><div className="grid gap-3"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Rule name" className="min-h-12 rounded-xl border border-slate-300 px-4 font-bold"/><select value={form.requestType} onChange={e=>setForm({...form,requestType:e.target.value})} className="min-h-12 rounded-xl border border-slate-300 px-4 font-bold"><option value="ALL">All Request Types</option><option value="OFFICIAL">Official</option><option value="PERSONAL_FUND">Personal Fund</option><option value="PERSONAL_OTHER">Personal Other</option></select><div className="grid gap-3 sm:grid-cols-2"><input value={form.fromStage} onChange={e=>setForm({...form,fromStage:e.target.value})} placeholder="From stage" className="min-h-12 rounded-xl border border-slate-300 px-4 font-bold"/><input value={form.toStage} onChange={e=>setForm({...form,toStage:e.target.value})} placeholder="To stage" className="min-h-12 rounded-xl border border-slate-300 px-4 font-bold"/></div><input type="number" min="1" value={form.slaHours} onChange={e=>setForm({...form,slaHours:e.target.value})} placeholder="SLA hours" className="min-h-12 rounded-xl border border-slate-300 px-4 font-bold"/><ActionButton tone="emerald" onClick={()=>void createRule()}>Save Workflow Rule</ActionButton></div></SectionCard>
    <SectionCard title="Routing Rules" eyebrow="Current configuration">{rules.length===0?<EmptyState title="No workflow rules" description="Create the first controlled routing rule for ReqGen."/>:<div className="grid gap-3 md:grid-cols-2">{rules.map(rule=><article key={rule.id} className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-black text-slate-950">{rule.name}</div><div className="mt-1 text-sm font-semibold text-slate-600">{rule.requestType}: {rule.fromStage} → {rule.toStage} · {rule.slaHours} hour SLA</div><div className="mt-1 text-xs font-bold text-slate-400">Created {dateText(rule.createdAt)}</div></div><StatusBadge tone={rule.active?"emerald":"slate"}>{rule.active?"Active":"Inactive"}</StatusBadge></div></article>)}</div>}</SectionCard></section>
    <SectionCard title="SLA Monitoring" eyebrow="Overdue and escalation intelligence">{events.length===0?<EmptyState title="No SLA events" description="SLA events will appear as workflow requests enter monitored stages."/>:<div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-100 text-slate-700"><tr><th className="px-4 py-3 text-left font-black">Request</th><th className="px-4 py-3 text-left font-black">Stage</th><th className="px-4 py-3 text-left font-black">Due</th><th className="px-4 py-3 text-left font-black">Status</th><th className="px-4 py-3 text-left font-black">Escalation</th></tr></thead><tbody className="divide-y divide-slate-100">{events.map(event=><tr key={event.id}><td className="px-4 py-4 font-black text-slate-950">{event.requestId}</td><td className="px-4 py-4 font-bold text-slate-700">{event.stage}</td><td className="px-4 py-4 font-semibold text-slate-600">{dateText(event.dueAt)}</td><td className="px-4 py-4"><StatusBadge tone={new Date(event.dueAt).getTime()<Date.now()?"rose":"amber"}>{event.status}</StatusBadge></td><td className="px-4 py-4"><StatusBadge tone={event.escalated?"rose":"slate"}>{event.escalated?"Escalated":"Not escalated"}</StatusBadge></td></tr>)}</tbody></table></div>}</SectionCard>
  </div></EnterpriseShell></StrictActiveRoleBoundary>;
}
