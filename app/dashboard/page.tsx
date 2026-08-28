"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileText, Clock3, CircleCheckBig, WalletCards, TriangleAlert, Plus, ShieldCheck, Landmark, Upload, BarChart3 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type RequestRow = { id: string; status: string | null; request_type: string | null; personal_category: string | null; created_at: string; title: string | null; request_no: string | null };
type VoucherRow = { id: string; status: string | null; amount: number | null; total_amount: number | null; created_at?: string | null; voucher_no?: string | null };

function money(n: number) { return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n || 0); }
function done(v?: string | null) { const s=(v||"").toLowerCase(); return s.includes("paid") || s.includes("complete") || s.includes("approved"); }

export default function DashboardPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [name, setName] = useState("User");
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
    let live = true;
    (async () => {
      const auth = await supabase.auth.getUser();
      if (live) setName(auth.data.user?.user_metadata?.full_name || auth.data.user?.email?.split("@")[0] || "User");
      const [rq, pv] = await Promise.all([
        supabase.from("requests").select("id,status,request_type,personal_category,created_at,title,request_no").order("created_at", { ascending: false }).limit(500),
        supabase.from("payment_vouchers").select("id,status,amount,total_amount,created_at,voucher_no").order("created_at", { ascending: false }).limit(500),
      ]);
      if (!live) return;
      if (!rq.error) setRequests((rq.data || []) as RequestRow[]);
      if (!pv.error) setVouchers((pv.data || []) as VoucherRow[]);
    })();
    return () => { live = false; };
  }, []);

  const stats = useMemo(() => {
    const pending = requests.filter(r => !done(r.status) && !String(r.status||"").toLowerCase().includes("reject")).length;
    const completed = requests.filter(r => done(r.status)).length;
    const disbursed = vouchers.filter(v => done(v.status)).reduce((a,v)=>a+Number(v.total_amount ?? v.amount ?? 0),0);
    const overdue = requests.filter(r => String(r.status||"").toLowerCase().includes("overdue")).length;
    return { total: requests.length, pending, completed, disbursed, overdue };
  }, [requests, vouchers]);

  const week = useMemo(() => {
    const days = Array.from({length:7},(_,i)=>{const d=new Date(); d.setDate(d.getDate()-(6-i)); return d;});
    return days.map(d=>({label:d.toLocaleDateString("en-NG",{weekday:"short"}), count:requests.filter(r=>new Date(r.created_at).toDateString()===d.toDateString()).length}));
  }, [requests]);
  const maxWeek = Math.max(1, ...week.map(x=>x.count));

  return (
    <div className="mock-page dashboard-mock">
      <div className="mock-page-title-row">
        <div><span className="mock-greeting">{greeting}</span><h1>Welcome back, {name}! <span aria-hidden="true">👋</span></h1><p>Here&apos;s what&apos;s happening across ReqGen today.</p></div>
        <div className="mock-date">{new Date().toLocaleDateString("en-NG", { weekday:"long", day:"2-digit", month:"long", year:"numeric" })}</div>
      </div>

      <div className="mock-kpi-grid five">
        <Kpi icon={<FileText/>} tone="blue" label="Total Requests" value={String(stats.total)} note="Live system total" />
        <Kpi icon={<Clock3/>} tone="orange" label="Pending Approvals" value={String(stats.pending)} note="Needs action" />
        <Kpi icon={<CircleCheckBig/>} tone="green" label="Completed / Paid" value={String(stats.completed)} note="Processed requests" />
        <Kpi icon={<WalletCards/>} tone="purple" label="Total Disbursed" value={money(stats.disbursed)} note="Paid vouchers" />
        <Kpi icon={<TriangleAlert/>} tone="red" label="Overdue" value={String(stats.overdue)} note="Needs attention" />
      </div>

      <div className="mock-dashboard-grid">
        <section className="mock-card mock-chart-card"><div className="mock-card-head"><h2>Request Trend <span>(This Week)</span></h2></div><div className="mock-bars">{week.map((x,i)=><div key={i} className="mock-bar-col"><div className="mock-bar" style={{height:`${18 + (x.count/maxWeek)*130}px`}}><b>{x.count}</b></div><span>{x.label}</span></div>)}</div></section>
        <section className="mock-card"><div className="mock-card-head"><h2>Recent Activities</h2><Link href="/dashboard/activity">View all</Link></div><div className="mock-activity-list">{requests.slice(0,5).map((r,i)=><div key={r.id}><span className={`activity-dot t${i%4}`}/><div><strong>{r.request_no || "Request"}</strong><p>{r.title || "Request activity"}</p></div><time>{new Date(r.created_at).toLocaleDateString("en-NG")}</time></div>)}</div></section>
        <section className="mock-card"><div className="mock-card-head"><h2>Requests by Category</h2></div><div className="mock-donut-wrap"><div className="mock-donut"/><div className="mock-legend"><span><i className="blue"/>Official</span><span><i className="purple"/>Personal Fund</span><span><i className="orange"/>Personal Other</span></div></div></section>
        <section className="mock-card"><div className="mock-card-head"><h2>Requests by Status</h2></div><div className="mock-donut-wrap"><div className="mock-donut status"/><div className="mock-legend"><span><i className="orange"/>Pending</span><span><i className="blue"/>In Progress</span><span><i className="green"/>Completed</span><span><i className="red"/>Rejected</span></div></div></section>
        <section className="mock-card"><div className="mock-card-head"><h2>Quick Actions</h2></div><div className="mock-quick-grid"><Quick href="/requests/new" icon={<Plus/>} label="New Request"/><Quick href="/approvals/action-centre" icon={<ShieldCheck/>} label="Action Centre"/><Quick href="/finance/manage-accounts" icon={<Landmark/>} label="Bank Accounts"/><Quick href="/payment-vouchers" icon={<WalletCards/>} label="Vouchers"/><Quick href="/registry" icon={<Upload/>} label="Registry"/><Quick href="/reports" icon={<BarChart3/>} label="Reports"/></div></section>
      </div>
      <div className="mock-security-tip"><ShieldCheck/><div><strong>Security Tip</strong><p>Always verify request details before approval and never share your login credentials.</p></div></div>
    </div>
  );
}
function Kpi({icon,tone,label,value,note}:{icon:React.ReactNode;tone:string;label:string;value:string;note:string}) { return <section className="mock-kpi"><div className={`mock-kpi-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></section> }
function Quick({href,icon,label}:{href:string;icon:React.ReactNode;label:string}) { return <Link href={href} className="mock-quick">{icon}<span>{label}</span></Link> }
