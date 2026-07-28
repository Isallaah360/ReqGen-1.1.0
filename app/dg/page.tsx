"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ActionButton, ExecutiveHero, Icon, QuickAction, ReqGenPageStyles, SectionCard, SkeletonDashboard, StatCard, StatusBadge } from "@/app/components/ui/ReqGenDesignSystem";

type AnyRow = Record<string, any>;
type RequestRow = { id:string; request_no:string|null; title:string|null; status:string|null; current_stage:string|null; current_owner:string|null; amount:number|null; request_type:string|null; personal_category:string|null; created_at:string|null; department_id?:string|null };
type DepartmentRow = { id:string; name:string; is_active:boolean|null };
type AccountRow = { id:string; name:string|null; code:string|null; bucket:string|null; is_active:boolean|null; total_fund:number|null; allocated_amount:number|null };
type TransactionRow = { id:string; transaction_no:string|null; transaction_type:string|null; amount:number|null; narration:string|null; transaction_date:string|null; created_at:string|null; is_reversed:boolean|null };

const terminalStages = new Set(["COMPLETED","REJECTED","DELETED","CANCELLED","CLOSED"]);
const key = (v:unknown) => String(v ?? "").trim().toUpperCase().replace(/[\s_-]+/g, "");
const money = (v:unknown) => "₦" + Number(v || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 });
const compactMoney = (v:number) => new Intl.NumberFormat("en-NG", { style:"currency", currency:"NGN", notation:"compact", maximumFractionDigits:1 }).format(v || 0);
const dateTime = (v:unknown) => { if (!v) return "—"; const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-NG", { dateStyle:"medium", timeStyle:"short" }); };
const label = (v:unknown) => String(v || "Unknown").replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase());

function toneForStage(stage:unknown): "blue"|"cyan"|"emerald"|"violet"|"amber"|"rose"|"slate" {
  const s = key(stage); if (["COMPLETED","PAID","APPROVED"].includes(s)) return "emerald"; if (["REJECTED","DELETED","CANCELLED"].includes(s)) return "rose"; if (s === "DG") return "amber"; if (s === "ACCOUNT") return "violet"; if (["HOD","DOD"].includes(s)) return "cyan"; return "blue";
}

function genericActivity(rows:AnyRow[], source:string) {
  return rows.map((row) => ({ id:String(row.id ?? `${source}-${Math.random()}`), source, title:String(row.action ?? row.status ?? row.event_type ?? row.activity_type ?? source), detail:String(row.notes ?? row.comment ?? row.description ?? row.narration ?? row.request_no ?? row.reference_no ?? "System activity"), at:String(row.created_at ?? row.updated_at ?? row.action_at ?? row.event_at ?? "") }));
}

