"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Donut as SharedDonut } from "@/app/components/ui/Donut";
import { BarChart } from "@/app/components/ui/BarChart";
import {
  X,
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

type Filter =
  | { kind: "status"; value: "Completed" | "Pending" | "Rejected" | "Overdue"; label: string }
  | { kind: "category"; value: "Official" | "Personal Fund" | "Personal Other" | "Other"; label: string }
  | { kind: "day" | "week"; value: string; label: string };

function categoryOf(r: RequestRow) {
  const type = `${normalized(r.request_type)} ${normalized(r.personal_category)}`;
  if (type.includes("official")) return "Official";
  if (type.includes("fund")) return "Personal Fund";
  if (type.includes("personal")) return "Personal Other";
  return "Other";
}

function startOfDay(value: Date) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function matches(r: RequestRow, f: Filter): boolean {
  if (f.kind === "status") {
    if (f.value === "Overdue") return pending(r.status) && ageDays(r.created_at) > 7;
    return statusLabel(r.status) === f.value;
  }
  if (f.kind === "category") return categoryOf(r) === f.value;
  const created = startOfDay(new Date(r.created_at)).getTime();
  if (f.kind === "day") return created === Number(f.value);
  const start = Number(f.value);
  return created >= start && created < start + 7 * 86400000;
}

export default function DashboardPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"7d" | "4w">("7d");
  const [filter, setFilter] = useState<Filter | null>(null);

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

  const trend = useMemo(() => {
    const today = startOfDay(new Date(DASHBOARD_NOW));
    if (range === "7d") {
      return Array.from({ length: 7 }, (_, index) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (6 - index));
        const key = String(d.getTime());
        const value = requests.filter((r) => startOfDay(new Date(r.created_at)).getTime() === d.getTime()).length;
        return { key, label: d.toLocaleDateString("en-GB", { weekday: "short" }), hint: d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }), value };
      });
    }
    return Array.from({ length: 4 }, (_, index) => {
      const start = new Date(today);
      start.setDate(start.getDate() - 6 - (3 - index) * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const key = String(start.getTime());
      const value = requests.filter((r) => { const c = startOfDay(new Date(r.created_at)).getTime(); return c >= start.getTime() && c <= end.getTime(); }).length;
      const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      return { key, label: index === 3 ? "This week" : `Wk ${index + 1}`, hint: `${fmt(start)} – ${fmt(end)}`, value };
    });
  }, [requests, range]);

  const category = useMemo(() => {
    const result = { official: 0, personalFund: 0, personalOther: 0, other: 0 };
    for (const r of requests) {
      const c = categoryOf(r);
      if (c === "Official") result.official += 1;
      else if (c === "Personal Fund") result.personalFund += 1;
      else if (c === "Personal Other") result.personalOther += 1;
      else result.other += 1;
    }
    return result;
  }, [requests]);

  const filtered = useMemo(() => (filter ? requests.filter((r) => matches(r, filter)) : requests.slice(0, 6)), [requests, filter]);

  const toggle = (next: Filter) =>
    setFilter((cur) => (cur && cur.kind === next.kind && cur.value === next.value ? null : next));
  const isOn = (kind: Filter["kind"], value: string) => filter?.kind === kind && filter.value === value;

  const dateLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const trendKind = range === "7d" ? "day" : "week";
  const selectedBar = filter && filter.kind === trendKind ? filter.value : null;

  return (
    <main className={styles.page} data-rg-standard="phase7">
      <header className={styles.header}>
        <div>
          <h1>Dashboard</h1>
          <p>Your requests at a glance. Select any chart bar, slice or card to see exactly those requests.</p>
        </div>
        <div className={styles.dateBox}><CalendarDays size={17} />{dateLabel}</div>
      </header>

      <section className={styles.kpis} aria-label="Dashboard summary">
        <Kpi tone="blue" icon={<FileText size={23} />} label="My Requests" value={String(stats.total)} meta="All your requests" active={!filter} onClick={() => setFilter(null)} />
        <Kpi tone="orange" icon={<Clock3 size={23} />} label="Pending" value={String(stats.pending)} meta="Awaiting action" active={isOn("status", "Pending")} onClick={() => toggle({ kind: "status", value: "Pending", label: "Pending requests" })} />
        <Kpi tone="green" icon={<CheckCircle2 size={23} />} label="Completed" value={String(stats.completed)} meta="Approved, paid or closed" active={isOn("status", "Completed")} onClick={() => toggle({ kind: "status", value: "Completed", label: "Completed requests" })} />
        <Kpi tone="purple" icon={<CircleAlert size={23} />} label="Rejected" value={String(stats.rejected)} meta="Rejected or cancelled" active={isOn("status", "Rejected")} onClick={() => toggle({ kind: "status", value: "Rejected", label: "Rejected requests" })} />
        <Kpi tone="red" icon={<CircleAlert size={23} />} label="Overdue" value={String(stats.overdue)} meta="Pending over 7 days" active={isOn("status", "Overdue")} onClick={() => toggle({ kind: "status", value: "Overdue", label: "Overdue requests" })} />
      </section>

      <section className={styles.topGrid}>
        <article className={styles.card}>
          <div className={styles.cardHead}>
            <h2>Request Trend</h2>
            <div className="rg-segmented" role="group" aria-label="Trend range">
              <button type="button" aria-pressed={range === "7d"} onClick={() => { setRange("7d"); if (filter?.kind === "week") setFilter(null); }}>7 days</button>
              <button type="button" aria-pressed={range === "4w"} onClick={() => { setRange("4w"); if (filter?.kind === "day") setFilter(null); }}>4 weeks</button>
            </div>
          </div>
          <div className={styles.chartBody}>
            <BarChart
              data={trend}
              valueNoun="request"
              ariaLabel={range === "7d" ? "Requests created per day, last seven days" : "Requests created per week, last four weeks"}
              selected={selectedBar}
              onBarSelect={(key) => {
                if (!key) { setFilter(null); return; }
                const bar = trend.find((b) => b.key === key);
                setFilter({ kind: trendKind, value: key, label: `Created ${range === "7d" ? "on" : "in"} ${bar?.hint || bar?.label || ""}` });
              }}
            />
            <div className={styles.chartHint}>Hover a bar for its exact count · select it to list those requests.</div>
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHead}>
            <h2>{filter ? "Filtered Requests" : "Recent Requests"}</h2>
            <Link href="/requests">View all</Link>
          </div>
          {filter ? (
            <div className="rg-filter-chip" role="status" aria-live="polite">
              <span>Showing: <strong>{filter.label}</strong> · {filtered.length}</span>
              <button type="button" onClick={() => setFilter(null)} aria-label="Clear filter"><X size={14} /> Clear</button>
            </div>
          ) : null}
          <div className={styles.activity}>
            {filtered.length ? filtered.slice(0, 50).map((r) => (
              <Link key={r.id} href={`/requests/${r.id}`} className={styles.activityItem}>
                <span className={`${styles.activityIcon} ${styles[completed(r.status) ? "green" : rejected(r.status) ? "red" : "blue"]}`}><FileText size={15} /></span>
                <div>
                  <strong>{r.request_no || "Request"} · {r.title || "Untitled request"}</strong>
                  <small>{statusLabel(r.status)} · {new Date(r.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</small>
                </div>
              </Link>
            )) : <div className={styles.empty}>{loading ? "Loading requests..." : filter ? "No requests match this selection." : "No requests yet."}</div>}
          </div>
        </article>
      </section>

      <section className={styles.bottomGrid}>
        <article className={styles.card}>
          <div className={styles.cardHead}><h2>Requests by Category</h2><span>Select a slice</span></div>
          <Donut total={stats.total} kind="category" filter={filter} onToggle={toggle} rows={[
            ["var(--rg-chart-1)", "Official", category.official],
            ["var(--rg-chart-2)", "Personal Fund", category.personalFund],
            ["var(--rg-chart-3)", "Personal Other", category.personalOther],
            ["var(--rg-chart-4)", "Other", category.other],
          ]} />
        </article>
        <article className={styles.card}>
          <div className={styles.cardHead}><h2>Requests by Status</h2><span>Select a slice</span></div>
          <Donut total={stats.total} kind="status" filter={filter} onToggle={toggle} rows={[
            ["var(--rg-chart-2)", "Completed", stats.completed],
            ["var(--rg-chart-1)", "Pending", stats.pending],
            ["var(--rg-chart-5)", "Rejected", stats.rejected],
          ]} />
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

function Kpi({ tone, icon, label, value, meta, active, onClick }: { tone: "blue"|"green"|"orange"|"purple"|"red"; icon: React.ReactNode; label: string; value: string; meta: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`${styles.kpi} rg-kpi-button`} aria-pressed={active} onClick={onClick}>
      <div className={`${styles.icon} ${styles[tone]}`}>{icon}</div>
      <div><span className={styles.kpiLabel}>{label}</span><strong className={styles.kpiValue}>{value}</strong><div className={styles.kpiMeta}>{meta}</div></div>
    </button>
  );
}

function Donut({ total, rows, kind, filter, onToggle }: { total: number; rows: [string, string, number][]; kind: "status" | "category"; filter: Filter | null; onToggle: (f: Filter) => void }) {
  const selected = filter && filter.kind === kind ? filter.value : null;
  const pick = (label: string | null) => {
    if (!label) { if (selected) onToggle({ kind, value: selected, label: selected } as Filter); return; }
    onToggle({ kind, value: label, label: `${label} requests` } as Filter);
  };
  const segments = rows.map(([color, label, value]) => ({ color, label, value }));
  return (
    <div className={styles.donutBody}>
      <SharedDonut segments={segments} centerLabel="Total" size={200} strokeWidth={30} fluidMax={190} selected={selected} onSegmentSelect={pick} />
      <div className={styles.legend}>
        {rows.map(([color, label, value]) => {
          const pct = total ? Math.round((value / total) * 100) : 0;
          return (
            <button key={label} type="button" className={styles.legendRow} aria-pressed={selected === label} onClick={() => pick(label)}>
              <i className={styles.legendDot} style={{ background: color }} /><span>{label}</span><strong>{value} ({pct}%)</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Quick({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return <Link href={href} className={styles.quick}>{icon}<span>{label}</span></Link>;
}
