"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FilePlus2,
  FileText,
  Landmark,
  ShieldCheck,
  Upload,
  WalletCards,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./dashboard.module.css";

type RequestRow = {
  id: string;
  status: string | null;
  request_type: string | null;
  personal_category: string | null;
  created_at: string;
  title: string | null;
  request_no: string | null;
};


function normalized(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}
function completed(value?: string | null) {
  const s = normalized(value);
  return s.includes("paid") || s.includes("complete") || s.includes("approved") || s.includes("closed");
}
function rejected(value?: string | null) {
  const s = normalized(value);
  return s.includes("reject") || s.includes("delete") || s.includes("cancel") || s.includes("failed");
}
function pending(value?: string | null) {
  return !completed(value) && !rejected(value);
}
function statusLabel(status?: string | null) {
  if (completed(status)) return "Completed";
  if (rejected(status)) return "Rejected";
  return "Pending";
}
const DASHBOARD_NOW = Date.now();

function ageDays(value: string) {
  const created = new Date(value).getTime();
  if (!created) return 0;
  return Math.max(0, Math.floor((DASHBOARD_NOW - created) / 86400000));
}

export default function DashboardPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartSelection, setChartSelection] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (!mounted) return;
      if (authError || !auth.user) { setRequests([]); setLoading(false); return; }
      const rq = await supabase
        .from("requests")
        .select("id,status,request_type,personal_category,created_at,title,request_no")
        .eq("created_by", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(500);

      if (!mounted) return;
      if (!rq.error) setRequests((rq.data || []) as RequestRow[]);
      else setRequests([]);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const stats = useMemo(() => {
    const completedCount = requests.filter((r) => completed(r.status)).length;
    const pendingCount = requests.filter((r) => pending(r.status)).length;
    const rejectedCount = requests.filter((r) => rejected(r.status)).length;
    const overdue = requests.filter((r) => pending(r.status) && ageDays(r.created_at) > 7).length;
    return { total: requests.length, completed: completedCount, pending: pendingCount, rejected: rejectedCount, overdue };
  }, [requests]);

  const trend = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - index));
    const count = requests.filter((r) => {
      const created = new Date(r.created_at);
      created.setHours(0, 0, 0, 0);
      return created.getTime() === d.getTime();
    }).length;
    return { label: d.toLocaleDateString("en-NG", { weekday: "short" }), count };
  }), [requests]);

  const category = useMemo(() => {
    const result = { official: 0, personalFund: 0, personalOther: 0, other: 0 };
    for (const r of requests) {
      const type = `${normalized(r.request_type)} ${normalized(r.personal_category)}`;
      if (type.includes("official")) result.official += 1;
      else if (type.includes("fund")) result.personalFund += 1;
      else if (type.includes("personal")) result.personalOther += 1;
      else result.other += 1;
    }
    return result;
  }, [requests]);

  const statusMix = useMemo(() => ({
    completed: requests.filter((r) => completed(r.status)).length,
    pending: requests.filter((r) => pending(r.status)).length,
    rejected: requests.filter((r) => rejected(r.status)).length,
  }), [requests]);

  const chart = useMemo(() => {
    const width = 720, height = 210, padX = 34, padY = 24;
    const max = Math.max(1, ...trend.map((d) => d.count));
    const points = trend.map((d, i) => {
      const x = padX + (i * (width - padX * 2)) / Math.max(1, trend.length - 1);
      const y = height - padY - (d.count / max) * (height - padY * 2);
      return { ...d, x, y };
    });
    return { width, height, points, polyline: points.map((p) => `${p.x},${p.y}`).join(" ") };
  }, [trend]);

  const activity = useMemo(() => {
    const requestActivity = requests.slice(0, 4).map((r) => ({
      id: `r-${r.id}`,
      label: `${r.request_no || "Request"} ${statusLabel(r.status).toLowerCase()}`,
      time: r.created_at,
      tone: completed(r.status) ? "green" : rejected(r.status) ? "red" : "blue",
    }));
    return requestActivity
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 5);
  }, [requests]);

  const dateLabel = new Date().toLocaleDateString("en-NG", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  return (
    <main className={styles.page} data-rg-standard="phase7">
      <header className={styles.header}>
        <div>
          <h1>Dashboard</h1>
          <p>Your personal ReqGen request activity, status and current workload.</p>
        </div>
        <div className={styles.dateBox}><CalendarDays size={17} />{dateLabel}</div>
      </header>

      <section className={styles.kpis} aria-label="Dashboard summary">
        <Kpi tone="blue" icon={<FileText size={23} />} label="My Requests" value={String(stats.total)} meta="Your submitted requests only" />
        <Kpi tone="orange" icon={<Clock3 size={23} />} label="Pending Requests" value={String(stats.pending)} meta="Your requests awaiting action" />
        <Kpi tone="green" icon={<CheckCircle2 size={23} />} label="Completed" value={String(stats.completed)} meta="Your completed requests" />
        <Kpi tone="purple" icon={<CircleAlert size={23} />} label="Rejected" value={String(stats.rejected)} meta="Your rejected requests" />
        <Kpi tone="red" icon={<CircleAlert size={23} />} label="Overdue" value={String(stats.overdue)} meta="Pending over 7 days" />
      </section>

      <section className={styles.topGrid}>
        <article className={styles.card}>
          <div className={styles.cardHead}><h2>Request Trend <span>(This Week)</span></h2><span>This Week</span></div>
          <div className={styles.chartBody}>
            <svg className={styles.chart} viewBox={`0 0 ${chart.width} ${chart.height}`} preserveAspectRatio="none" role="img" aria-label="Request trend for the last seven days">
              <defs><linearGradient id="requestArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2f80ed" stopOpacity=".18"/><stop offset="100%" stopColor="#2f80ed" stopOpacity="0"/></linearGradient></defs>
              {[0,1,2,3,4].map((n) => <line key={n} className={styles.chartGrid} x1="34" x2="700" y1={28+n*37} y2={28+n*37}/>) }
              <polygon className={styles.chartArea} points={`34,186 ${chart.polyline} 686,186`} />
              <polyline className={styles.chartLine} points={chart.polyline} />
              {chart.points.map((p, i) => <g key={i} className={styles.chartPoint}><title>{`${p.label}: ${p.count} request${p.count === 1 ? "" : "s"}`}</title><circle className={styles.chartDot} cx={p.x} cy={p.y} r="5" tabIndex={0} role="button" aria-label={`${p.label}: ${p.count} request${p.count === 1 ? "" : "s"}`} onClick={() => setChartSelection(`${p.label}: ${p.count} request${p.count === 1 ? "" : "s"}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setChartSelection(`${p.label}: ${p.count} request${p.count === 1 ? "" : "s"}`); } }}/><text x={p.x} y="205" textAnchor="middle">{p.label}</text></g>)}
            </svg>
            {chartSelection ? <div className={styles.chartInsight} role="status" aria-live="polite"><strong>Selected data</strong><span>{chartSelection}</span></div> : <div className={styles.chartHint}>Select any chart point to display its exact live value.</div>}
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHead}><h2>Recent Activities</h2><Link href="/dashboard/activity">View all</Link></div>
          <div className={styles.activity}>
            {activity.length ? activity.map((item) => <div key={item.id} className={styles.activityItem}><span className={`${styles.activityIcon} ${styles[item.tone]}`}><Bell size={15}/></span><div><strong>{item.label}</strong><small>{new Date(item.time).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</small></div></div>) : <div className={styles.empty}>{loading ? "Loading activities..." : "No recent activities yet."}</div>}
          </div>
        </article>
      </section>

      <section className={styles.bottomGrid}>
        <article className={styles.card}>
          <div className={styles.cardHead}><h2>Requests by Category</h2><span>Current register</span></div>
          <Donut title="Total" total={stats.total} rows={[
            ["#2f80ed","Official",category.official],
            ["#24b47e","Personal Fund",category.personalFund],
            ["#f5a623","Personal Other",category.personalOther],
            ["#7c4dff","Other",category.other],
          ]}/>
        </article>
        <article className={styles.card}>
          <div className={styles.cardHead}><h2>Requests by Status</h2><span>Current register</span></div>
          <Donut title="Total" total={stats.total} rows={[
            ["#24b47e","Completed",statusMix.completed],
            ["#2f80ed","Pending",statusMix.pending],
            ["#ef476f","Rejected",statusMix.rejected],
          ]}/>
        </article>
        <article className={styles.card}>
          <div className={styles.cardHead}><h2>Quick Actions</h2><span>Common workspaces</span></div>
          <div className={styles.quickGrid}>
            <Quick href="/requests/new" icon={<FilePlus2 size={22}/>} label="New Request" />
            <Quick href="/approvals/action-centre" icon={<ShieldCheck size={22}/>} label="Action Centre" />
            <Quick href="/finance/manage-accounts" icon={<Landmark size={22}/>} label="Add Account" />
            <Quick href="/payment-vouchers" icon={<WalletCards size={22}/>} label="New Voucher" />
            <Quick href="/registry" icon={<Upload size={22}/>} label="Upload Document" />
            <Quick href="/reports" icon={<BarChart3 size={22}/>} label="View Reports" />
          </div>
        </article>
      </section>

      <div className={styles.security}><ShieldCheck size={22}/><div><strong>Security Tip</strong><p>Always verify request details before approval and never share your login credentials.</p></div></div>
    </main>
  );
}

function Kpi({ tone, icon, label, value, meta }: { tone: "blue"|"green"|"orange"|"purple"|"red"; icon: React.ReactNode; label: string; value: string; meta: string }) {
  return <article className={styles.kpi}><div className={`${styles.icon} ${styles[tone]}`}>{icon}</div><div><span className={styles.kpiLabel}>{label}</span><strong className={styles.kpiValue}>{value}</strong><div className={styles.kpiMeta}>{meta}</div></div></article>;
}
function Donut({ title, total, rows }: { title: string; total: number; rows: [string,string,number][] }) {
  const [detail, setDetail] = useState<string | null>(null);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const select = (value: string) => setDetail(value);
  return <><div className={styles.donutBody}><div className={styles.donut} role="img" aria-label={`Donut chart. Total ${total}.`}><svg viewBox="0 0 120 120" aria-hidden="true"><circle className={styles.donutTrack} cx="60" cy="60" r={radius}/>{total > 0 ? rows.map(([color,label,value]) => { const length = (value / total) * circumference; const dashOffset = -offset; offset += length; return <circle key={label} className={styles.donutSegment} cx="60" cy="60" r={radius} pathLength={circumference} stroke={color} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={dashOffset} onClick={() => select(`${label}: ${value} (${Math.round((value / total) * 100)}%)`)}><title>{`${label}: ${value}`}</title></circle>; }) : null}</svg><button type="button" className={styles.donutCenter} onClick={() => select(rows.map(([, label, value]) => `${label}: ${value}`).join(" · "))} aria-label="Show complete chart breakdown"><strong>{total}</strong><span>{title}</span></button></div><div className={styles.legend}>{rows.map(([color,label,value]) => <Legend key={label} color={color} label={label} value={value} total={total} onSelect={select}/>)}</div></div><div className={styles.chartInsight} role="status" aria-live="polite"><strong>Selected data</strong><span>{detail || "Select a donut segment or legend row to display the exact value."}</span></div></>;
}
function Legend({ color, label, value, total, onSelect }: { color: string; label: string; value: number; total: number; onSelect: (detail: string) => void }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return <button type="button" className={styles.legendRow} onClick={() => onSelect(`${label}: ${value} (${pct}%)`)}><i className={styles.legendDot} style={{background: color}}/><span>{label}</span><strong>{value} ({pct}%)</strong></button>;
}
function Quick({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return <Link href={href} className={styles.quick}>{icon}<span>{label}</span></Link>;
}
