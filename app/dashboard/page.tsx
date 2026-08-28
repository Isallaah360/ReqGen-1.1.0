"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, ShieldCheck, CheckCircle2, Banknote, Clock3, Plus, Landmark, Archive, Users, BarChart3, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type RequestRow = { id: string; request_no: string | null; title: string | null; status: string | null; request_type: string | null; personal_category: string | null; created_at: string | null };
type VoucherRow = { id: string; voucher_no?: string | null; status: string | null; amount?: number | string | null; total_amount?: number | string | null; created_at?: string | null };
type NotificationRow = { id: string; title: string | null; created_at: string | null; is_read?: boolean | null };

function money(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", notation: value >= 1_000_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function done(status: string | null) {
  const s = String(status || "").toLowerCase();
  return s.includes("paid") || s.includes("complete") || s.includes("approved") || s.includes("closed");
}

function pending(status: string | null) {
  const s = String(status || "").toLowerCase();
  return !done(status) && !s.includes("reject") && !s.includes("cancel") && !s.includes("delete");
}

function requestGroup(row: RequestRow) {
  const rt = String(row.request_type || "").toLowerCase();
  const cat = String(row.personal_category || "").toLowerCase();
  if (rt === "official") return "Official";
  if (rt === "personal" && cat.includes("fund")) return "Personal Fund";
  return "Personal Other";
}