export default function DGExecutiveCommandCentre() {
  const router = useRouter();
  const [loading,setLoading] = useState(true); const [refreshing,setRefreshing] = useState(false); const [error,setError] = useState<string|null>(null);
  const [profile,setProfile] = useState<AnyRow|null>(null); const [requests,setRequests] = useState<RequestRow[]>([]); const [departments,setDepartments] = useState<DepartmentRow[]>([]); const [accounts,setAccounts] = useState<AccountRow[]>([]); const [transactions,setTransactions] = useState<TransactionRow[]>([]); const [profilesCount,setProfilesCount] = useState(0); const [unreadCount,setUnreadCount] = useState(0); const [activity,setActivity] = useState<any[]>([]);

  const load = useCallback(async (silent=false) => {
    silent ? setRefreshing(true) : setLoading(true); setError(null);
    const { data:auth } = await supabase.auth.getUser();
    if (!auth.user) { router.push("/login"); return; }
    const user = auth.user;
    const [profileRes, roleRes, requestsRes, departmentsRes, accountsRes, transactionsRes, profilesCountRes, notificationsRes, requestHistoryRes, voucherHistoryRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id",user.id).maybeSingle(),
      supabase.from("profile_roles").select("role_key,role_name,is_primary,is_active").eq("profile_id",user.id).eq("is_active",true),
      supabase.from("requests").select("id,request_no,title,status,current_stage,current_owner,amount,request_type,personal_category,created_at,department_id").order("created_at",{ascending:false}).limit(500),
      supabase.from("departments").select("id,name,is_active").order("name",{ascending:true}),
      supabase.from("iet_accounts").select("id,name,code,bucket,is_active,total_fund,allocated_amount").order("name",{ascending:true}),
      supabase.from("finance_transactions").select("id,transaction_no,transaction_type,amount,narration,transaction_date,created_at,is_reversed").order("created_at",{ascending:false}).limit(120),
      supabase.from("profiles").select("id",{count:"exact",head:true}),
      supabase.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("is_read",false),
      supabase.from("request_history").select("*").order("created_at",{ascending:false}).limit(10),
      supabase.from("payment_voucher_history").select("*").order("created_at",{ascending:false}).limit(10),
    ]);
    const fatal = [requestsRes,departmentsRes,accountsRes,transactionsRes].find((r:any)=>r.error);
    if (fatal?.error) setError("Some Executive Command Centre records could not be loaded: " + fatal.error.message);
    const roles = roleRes.data || []; const roleText = [profileRes.data?.role,...roles.map((r:any)=>r.role_key),...roles.map((r:any)=>r.role_name)].join(" ").toLowerCase();
    if (roleText && !roleText.includes("dg") && !roleText.includes("director general") && !roleText.includes("admin")) setError("This page is designed for DG and authorised administrative roles. Your database policies remain the final access control.");
    setProfile(profileRes.data || { id:user.id, email:user.email }); setRequests((requestsRes.data || []) as RequestRow[]); setDepartments((departmentsRes.data || []) as DepartmentRow[]); setAccounts((accountsRes.data || []) as AccountRow[]); setTransactions((transactionsRes.data || []) as TransactionRow[]); setProfilesCount(profilesCountRes.count || 0); setUnreadCount(notificationsRes.count || 0);
    const merged = [...genericActivity(requestHistoryRes.data || [],"Request"),...genericActivity(voucherHistoryRes.data || [],"Voucher")].filter(x=>x.at).sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime()).slice(0,10); setActivity(merged);
    setLoading(false); setRefreshing(false);
  },[router]);

  useEffect(()=>{ load(); const focus=()=>load(true); const visible=()=>document.visibilityState==="visible"&&load(true); window.addEventListener("focus",focus); document.addEventListener("visibilitychange",visible); return()=>{window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",visible);}; },[load]);

  const stats = useMemo(()=>{
    const active = requests.filter(r=>!terminalStages.has(key(r.current_stage)) && !["REJECTED","DELETED","CANCELLED","COMPLETED","PAID","CLOSED"].some(s=>key(r.status).includes(s)));
    const dg = active.filter(r=>key(r.current_stage)==="DG"); const completed=requests.filter(r=>key(r.current_stage)==="COMPLETED"||key(r.status).includes("COMPLET")||key(r.status).includes("PAID")); const rejected=requests.filter(r=>["REJECTED","DELETED","CANCELLED"].includes(key(r.current_stage))||key(r.status).includes("REJECT"));
    const totalFund=accounts.reduce((s,a)=>s+Number(a.total_fund||0),0); const allocated=accounts.reduce((s,a)=>s+Number(a.allocated_amount||0),0); const available=Math.max(0,totalFund-allocated); const validTx=transactions.filter(t=>!t.is_reversed); const expense=validTx.filter(t=>/debit|expense|payment|withdraw/i.test(String(t.transaction_type))).reduce((s,t)=>s+Math.abs(Number(t.amount||0)),0); const today=new Date().toISOString().slice(0,10); const todayTx=validTx.filter(t=>String(t.transaction_date||t.created_at||"").slice(0,10)===today).reduce((s,t)=>s+Math.abs(Number(t.amount||0)),0);
    return {active,dg,completed,rejected,totalFund,allocated,available,expense,todayTx,util:totalFund?allocated/totalFund*100:0};
  },[requests,accounts,transactions]);

  const stageCounts = useMemo(()=>{ const map=new Map<string,number>(); stats.active.forEach(r=>{const s=key(r.current_stage)||"UNASSIGNED";map.set(s,(map.get(s)||0)+1)}); return [...map.entries()].sort((a,b)=>b[1]-a[1]); },[stats.active]);
  const recentRequests=requests.slice(0,7); const recentTx=transactions.filter(t=>!t.is_reversed).slice(0,7);
  const displayName=profile?.full_name || profile?.name || profile?.display_name || profile?.email || "Director-General";
  if (loading) return <><ReqGenPageStyles/><SkeletonDashboard/></>;

  return <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-900 sm:px-7 sm:py-7"><ReqGenPageStyles/><div className="mx-auto max-w-[1500px] space-y-6">
    <ExecutiveHero eyebrow="Executive Command Centre" title={`Welcome, ${displayName}`} description="A consolidated leadership view of requests, approvals, finance, departments, payment activity and exceptions requiring executive attention." meta={<div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-200"><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">Live operational overview</span><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">{new Date().toLocaleDateString("en-NG",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</span>{unreadCount>0&&<span className="rounded-full bg-rose-500 px-3 py-1.5 text-white">{unreadCount} unread notification{unreadCount===1?"":"s"}</span>}</div>} actions={<><ActionButton onClick={()=>load(true)} icon="refresh" variant="ghost" disabled={refreshing}>{refreshing?"Refreshing…":"Refresh"}</ActionButton><ActionButton href="/approvals" icon="approval">Open Approvals</ActionButton></>} />
    {error&&<div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0"/><span>{error}</span></div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Total Requests" value={requests.length.toLocaleString()} note={`${stats.active.length} currently active`} icon="request" tone="blue"/><StatCard label="Pending DG Decisions" value={stats.dg.length.toLocaleString()} note={money(stats.dg.reduce((s,r)=>s+Number(r.amount||0),0))+" awaiting decision"} icon="approval" tone="amber"/><StatCard label="Completed Requests" value={stats.completed.length.toLocaleString()} note={`${stats.rejected.length} rejected or cancelled`} icon="audit" tone="emerald"/><StatCard label="Active Departments" value={departments.filter(d=>d.is_active!==false).length.toLocaleString()} note={`${profilesCount.toLocaleString()} user profiles`} icon="building" tone="cyan"/><StatCard label="Total Account Funds" value={compactMoney(stats.totalFund)} note={`Across ${accounts.filter(a=>a.is_active!==false).length} active accounts`} icon="money" tone="violet"/><StatCard label="Allocated Funds" value={compactMoney(stats.allocated)} note={`${stats.util.toFixed(1)}% of recorded funds`} icon="chart" tone="blue" progress={stats.util}/><StatCard label="Unallocated Balance" value={compactMoney(stats.available)} note="Calculated from total fund less allocation" icon="money" tone="emerald"/><StatCard label="Today's Transactions" value={compactMoney(stats.todayTx)} note={`${recentTx.length} recent entries loaded`} icon="clock" tone="rose"/></section>

    <div className="grid gap-6 xl:grid-cols-[1.45fr_.85fr]">
      <SectionCard title="Executive Approval Pipeline" description="Current active workload by workflow stage" icon="approval"><div className="space-y-3">{stageCounts.length===0?<p className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">No active requests are presently in the approval pipeline.</p>:stageCounts.map(([stage,count])=>{const pct=stats.active.length?count/stats.active.length*100:0;return <div key={stage} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className="mb-2 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><StatusBadge tone={toneForStage(stage)}>{label(stage)}</StatusBadge><span className="text-xs text-slate-500">{pct.toFixed(0)}% of active workflow</span></div><span className="text-xl font-black text-slate-950">{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{width:`${pct}%`}}/></div></div>})}</div></SectionCard>
      <SectionCard title="Executive Quick Actions" description="Direct access to principal control centres" icon="dashboard"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><QuickAction href="/approvals" title="Approval Centre" description="Review requests currently requiring your decision." icon="approval" tone="amber"/><QuickAction href="/finance" title="Finance Control Centre" description="Open accounts, transactions, transfers and reports." icon="money" tone="violet"/><QuickAction href="/finance/reports" title="Executive Reports" description="Review financial and operational reporting outputs." icon="report" tone="blue"/><QuickAction href="/finance/audit-trail" title="Audit Trail" description="Inspect traceable system and finance activities." icon="audit" tone="emerald"/><QuickAction href="/notifications" title="Notifications" description={`${unreadCount} unread executive notification${unreadCount===1?"":"s"}.`} icon="bell" tone="rose"/><QuickAction href="/finance/settings" title="Control Settings" description="Manage authorised finance configuration." icon="settings" tone="slate"/></div></SectionCard>
    </div>

    <div className="grid gap-6 xl:grid-cols-2">
      <SectionCard title="Recent Requests" description="Latest requests visible under your Supabase policies" icon="request" action={<a href="/requests" className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-900">View all <Icon name="arrow" className="h-4 w-4"/></a>}><div className="overflow-x-auto"><table className="min-w-full"><thead><tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500"><th className="pb-3 pr-4">Request</th><th className="pb-3 pr-4">Stage</th><th className="pb-3 pr-4 text-right">Amount</th></tr></thead><tbody>{recentRequests.map(r=><tr key={r.id} className="border-b border-slate-100 last:border-0"><td className="py-3 pr-4"><a href={`/requests/${r.id}`} className="font-bold text-slate-900 hover:text-blue-700">{r.request_no||"Request"}</a><p className="mt-1 max-w-[320px] truncate text-xs text-slate-500">{r.title||"Untitled request"}</p></td><td className="py-3 pr-4"><StatusBadge tone={toneForStage(r.current_stage)}>{label(r.current_stage)}</StatusBadge></td><td className="py-3 text-right text-sm font-extrabold text-slate-900">{money(r.amount)}</td></tr>)}</tbody></table>{recentRequests.length===0&&<p className="p-8 text-center text-sm text-slate-500">No request records found.</p>}</div></SectionCard>
      <SectionCard title="Recent Finance Transactions" description="Latest non-reversed entries from the finance ledger" icon="money" action={<a href="/finance/transactions" className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-900">Open ledger <Icon name="arrow" className="h-4 w-4"/></a>}><div className="space-y-2">{recentTx.map(t=><div key={t.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-bold text-slate-900">{t.transaction_no||label(t.transaction_type)}</span><StatusBadge tone={/credit|income|deposit/i.test(String(t.transaction_type))?"emerald":"violet"}>{label(t.transaction_type)}</StatusBadge></div><p className="mt-1 truncate text-xs text-slate-500">{t.narration||dateTime(t.transaction_date||t.created_at)}</p></div><span className="shrink-0 text-sm font-black text-slate-950">{money(t.amount)}</span></div>)}{recentTx.length===0&&<p className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">No finance transactions found.</p>}</div></SectionCard>
    </div>

    <SectionCard title="Executive Activity Feed" description="Combined recent request and payment-voucher history" icon="clock"><div className="grid gap-3 md:grid-cols-2">{activity.map(item=><div key={`${item.source}-${item.id}`} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm"><Icon name={item.source==="Voucher"?"voucher":"request"} className="h-4 w-4"/></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{label(item.title)}</p><StatusBadge tone={item.source==="Voucher"?"violet":"blue"}>{item.source}</StatusBadge></div><p className="mt-1 truncate text-xs text-slate-500">{item.detail}</p><p className="mt-2 text-[11px] font-semibold text-slate-400">{dateTime(item.at)}</p></div></div>)}{activity.length===0&&<p className="md:col-span-2 rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">No recent history entries are available.</p>}</div></SectionCard>
  </div></main>;
}
