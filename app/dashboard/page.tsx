"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, Clock3, FileText, Landmark, Plus, ShieldCheck, UploadCloud, WalletCards, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type RequestRow = { id:string; request_no:string; title:string; status:string; request_type?:string|null; personal_category?:string|null; created_at:string };
type VoucherRow = { id:string; voucher_no?:string|null; amount?:number|null; status?:string|null; created_at?:string|null };

function stageStatus(status:string) { const s=(status||"").toLowerCase(); if(s.includes("reject")||s.includes("delete")) return "rejected"; if(s.includes("paid")||s.includes("complete")||s.includes("approved")) return "completed"; return "pending"; }
function category(row:RequestRow){ const rt=(row.request_type||"").toLowerCase(); const cat=(row.personal_category||"").toLowerCase(); if(rt==="official") return "Official"; if(rt==="personal"&&cat.includes("fund")) return "Personal Fund"; if(rt==="personal") return "Personal Other"; return "Other"; }

export default function DashboardPage(){
  const [requests,setRequests]=useState<RequestRow[]>([]); const [vouchers,setVouchers]=useState<VoucherRow[]>([]); const [name,setName]=useState("Admin");
  useEffect(()=>{ (async()=>{ const [rq,pv,user]=await Promise.all([supabase.from("requests").select("id,request_no,title,status,request_type,personal_category,created_at").order("created_at",{ascending:false}).limit(500),supabase.from("payment_vouchers").select("id,voucher_no,amount,status,created_at").order("created_at",{ascending:false}).limit(300),supabase.auth.getUser()]); setRequests((rq.data||[]) as RequestRow[]); setVouchers((pv.data||[]) as VoucherRow[]); const u=user.data.user; setName(u?.user_metadata?.full_name||u?.user_metadata?.name||u?.email?.split("@")[0]||"Admin"); })(); },[]);
  const stats=useMemo(()=>{ const pending=requests.filter(r=>stageStatus(r.status)==="pending").length; const completed=requests.filter(r=>stageStatus(r.status)==="completed").length; const overdue=0; const paid=vouchers.filter(v=>/paid|complete/i.test(v.status||"")).reduce((s,v)=>s+Number(v.amount||0),0); return {total:requests.length,pending,completed,overdue,paid}; },[requests,vouchers]);
  const cats=useMemo(()=>{ const map=new Map<string,number>(); requests.forEach(r=>map.set(category(r),(map.get(category(r))||0)+1)); return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5); },[requests]);
  const statuses=useMemo(()=>["Pending","Completed","Rejected"].map(k=>[k,requests.filter(r=>stageStatus(r.status)===k.toLowerCase()).length] as const),[requests]);
  const recent=requests.slice(0,5);
  const trend=[42,68,44,58,88,61,79];
  return <div className="mock-page mock-dashboard-page">
    <div className="mock-page-heading"><div><h1>Welcome back, {name}! 👋</h1><p>Here&apos;s what&apos;s happening across ReqGen today.</p></div><div className="mock-date-chip">{new Date().toLocaleDateString("en-NG",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}</div></div>
    <section className="mock-kpi-grid mock-kpi-grid-5">
      <Kpi icon={<FileText/>} label="Total Requests" value={stats.total} tone="blue" note="Live system total"/>
      <Kpi icon={<Clock3/>} label="Pending Approvals" value={stats.pending} tone="orange" note="Needs attention"/>
      <Kpi icon={<CheckCircle2/>} label="Completed / Paid" value={stats.completed} tone="green" note="Completed requests"/>
      <Kpi icon={<WalletCards/>} label="Total Disbursed" value={`₦${(stats.paid/1_000_000).toFixed(1)}M`} tone="purple" note="Paid vouchers"/>
      <Kpi icon={<XCircle/>} label="Overdue" value={stats.overdue} tone="red" note="Needs attention"/>
    </section>
    <section className="mock-dashboard-main-grid"><div className="mock-panel mock-trend-panel"><div className="mock-panel-title"><h2>Request Trend <span>(This Week)</span></h2><button>This Week⌄</button></div><svg viewBox="0 0 640 210" aria-label="Request trend chart" className="mock-line-chart"><path d={`M 25 ${180-trend[0]} L 120 ${180-trend[1]} L 215 ${180-trend[2]} L 310 ${180-trend[3]} L 405 ${180-trend[4]} L 500 ${180-trend[5]} L 610 ${180-trend[6]}`} fill="none" stroke="currentColor" strokeWidth="4"/><g>{trend.map((v,i)=><circle key={i} cx={[25,120,215,310,405,500,610][i]} cy={180-v} r="5" fill="currentColor"/>)}</g></svg></div><div className="mock-panel"><div className="mock-panel-title"><h2>Recent Activities</h2><Link href="/dashboard/activity">View all</Link></div><div className="mock-activity-list">{recent.map((r,i)=><div key={r.id}><span className={`mock-activity-dot tone-${i%4}`}></span><div><strong>{r.request_no || "Request"}</strong><p>{r.title}</p></div><time>{new Date(r.created_at).toLocaleTimeString("en-NG",{hour:"2-digit",minute:"2-digit"})}</time></div>)}</div></div></section>
    <section className="mock-dashboard-bottom-grid"><Donut title="Requests by Category" rows={cats}/><Donut title="Requests by Status" rows={statuses}/><div className="mock-panel"><div className="mock-panel-title"><h2>Quick Actions</h2></div><div className="mock-quick-grid"><Quick href="/requests/new" icon={<Plus/>} label="New Request"/><Quick href="/approvals/action-centre" icon={<ShieldCheck/>} label="Action Centre"/><Quick href="/finance/manage-accounts" icon={<Landmark/>} label="Add Account"/><Quick href="/payment-vouchers" icon={<WalletCards/>} label="New Voucher"/><Quick href="/registry/incoming" icon={<UploadCloud/>} label="Upload Document"/><Quick href="/reports" icon={<FileText/>} label="View Reports"/></div></div></section>
    <div className="mock-security-tip"><ShieldCheck/><div><strong>Security Tip</strong><p>Always verify request details before approval and never share your login credentials.</p></div><Link href="/profile/security">Learn more →</Link></div>
  </div>;
}
function Kpi({icon,label,value,tone,note}:{icon:React.ReactNode;label:string;value:string|number;tone:string;note:string}){return <div className="mock-kpi"><span className={`mock-kpi-icon tone-${tone}`}>{icon}</span><div><b>{label}</b><strong>{value}</strong><small>{note}</small></div></div>}
function Quick({href,icon,label}:{href:string;icon:React.ReactNode;label:string}){return <Link href={href}><span>{icon}</span><b>{label}</b></Link>}
function Donut({title,rows}:{title:string;rows:readonly (readonly [string,number])[]}){const total=Math.max(1,rows.reduce((s,r)=>s+r[1],0));return <div className="mock-panel"><div className="mock-panel-title"><h2>{title}</h2></div><div className="mock-donut-wrap"><div className="mock-donut"/><div className="mock-donut-legend">{rows.map(([k,v],i)=><div key={k}><i className={`tone-${["blue","orange","green","purple","red"][i%5]}`}></i><span>{k}</span><b>{v} ({Math.round(v/total*100)}%)</b></div>)}</div></div></div>}