export default function DashboardPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const auth = await supabase.auth.getUser();
    const uid = auth.data.user?.id;
    const [requestResult, voucherResult, notificationResult] = await Promise.all([
      supabase.from("requests").select("id,request_no,title,status,request_type,personal_category,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("payment_vouchers").select("id,voucher_no,status,amount,total_amount,created_at").order("created_at", { ascending: false }).limit(100),
      uid ? supabase.from("notifications").select("id,title,created_at,is_read").eq("user_id", uid).order("created_at", { ascending: false }).limit(8) : Promise.resolve({ data: [], error: null } as any),
    ]);
    setRequests((requestResult.data || []) as RequestRow[]);
    setVouchers((voucherResult.data || []) as VoucherRow[]);
    setNotifications((notificationResult.data || []) as NotificationRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const completed = requests.filter((row) => done(row.status)).length;
    const active = requests.filter((row) => pending(row.status)).length;
    const paidValue = vouchers.reduce((sum, row) => {
      if (!done(row.status)) return sum;
      const amount = Number(row.total_amount ?? row.amount ?? 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    return { total: requests.length, active, completed, paidValue, overdue: 0 };
  }, [requests, vouchers]);

  const categories = useMemo(() => {
    const counts = { Official: 0, "Personal Fund": 0, "Personal Other": 0 } as Record<string, number>;
    requests.forEach((row) => { counts[requestGroup(row)] = (counts[requestGroup(row)] || 0) + 1; });
    return counts;
  }, [requests]);

  const recent = useMemo(() => requests.slice(0, 5), [requests]);

  return (
    <main className="mock-page mock-dashboard-page">
      <header className="mock-page-header">
        <div>
          <h1>Welcome back, Admin! <span aria-hidden="true">👋</span></h1>
          <p>Here&apos;s what&apos;s happening across ReqGen today.</p>
        </div>
        <div className="mock-date-chip">{new Date().toLocaleDateString("en-NG", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</div>
      </header>

      <section className="mock-kpi-grid mock-kpi-grid-5">
        <article className="mock-kpi"><span className="mock-kpi-icon blue"><FileText /></span><div><small>Total Requests</small><strong>{loading ? "—" : stats.total}</strong><em>System-wide records</em></div></article>
        <article className="mock-kpi"><span className="mock-kpi-icon amber"><Clock3 /></span><div><small>Pending Approvals</small><strong>{loading ? "—" : stats.active}</strong><em>Needs attention</em></div></article>
        <article className="mock-kpi"><span className="mock-kpi-icon green"><CheckCircle2 /></span><div><small>Completed / Paid</small><strong>{loading ? "—" : stats.completed}</strong><em>Closed workflows</em></div></article>
        <article className="mock-kpi"><span className="mock-kpi-icon purple"><Banknote /></span><div><small>Total Disbursed</small><strong>{loading ? "—" : money(stats.paidValue)}</strong><em>Posted vouchers</em></div></article>
        <article className="mock-kpi"><span className="mock-kpi-icon red"><ShieldCheck /></span><div><small>Overdue</small><strong>{stats.overdue}</strong><em>Needs attention</em></div></article>
      </section>

      <section className="mock-dashboard-grid">
        <article className="mock-panel mock-chart-panel">
          <div className="mock-panel-heading"><div><h2>Request Trend</h2><p>Recent request activity snapshot.</p></div><span className="mock-select-chip">This Week</span></div>
          <div className="mock-line-chart" aria-label="Request trend visual">
            <div className="mock-chart-grid" />
            <svg viewBox="0 0 620 210" preserveAspectRatio="none" role="img" aria-label="Request trend">
              <polyline points="10,150 90,105 170,145 250,118 330,65 410,120 500,88 610,42" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="10,150 90,105 170,145 250,118 330,65 410,120 500,88 610,42 610,205 10,205" fill="currentColor" opacity=".06" />
            </svg>
            <div className="mock-chart-labels"><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span><span>Mon</span><span>Tue</span></div>
          </div>
        </article>

        <article className="mock-panel">
          <div className="mock-panel-heading"><div><h2>Recent Activities</h2><p>Latest request and notification updates.</p></div><Link href="/dashboard/activity">View all</Link></div>
          <div className="mock-activity-list">
            {recent.map((row, index) => <div key={row.id} className="mock-activity-row"><span className={`dot dot-${index % 4}`} /><div><strong>{row.request_no || "Request"} · {row.title || "Untitled request"}</strong><small>{row.status || "Pending"}</small></div><time>{row.created_at ? new Date(row.created_at).toLocaleDateString("en-NG", { day: "2-digit", month: "short" }) : "—"}</time></div>)}
            {recent.length === 0 && notifications.slice(0, 5).map((row, index) => <div key={row.id} className="mock-activity-row"><span className={`dot dot-${index % 4}`} /><div><strong>{row.title || "Notification"}</strong><small>{row.is_read ? "Read" : "Unread"}</small></div><time>{row.created_at ? new Date(row.created_at).toLocaleDateString("en-NG", { day: "2-digit", month: "short" }) : "—"}</time></div>)}
            {!loading && recent.length === 0 && notifications.length === 0 ? <div className="mock-empty">No recent activity yet.</div> : null}
          </div>
        </article>
      </section>

      <section className="mock-dashboard-lower">
        <article className="mock-panel">
          <div className="mock-panel-heading"><div><h2>Requests by Category</h2><p>Current distribution.</p></div></div>
          <div className="mock-donut-wrap"><div className="mock-donut" style={{ background: `conic-gradient(#2563eb 0 46%, #8b5cf6 46% 72%, #f59e0b 72% 100%)` }} /><div className="mock-legend"><span><i className="blue" />Official <b>{categories.Official}</b></span><span><i className="purple" />Personal Fund <b>{categories["Personal Fund"]}</b></span><span><i className="amber" />Personal Other <b>{categories["Personal Other"]}</b></span></div></div>
        </article>

        <article className="mock-panel">
          <div className="mock-panel-heading"><div><h2>Requests by Status</h2><p>Live workflow state.</p></div></div>
          <div className="mock-donut-wrap"><div className="mock-donut" style={{ background: `conic-gradient(#f59e0b 0 28%, #2563eb 28% 70%, #10b981 70% 94%, #ef4444 94% 100%)` }} /><div className="mock-legend"><span><i className="amber" />Pending <b>{stats.active}</b></span><span><i className="green" />Completed <b>{stats.completed}</b></span><span><i className="red" />Rejected <b>{Math.max(stats.total - stats.active - stats.completed, 0)}</b></span></div></div>
        </article>

        <article className="mock-panel">
          <div className="mock-panel-heading"><div><h2>Quick Actions</h2><p>Frequently used tasks.</p></div></div>
          <div className="mock-quick-grid">
            <Link href="/requests/new"><Plus /><span>New Request</span></Link>
            <Link href="/approvals"><ShieldCheck /><span>Approvals</span></Link>
            <Link href="/registry"><Archive /><span>Registry</span></Link>
            <Link href="/finance"><Landmark /><span>Finance</span></Link>
            <Link href="/hr"><Users /><span>HR</span></Link>
            <Link href="/reports"><BarChart3 /><span>Reports</span></Link>
          </div>
        </article>
      </section>

      <aside className="mock-info-strip"><ShieldCheck /><div><strong>Security Tip</strong><p>Always verify request details before approval and never share your login credentials.</p></div><Link href="/about">Learn more <ArrowRight size={16} /></Link></aside>
    </main>
  );
}
